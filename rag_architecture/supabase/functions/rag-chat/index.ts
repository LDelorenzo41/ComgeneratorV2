// supabase/functions/rag-chat/index.ts
// Edge Function pour le chat RAG avec double mode (corpus_only / corpus_plus_ai)
// Support SearchMode: fast (économique) / precise (complet avec HyDE, Query Rewriting, Re-ranking)
// Déduction des tokens du compte utilisateur (profiles.tokens)

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
type SearchMode = 'fast' | 'precise';

interface ChatRequest {
  message: string;
  mode: ChatMode;
  searchMode?: SearchMode;
  conversationId?: string;
  documentId?: string;
  topK?: number;
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
  tokensRemaining: number;
  mode: ChatMode;
  searchMode: SearchMode;
}

// Configuration
const CONFIG = {
  defaultTopK: 5,
  maxTopK: 10,
  similarityThreshold: 0.35,
  excerptLength: 300,
  chatModel: 'gpt-4o-mini',
  embeddingModel: 'text-embedding-3-large',
  embeddingDimensions: 1536,
  maxTokensResponse: 2000,
};

// ============================================================================
// GESTION DES TOKENS UTILISATEUR
// ============================================================================

interface TokenCheckResult {
  hasEnoughTokens: boolean;
  currentBalance: number;
  error?: string;
}

async function checkUserTokens(
  supabase: SupabaseClient,
  userId: string,
  estimatedCost: number = 100
): Promise<TokenCheckResult> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('tokens')
    .eq('user_id', userId)
    .single();

  if (error || !profile) {
    console.error('Error fetching user tokens:', error);
    return {
      hasEnoughTokens: false,
      currentBalance: 0,
      error: 'Impossible de vérifier le solde de tokens'
    };
  }

  const currentBalance = profile.tokens || 0;

  if (currentBalance < estimatedCost) {
    return {
      hasEnoughTokens: false,
      currentBalance,
      error: `Solde de tokens insuffisant. Vous avez ${currentBalance} tokens, mais cette requête nécessite environ ${estimatedCost} tokens.`
    };
  }

  return {
    hasEnoughTokens: true,
    currentBalance
  };
}

async function deductUserTokens(
  supabase: SupabaseClient,
  userId: string,
  tokensUsed: number
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('tokens')
    .eq('user_id', userId)
    .single();

  if (fetchError || !profile) {
    console.error('Error fetching tokens for deduction:', fetchError);
    return {
      success: false,
      newBalance: 0,
      error: 'Impossible de récupérer le solde actuel'
    };
  }

  const currentTokens = profile.tokens || 0;
  const newBalance = Math.max(0, currentTokens - tokensUsed);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ tokens: newBalance })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error deducting tokens:', updateError);
    return {
      success: false,
      newBalance: currentTokens,
      error: 'Erreur lors de la déduction des tokens'
    };
  }

  console.log(`Deducted ${tokensUsed} tokens from user ${userId}. New balance: ${newBalance}`);

  return {
    success: true,
    newBalance
  };
}

// ============================================================================
// DETECTION DES QUESTIONS COMPARATIVES
// ============================================================================

function isComparativeQuestion(query: string): boolean {
  const comparativePatterns = [
    /\bdiff[ée]ren(ce|t|tes?)\b/i,
    /\bcompare[rz]?\b/i,
    /\bcomparaison\b/i,
    /\bversus\b/i,
    /\bvs\.?\b/i,
    /\bentre\s+.+\s+et\s+/i,
    /\bpar rapport [àa]\b/i,
    /\bcontrairement [àa]\b/i,
    /\boppos[ée]\b/i,
    /\bdistingu[ée]?\b/i,
    /\bsimilaire\b/i,
    /\bsimilitude\b/i,
    /\bressemblance\b/i,
    /\bpoint commun\b/i,
  ];

  return comparativePatterns.some(pattern => pattern.test(query));
}

function extractComparisonTargets(query: string): string[] {
  const targets: string[] = [];

  // Pattern: "entre X et Y"
  const entreMatch = query.match(/entre\s+(?:le\s+|la\s+|l'|les\s+)?(.+?)\s+et\s+(?:le\s+|la\s+|l'|les\s+)?(.+?)(?:\s*[?.,]|$)/i);
  if (entreMatch) {
    targets.push(entreMatch[1].trim(), entreMatch[2].trim());
  }

  // Pattern: "X vs Y" ou "X versus Y"
  const vsMatch = query.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\s*[?.,]|$)/i);
  if (vsMatch && targets.length === 0) {
    targets.push(vsMatch[1].trim(), vsMatch[2].trim());
  }

  // Pattern pour les cycles: "cycle 3", "cycle 4", etc.
  const cycleMatches = query.match(/cycle\s*(\d+)/gi);
  if (cycleMatches && targets.length === 0) {
    cycleMatches.forEach(match => targets.push(match));
  }

  // Pattern pour les niveaux: "CP", "CE1", "CM2", "6ème", etc.
  const niveauMatches = query.match(/\b(CP|CE[12]|CM[12]|6[èe]me|5[èe]me|4[èe]me|3[èe]me|seconde|premi[èe]re|terminale)\b/gi);
  if (niveauMatches && targets.length === 0) {
    niveauMatches.forEach(match => targets.push(match));
  }

  return [...new Set(targets)]; // Dédupliquer
}

// ============================================================================
// HyDE (Hypothetical Document Embeddings)
// ============================================================================

async function generateHypotheticalAnswer(
  query: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en éducation et programmes scolaires français.
Génère une réponse hypothétique courte et factuelle à la question de l'utilisateur.
Cette réponse sera utilisée pour améliorer la recherche documentaire.
Réponds de manière concise (2-3 phrases maximum) comme si tu citais un document officiel.`
        },
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    console.warn('HyDE generation failed, falling back to direct query');
    return query;
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || query;
}

// ============================================================================
// QUERY REWRITING
// ============================================================================

async function rewriteQuery(
  query: string,
  apiKey: string
): Promise<string[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu reformules la question de l'utilisateur en 2 variantes pour améliorer la recherche documentaire.
Réponds UNIQUEMENT avec les 2 reformulations, une par ligne, sans numérotation ni préfixe.`
        },
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: 150,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    console.warn('Query rewriting failed');
    return [query];
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  const variants = content.split('\n').filter((line: string) => line.trim().length > 0);

  return [query, ...variants.slice(0, 2)];
}

// ============================================================================
// EMBEDDING
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
      dimensions: CONFIG.embeddingDimensions,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erreur embedding: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function embedMultipleQueries(queries: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.embeddingModel,
      input: queries,
      dimensions: CONFIG.embeddingDimensions,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erreur embedding multiple: ${response.status}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
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

async function searchChunksHybrid(
  supabase: SupabaseClient,
  userId: string,
  originalQuery: string,
  searchMode: SearchMode,
  apiKey: string,
  topK: number,
  documentId?: string
): Promise<MatchedChunk[]> {
  const isComparative = isComparativeQuestion(originalQuery);
  const allChunks: MatchedChunk[] = [];
  const seenChunkIds = new Set<string>();

  if (isComparative) {
    console.log('Comparative question detected, performing targeted searches...');
    const targets = extractComparisonTargets(originalQuery);
    console.log('Comparison targets:', targets);

    if (targets.length >= 2) {
      // Recherche séparée pour chaque cible
      for (const target of targets) {
        const targetQuery = `${target} ${originalQuery.replace(/diff[ée]ren(ce|t|tes?)/gi, '').replace(/compare[rz]?/gi, '').replace(/entre/gi, '')}`;
        console.log(`Searching for target: "${target}" with query: "${targetQuery}"`);

        const embedding = await embedQuery(targetQuery, apiKey);
        const chunks = await searchChunks(supabase, userId, embedding, Math.ceil(topK / 2), documentId);

        chunks.forEach(chunk => {
          if (!seenChunkIds.has(chunk.chunk_id)) {
            seenChunkIds.add(chunk.chunk_id);
            allChunks.push(chunk);
          }
        });
      }

      // Recherche avec la requête originale aussi
      const originalEmbedding = await embedQuery(originalQuery, apiKey);
      const originalChunks = await searchChunks(supabase, userId, originalEmbedding, topK, documentId);

      originalChunks.forEach(chunk => {
        if (!seenChunkIds.has(chunk.chunk_id)) {
          seenChunkIds.add(chunk.chunk_id);
          allChunks.push(chunk);
        }
      });

      // Trier par similarité et limiter
      allChunks.sort((a, b) => b.similarity - a.similarity);
      return allChunks.slice(0, topK * 2); // Plus de résultats pour les questions comparatives
    }
  }

  // Mode FAST: recherche simple sans HyDE ni Query Rewriting
  if (searchMode === 'fast') {
    console.log('Fast mode: simple search without HyDE/Query Rewriting');
    const embedding = await embedQuery(originalQuery, apiKey);
    return await searchChunks(supabase, userId, embedding, topK, documentId);
  }

  // Mode PRECISE: HyDE + Query Rewriting
  console.log('Precise mode: using HyDE and Query Rewriting');

  // HyDE
  const hypotheticalAnswer = await generateHypotheticalAnswer(originalQuery, apiKey);
  console.log('HyDE answer generated');

  // Query Rewriting
  const queryVariants = await rewriteQuery(originalQuery, apiKey);
  console.log(`Query variants: ${queryVariants.length}`);

  // Combiner toutes les requêtes
  const allQueries = [
    originalQuery,
    `${originalQuery}\n\n${hypotheticalAnswer}`,
    ...queryVariants
  ];

  // Embeddings en batch
  const embeddings = await embedMultipleQueries(allQueries, apiKey);

  // Recherche avec chaque embedding
  for (const embedding of embeddings) {
    const chunks = await searchChunks(supabase, userId, embedding, topK, documentId);
    chunks.forEach(chunk => {
      if (!seenChunkIds.has(chunk.chunk_id)) {
        seenChunkIds.add(chunk.chunk_id);
        allChunks.push(chunk);
      }
    });
  }

  // Trier par similarité et limiter
  allChunks.sort((a, b) => b.similarity - a.similarity);
  return allChunks.slice(0, topK);
}

// ============================================================================
// RE-RANKING AVEC LLM
// ============================================================================

async function rerankChunks(
  chunks: MatchedChunk[],
  query: string,
  apiKey: string
): Promise<MatchedChunk[]> {
  if (chunks.length <= 2) {
    return chunks; // Pas besoin de re-ranking pour peu de résultats
  }

  const chunkSummaries = chunks.map((chunk, i) =>
    `[${i}] ${chunk.document_title}: ${chunk.content.substring(0, 200)}...`
  ).join('\n\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en pertinence documentaire. Classe les extraits par pertinence pour la question posée.
Réponds UNIQUEMENT avec les indices des extraits du plus pertinent au moins pertinent, séparés par des virgules.
Exemple: 2,0,3,1`
        },
        {
          role: 'user',
          content: `Question: ${query}\n\nExtraits:\n${chunkSummaries}`
        }
      ],
      max_tokens: 50,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    console.warn('Re-ranking failed, using original order');
    return chunks;
  }

  const data = await response.json();
  const rankingStr = data.choices[0]?.message?.content || '';
  const indices = rankingStr.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));

  if (indices.length === 0) {
    return chunks;
  }

  const reranked: MatchedChunk[] = [];
  const used = new Set<number>();

  for (const idx of indices) {
    if (idx >= 0 && idx < chunks.length && !used.has(idx)) {
      reranked.push(chunks[idx]);
      used.add(idx);
    }
  }

  // Ajouter les chunks non classés à la fin
  chunks.forEach((chunk, idx) => {
    if (!used.has(idx)) {
      reranked.push(chunk);
    }
  });

  return reranked;
}

// ============================================================================
// GÉNÉRATION DE LA RÉPONSE - PROMPTS OPTIMISÉS
// ============================================================================

function buildSystemPrompt(mode: ChatMode): string {
  if (mode === 'corpus_only') {
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

  const contextParts = chunks.map((chunk, index) => {
    const scopeLabel = chunk.scope === 'global' ? '📚 Document officiel' : '📄 Document personnel';
    return `━━━ Extrait ${index + 1} ━━━
${scopeLabel}
Titre : ${chunk.document_title}
Pertinence : ${(chunk.similarity * 100).toFixed(0)}%

${chunk.content}
━━━━━━━━━━━━━━━━`;
  });

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
      temperature: 0.3,
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
    const { data, error } = await supabase
      .from('rag_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      await supabase
        .from('rag_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return conversationId;
    }
  }

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
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

const chatHandler = async (req: Request): Promise<Response> => {
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Configuration serveur incomplète' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ChatRequest = await req.json();
    const {
      message,
      mode = 'corpus_only',
      searchMode = 'fast',
      conversationId,
      documentId,
      topK = CONFIG.defaultTopK,
    } = body;

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

    // Vérifier le solde de tokens AVANT de procéder
    const tokenCheck = await checkUserTokens(supabaseAdmin, user.id);
    if (!tokenCheck.hasEnoughTokens) {
      return new Response(
        JSON.stringify({
          error: tokenCheck.error,
          insufficientTokens: true,
          currentBalance: tokenCheck.currentBalance
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const actualTopK = Math.min(Math.max(1, topK), CONFIG.maxTopK);

    console.log(`Chat request from user ${user.id}, mode: ${mode}, searchMode: ${searchMode}, topK: ${actualTopK}`);

    // Vérifier les documents disponibles
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

    // ===== RECHERCHE HYBRIDE =====
    console.log(`Starting hybrid search (searchMode: ${searchMode})...`);
    let matchedChunks = await searchChunksHybrid(
      supabaseAdmin,
      user.id,
      message,
      searchMode,
      OPENAI_API_KEY,
      actualTopK,
      documentId
    );

    console.log(`Found ${matchedChunks.length} relevant chunks`);

    // Re-ranking uniquement en mode PRECISE
    if (searchMode === 'precise' && matchedChunks.length > 2) {
      console.log('Applying LLM re-ranking...');
      matchedChunks = await rerankChunks(matchedChunks, message, OPENAI_API_KEY);
    }

    // Limiter le nombre de chunks final
    matchedChunks = matchedChunks.slice(0, actualTopK);

    if (matchedChunks.length > 0) {
      matchedChunks.forEach((chunk, i) => {
        console.log(`  Chunk ${i + 1}: "${chunk.document_title}" (${chunk.scope || 'user'}) - similarity: ${(chunk.similarity * 100).toFixed(1)}%`);
      });
    }

    // Construire les prompts
    const systemPrompt = buildSystemPrompt(mode);
    const userPrompt = buildUserPrompt(message, matchedChunks, mode);

    // Générer la réponse
    console.log('Generating answer...');
    const { answer, tokensUsed } = await generateAnswer(
      systemPrompt,
      userPrompt,
      OPENAI_API_KEY
    );

    // DÉDUIRE LES TOKENS DU COMPTE UTILISATEUR
    const deductionResult = await deductUserTokens(supabaseAdmin, user.id, tokensUsed);

    if (!deductionResult.success) {
      console.error('Token deduction failed:', deductionResult.error);
    }

    // Préparer les sources
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

    // Gérer la conversation et sauvegarder les messages
    const actualConversationId = await getOrCreateConversation(
      supabaseAdmin,
      user.id,
      conversationId,
      mode,
      documentId
    );

    await saveMessage(
      supabaseAdmin,
      actualConversationId,
      user.id,
      'user',
      message
    );

    await saveMessage(
      supabaseAdmin,
      actualConversationId,
      user.id,
      'assistant',
      answer,
      sources,
      tokensUsed
    );

    // Retourner la réponse avec le nouveau solde
    const response: ChatResponse = {
      answer,
      sources,
      conversationId: actualConversationId,
      tokensUsed,
      tokensRemaining: deductionResult.newBalance,
      mode,
      searchMode,
    };

    console.log(`Chat completed (${searchMode} mode), ${tokensUsed} tokens used, ${deductionResult.newBalance} tokens remaining`);

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
