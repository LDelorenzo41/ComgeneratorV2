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
  scope?: 'global' | 'user';
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
  chatModel: 'gpt-4o-mini',        // ✅ CORRIGÉ: Modèle correct
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
  scope?: 'global' | 'user';
}

async function searchChunks(
  supabase: SupabaseClient,
  userId: string,
  queryEmbedding: number[],
  topK: number,
  documentId?: string
): Promise<MatchedChunk[]> {
  // Appel à la fonction RPC match_rag_chunks (cherche global + user)
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
// GÉNÉRATION DE LA RÉPONSE - PROMPTS OPTIMISÉS
// ============================================================================

function buildSystemPrompt(mode: ChatMode): string {
  if (mode === 'corpus_only') {
    // ✅ PROMPT OPTIMISÉ : moins strict, encourage à chercher l'info
    return `Tu es un assistant de recherche documentaire expert en éducation et programmes scolaires français.

Tu réponds en te basant sur les extraits de documents fournis dans le contexte.

INSTRUCTIONS :
1. Analyse attentivement TOUS les extraits fournis, même s'ils semblent partiellement pertinents.
2. Les extraits avec un score de pertinence ≥60% contiennent probablement des informations utiles. Examine-les en détail.
3. Si l'information est présente même partiellement dans un extrait, utilise-la pour répondre.
4. Reformule et synthétise les informations des extraits de manière claire et pédagogique.
5. Cite tes sources avec le format [Document: X, Extrait: Y].

QUAND DIRE "Je n'ai pas trouvé" :
- UNIQUEMENT si après analyse approfondie de TOUS les extraits, aucun ne contient d'information liée à la question.
- Si les extraits parlent d'un sujet connexe mais pas exactement de la question, essaie quand même de faire le lien.

FORMAT DE RÉPONSE :
- Structure ta réponse de manière claire (listes, titres si nécessaire)
- Sois précis et cite les éléments clés des documents
- Termine par les références aux sources utilisées`;
  }

  // Mode corpus_plus_ai
  return `Tu es un assistant de recherche documentaire expert en éducation et programmes scolaires français.

Tu utilises prioritairement les extraits de documents fournis, et tu peux compléter avec tes connaissances générales si nécessaire.

INSTRUCTIONS :
1. PRIORITÉ ABSOLUE aux informations des extraits fournis.
2. Analyse attentivement tous les extraits, même ceux avec un score de pertinence modéré (≥60%).
3. Cite tes sources documentaires avec [Document: X, Extrait: Y].
4. Si tu complètes avec des informations générales, signale-le CLAIREMENT avec "[Complément IA]".
5. En cas de contradiction entre un document et tes connaissances, privilégie le document.

FORMAT DE RÉPONSE :
- Commence par les informations issues des documents
- Sépare clairement les compléments d'information avec "[Complément IA]"
- Sois pédagogique et structuré`;
}

function buildUserPrompt(
  question: string,
  chunks: MatchedChunk[],
  mode: ChatMode
): string {
  if (chunks.length === 0) {
    if (mode === 'corpus_only') {
      return `Question : ${question}

[Aucun extrait trouvé dans les documents]

Réponds : "Je n'ai pas trouvé d'information pertinente dans vos documents pour cette question. Essayez de reformuler votre question ou vérifiez que vous avez uploadé des documents traitant de ce sujet."`;
    }

    return `Question : ${question}

[Aucun extrait trouvé dans les documents]

Tu peux répondre avec tes connaissances générales, mais signale clairement que cette réponse ne provient pas des documents de l'utilisateur avec le préfixe "[Complément IA]".`;
  }

  // ✅ AMÉLIORATION : Meilleure présentation des extraits
  const contextParts = chunks.map((chunk, index) => {
    const scopeLabel = chunk.scope === 'global' ? '📚 Document officiel' : '📄 Document personnel';
    return `━━━ Extrait ${index + 1} ━━━
${scopeLabel}
Titre : ${chunk.document_title}
Pertinence : ${(chunk.similarity * 100).toFixed(0)}%

${chunk.content}
━━━━━━━━━━━━━━━━`;
  });

  // ✅ AMÉLIORATION : Instruction plus claire pour utiliser les extraits
  const instruction = mode === 'corpus_only'
    ? `\n\n⚠️ IMPORTANT : Analyse bien chaque extrait. Les informations peuvent être réparties sur plusieurs extraits. Si tu trouves des éléments de réponse, même partiels, utilise-les.`
    : `\n\nUtilise prioritairement les extraits, et complète avec tes connaissances si nécessaire (marque "[Complément IA]").`;

  return `Question : ${question}

📋 CONTEXTE - ${chunks.length} extrait(s) trouvé(s) dans vos documents :

${contextParts.join('\n\n')}${instruction}`;
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

    // ✅ CORRIGÉ : Vérifier documents USER + GLOBAL
    const { count: userDocCount } = await supabaseAdmin
      .from('rag_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'ready');

    const { count: globalDocCount } = await supabaseAdmin
      .from('rag_documents')
      .select('*', { count: 'exact', head: true })
      .eq('scope', 'global')
      .eq('status', 'ready');

    const totalDocs = (userDocCount || 0) + (globalDocCount || 0);

    if (totalDocs === 0) {
      return new Response(
        JSON.stringify({
          error: 'Aucun document indexé. Uploadez d\'abord des documents ou attendez que l\'administrateur ajoute des documents officiels.',
          noDocuments: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Available documents: ${userDocCount || 0} user + ${globalDocCount || 0} global = ${totalDocs} total`);

    // 1. Générer l'embedding de la question
    console.log('Generating query embedding...');
    const queryEmbedding = await embedQuery(message, OPENAI_API_KEY);

    // 2. Rechercher les chunks pertinents (global + user via RPC)
    console.log('Searching relevant chunks...');
    const matchedChunks = await searchChunks(
      supabaseAdmin,
      user.id,
      queryEmbedding,
      actualTopK,
      documentId
    );

    console.log(`Found ${matchedChunks.length} relevant chunks`);

    // Log détaillé pour debug
    if (matchedChunks.length > 0) {
      matchedChunks.forEach((chunk, i) => {
        console.log(`  Chunk ${i + 1}: "${chunk.document_title}" (${chunk.scope || 'user'}) - similarity: ${(chunk.similarity * 100).toFixed(1)}%`);
      });
    }

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
      scope: chunk.scope,
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
