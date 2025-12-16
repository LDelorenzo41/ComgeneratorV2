// supabase/functions/rag-chat/index.ts
// Edge Function pour le chat RAG avec double mode (corpus_only / corpus_plus_ai)

// Déclarations pour l'environnement Deno
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
type ChatMode = 'corpus_only' | 'corpus_plus_ai';

interface ChatRequest {
  message: string;
  mode: ChatMode;
  conversationId?: string;
  documentId?: string;       // Filtre optionnel sur un document spécifique
  topK?: number;             // Nombre de chunks à récupérer (défaut: 5)
}

interface SourceChunk {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
}

interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
  conversationId: string;
  tokensUsed: number;
  mode: ChatMode;
}

// Configuration
const CONFIG = {
  defaultTopK: 5,
  maxTopK: 10,
  similarityThreshold: 0.5,       // Seuil de similarité minimum
  excerptLength: 300,              // Longueur max des extraits dans les sources
  chatModel: 'gpt-4.1-mini',       // Modèle pour le chat
  embeddingModel: 'text-embedding-3-small',
  maxTokensResponse: 2000,
};

// ============================================================================
// EMBEDDING DE LA QUESTION
// ============================================================================

async function embedQuery(query: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.embeddingModel,
      input: query,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erreur embedding: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ============================================================================
// RECHERCHE VECTORIELLE
// ============================================================================

interface MatchedChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

async function searchChunks(
  supabase: SupabaseClient,
  userId: string,
  queryEmbedding: number[],
  topK: number,
  documentId?: string
): Promise<MatchedChunk[]> {
  // Appel à la fonction RPC match_rag_chunks
  const { data, error } = await supabase.rpc('match_rag_chunks', {
    p_user_id: userId,
    p_query_embedding: `[${queryEmbedding.join(',')}]`,
    p_match_count: topK,
    p_document_id: documentId || null,
    p_similarity_threshold: CONFIG.similarityThreshold,
  });

  if (error) {
    console.error('Search error:', error);
    throw new Error(`Erreur recherche: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// GÉNÉRATION DE LA RÉPONSE
// ============================================================================

function buildSystemPrompt(mode: ChatMode): string {
  if (mode === 'corpus_only') {
    return `Tu es un assistant de recherche documentaire. Tu réponds UNIQUEMENT en te basant sur les extraits de documents fournis dans le contexte.

RÈGLES STRICTES :
1. Tu NE PEUX PAS inventer ou ajouter d'informations qui ne sont pas dans les extraits fournis.
2. Si les extraits ne contiennent pas l'information demandée, réponds exactement : "Je n'ai pas trouvé cette information dans vos documents."
3. Cite toujours les sources en mentionnant le titre du document et le numéro de l'extrait.
4. Si tu n'es pas sûr, dis-le clairement.
5. N'utilise JAMAIS tes connaissances générales.

Format de réponse :
- Réponds de manière claire et structurée
- Mentionne les sources entre crochets [Document: X, Extrait: Y]
- Si aucune information pertinente n'est trouvée, indique-le explicitement`;
  }

  // Mode corpus_plus_ai
  return `Tu es un assistant de recherche documentaire intelligent. Tu utilises prioritairement les extraits de documents fournis, mais tu peux compléter avec tes connaissances générales si nécessaire.

RÈGLES IMPORTANTES :
1. PRIORITÉ ABSOLUE aux informations des extraits fournis.
2. Cite toujours tes sources documentaires entre crochets [Document: X, Extrait: Y].
3. Si tu complètes avec des informations générales, signale-le CLAIREMENT avec la mention "[Complément IA]" ou "[Information générale]".
4. Distingue toujours ce qui vient des documents de ce qui vient de tes connaissances.
5. En cas de contradiction entre un document et tes connaissances, privilégie le document.

Format de réponse :
- Commence par les informations issues des documents
- Sépare clairement les compléments d'information
- Utilise des marqueurs visuels pour distinguer les sources`;
}

function buildUserPrompt(
  question: string,
  chunks: MatchedChunk[],
  mode: ChatMode
): string {
  if (chunks.length === 0) {
    if (mode === 'corpus_only') {
      return `Question : ${question}

[Aucun extrait pertinent trouvé dans les documents]

Rappel : En mode "Corpus uniquement", tu dois répondre "Je n'ai pas trouvé cette information dans vos documents."`;
    }

    return `Question : ${question}

[Aucun extrait pertinent trouvé dans les documents]

Tu peux répondre avec tes connaissances générales, mais signale clairement que cette réponse ne provient pas des documents de l'utilisateur.`;
  }

  const contextParts = chunks.map((chunk, index) => {
    return `--- Extrait ${index + 1} ---
Document : ${chunk.document_title}
Score de pertinence : ${(chunk.similarity * 100).toFixed(1)}%
Contenu :
${chunk.content}
---`;
  });

  return `Question : ${question}

CONTEXTE - Extraits pertinents de vos documents :

${contextParts.join('\n\n')}

Réponds à la question en te basant sur ces extraits.${mode === 'corpus_only' ? ' Si l\'information n\'est pas dans les extraits, dis-le.' : ''}`;
}

async function generateAnswer(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<{ answer: string; tokensUsed: number }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: CONFIG.maxTokensResponse,
      temperature: 0.3, // Plus bas pour être plus factuel
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI Chat error:', error);
    throw new Error(`Erreur génération: ${response.status}`);
  }

  const data = await response.json();

  return {
    answer: data.choices[0].message.content,
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

// ============================================================================
// GESTION DES CONVERSATIONS
// ============================================================================

async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId?: string,
  mode?: ChatMode,
  documentId?: string
): Promise<string> {
  if (conversationId) {
    // Vérifier que la conversation existe et appartient à l'utilisateur
    const { data, error } = await supabase
      .from('rag_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      // Mettre à jour le timestamp
      await supabase
        .from('rag_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return conversationId;
    }
  }

  // Créer une nouvelle conversation
  const { data: newConv, error: createError } = await supabase
    .from('rag_conversations')
    .insert({
      user_id: userId,
      title: 'Nouvelle conversation',
      mode: mode || 'corpus_only',
      document_filter_id: documentId || null,
    })
    .select('id')
    .single();

  if (createError || !newConv) {
    throw new Error('Erreur création conversation');
  }

  return newConv.id;
}

async function saveMessage(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  sources: SourceChunk[] = [],
  tokensUsed: number = 0
): Promise<void> {
  const { error } = await supabase
    .from('rag_messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role,
      content,
      sources,
      tokens_used: tokensUsed,
    });

  if (error) {
    console.error('Error saving message:', error);
    // Non bloquant, on continue
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

const chatHandler = async (req: Request): Promise<Response> => {
  // Gestion CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Variables d'environnement
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Configuration serveur incomplète' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Vérifier l'utilisateur
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parser la requête
    const body: ChatRequest = await req.json();
    const {
      message,
      mode = 'corpus_only',
      conversationId,
      documentId,
      topK = CONFIG.defaultTopK,
    } = body;

    // Validations
    if (!message || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Message requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['corpus_only', 'corpus_plus_ai'].includes(mode)) {
      return new Response(
        JSON.stringify({ error: 'Mode invalide. Utilisez "corpus_only" ou "corpus_plus_ai"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const actualTopK = Math.min(Math.max(1, topK), CONFIG.maxTopK);

    console.log(`Chat request from user ${user.id}, mode: ${mode}, topK: ${actualTopK}`);

    // Vérifier qu'au moins un document existe pour l'utilisateur
    const { count: docCount } = await supabaseAdmin
      .from('rag_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'ready');

    if (!docCount || docCount === 0) {
      return new Response(
        JSON.stringify({
          error: 'Aucun document indexé. Uploadez d\'abord des documents.',
          noDocuments: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Générer l'embedding de la question
    console.log('Generating query embedding...');
    const queryEmbedding = await embedQuery(message, OPENAI_API_KEY);

    // 2. Rechercher les chunks pertinents
    console.log('Searching relevant chunks...');
    const matchedChunks = await searchChunks(
      supabaseAdmin,
      user.id,
      queryEmbedding,
      actualTopK,
      documentId
    );

    console.log(`Found ${matchedChunks.length} relevant chunks`);

    // 3. Construire les prompts
    const systemPrompt = buildSystemPrompt(mode);
    const userPrompt = buildUserPrompt(message, matchedChunks, mode);

    // 4. Générer la réponse
    console.log('Generating answer...');
    const { answer, tokensUsed } = await generateAnswer(
      systemPrompt,
      userPrompt,
      OPENAI_API_KEY
    );

    // 5. Préparer les sources
    const sources: SourceChunk[] = matchedChunks.map(chunk => ({
      documentId: chunk.document_id,
      documentTitle: chunk.document_title,
      chunkId: chunk.chunk_id,
      chunkIndex: chunk.chunk_index,
      excerpt: chunk.content.substring(0, CONFIG.excerptLength) +
        (chunk.content.length > CONFIG.excerptLength ? '...' : ''),
      score: chunk.similarity,
    }));

    // 6. Gérer la conversation et sauvegarder les messages
    const actualConversationId = await getOrCreateConversation(
      supabaseAdmin,
      user.id,
      conversationId,
      mode,
      documentId
    );

    // Sauvegarder le message utilisateur
    await saveMessage(
      supabaseAdmin,
      actualConversationId,
      user.id,
      'user',
      message
    );

    // Sauvegarder la réponse assistant
    await saveMessage(
      supabaseAdmin,
      actualConversationId,
      user.id,
      'assistant',
      answer,
      sources,
      tokensUsed
    );

    // 7. Retourner la réponse
    const response: ChatResponse = {
      answer,
      sources,
      conversationId: actualConversationId,
      tokensUsed,
      mode,
    };

    console.log(`Chat completed, ${tokensUsed} tokens used`);

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    console.error('Chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

Deno.serve(chatHandler);
