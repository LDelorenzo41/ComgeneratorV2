// supabase/functions/rag-chat/index.ts
// VERSION V5.1 "PRODUCTION SOTA"
// - Hybrid Search (Vector + FTS)
// - Cohere Reranking
// - HyDE automatique (si query courte)
// - RRF Fusion

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Retrieval
  vectorTopK: 30,
  ftsTopK: 30,
  rerankTopK: 8,
  similarityThreshold: 0.25,
  
  // Models
  embeddingModel: 'text-embedding-3-large',
  embeddingDimensions: 1536,
  chatModel: 'gpt-4o-mini',
  hydeModel: 'gpt-4o-mini',
  
  // Cohere
  cohereRerankModel: 'rerank-v3.5',
  
  // HyDE automatique
  hydeAutoThreshold: 50, // Active HyDE si query < 50 caractères
  
  // Limits
  maxHistoryMessages: 6,
  excerptLength: 700,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPES
// ============================================================================

type ChatMode = 'corpus_only' | 'corpus_plus_ai';

interface ChatRequest {
  message: string;
  mode?: ChatMode;
  conversationId?: string;
  documentId?: string;
  usePersonalCorpus?: boolean;
  useProfAssistCorpus?: boolean;
  useAI?: boolean;
  levels?: string[];
  subjects?: string[];
}

interface DocumentInfo {
  id: string;
  title: string;
  scope: string;
}

interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
  source: 'vector' | 'fts' | 'both';
}

interface RerankResult {
  chunk: RetrievedChunk;
  relevanceScore: number;
}

// ============================================================================
// CLIENTS
// ============================================================================

function createSupabaseClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// ============================================================================
// STEP 1: QUERY ANALYSIS & HyDE
// ============================================================================

/**
 * Détermine si HyDE doit être activé automatiquement
 */
function shouldUseHyDE(query: string): boolean {
  const trimmedLength = query.trim().length;
  return trimmedLength > 0 && trimmedLength < CONFIG.hydeAutoThreshold;
}

/**
 * HyDE: Génère un document hypothétique pour améliorer l'embedding
 */
async function generateHyDE(
  query: string,
  apiKey: string
): Promise<{ hydeText: string; tokensUsed: number }> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.hydeModel,
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en éducation française. 
Génère un court paragraphe (3-4 phrases) qui RÉPOND à la question de l'utilisateur, 
comme si tu citais un document officiel de l'Éducation Nationale.
Ne dis pas "je" ou "selon moi". Écris comme un texte de référence factuel.`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    const hydeText = data.choices?.[0]?.message?.content || query;
    const tokensUsed = data.usage?.total_tokens || 0;

    console.log(`[HyDE] Generated hypothetical document (${tokensUsed} tokens)`);
    return { hydeText, tokensUsed };
  } catch (error) {
    console.warn('[HyDE] Failed, using original query:', error);
    return { hydeText: query, tokensUsed: 0 };
  }
}

/**
 * Extrait les mots-clés significatifs pour la recherche FTS
 */
function extractSearchTerms(query: string): string {
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux',
    'ce', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
    'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
    'qui', 'que', 'quoi', 'dont', 'où', 'quand', 'comment', 'pourquoi',
    'est', 'sont', 'était', 'être', 'avoir', 'fait', 'faire',
    'pour', 'dans', 'avec', 'sur', 'sous', 'par', 'entre',
    'plus', 'moins', 'très', 'bien', 'aussi', 'encore',
    'tout', 'tous', 'toute', 'toutes', 'autre', 'autres',
    'quel', 'quelle', 'quels', 'quelles',
  ]);

  const words = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9àâäéèêëïîôùûüç-]+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  return [...new Set(words)].slice(0, 10).join(' ');
}

// ============================================================================
// STEP 2: DOCUMENT FILTERING
// ============================================================================

async function getAllowedDocuments(
  supabase: any,
  userId: string,
  options: {
    documentId?: string;
    usePersonalCorpus: boolean;
    useProfAssistCorpus: boolean;
    levels?: string[];
    subjects?: string[];
  }
): Promise<Map<string, DocumentInfo>> {
  const docsMap = new Map<string, DocumentInfo>();
  const { documentId, usePersonalCorpus, useProfAssistCorpus, levels, subjects } = options;

  if (!usePersonalCorpus && !useProfAssistCorpus) return docsMap;

  let query = supabase
    .from('rag_documents')
    .select('id, title, scope, user_id, levels, subjects')
    .eq('status', 'ready');

  if (documentId) {
    query = query.eq('id', documentId);
  } else {
    if (usePersonalCorpus && useProfAssistCorpus) {
      query = query.or(`scope.eq.global,and(scope.eq.user,user_id.eq.${userId})`);
    } else if (useProfAssistCorpus) {
      query = query.eq('scope', 'global');
    } else if (usePersonalCorpus) {
      query = query.eq('scope', 'user').eq('user_id', userId);
    }
  }

  if (levels?.length) {
    query = query.overlaps('levels', levels);
  }
  if (subjects?.length) {
    query = query.overlaps('subjects', subjects);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Documents] Query error:', error);
    return docsMap;
  }

  if (!data || data.length === 0) {
    console.log('[Documents] Filters too strict, removing metadata filters...');
    
    let fallbackQuery = supabase
      .from('rag_documents')
      .select('id, title, scope')
      .eq('status', 'ready');

    if (documentId) {
      fallbackQuery = fallbackQuery.eq('id', documentId);
    } else if (usePersonalCorpus && useProfAssistCorpus) {
      fallbackQuery = fallbackQuery.or(`scope.eq.global,and(scope.eq.user,user_id.eq.${userId})`);
    } else if (useProfAssistCorpus) {
      fallbackQuery = fallbackQuery.eq('scope', 'global');
    } else if (usePersonalCorpus) {
      fallbackQuery = fallbackQuery.eq('scope', 'user').eq('user_id', userId);
    }

    const { data: fallbackData } = await fallbackQuery;
    fallbackData?.forEach((d: any) => docsMap.set(d.id, d));
    return docsMap;
  }

  data.forEach((d: any) => docsMap.set(d.id, d));
  console.log(`[Documents] ${docsMap.size} documents allowed`);
  return docsMap;
}

// ============================================================================
// STEP 3: HYBRID RETRIEVAL
// ============================================================================

async function searchByVector(
  supabase: any,
  userId: string,
  embedding: number[],
  allowedDocIds: string[]
): Promise<RetrievedChunk[]> {
  if (allowedDocIds.length === 0) return [];

  const { data, error } = await supabase.rpc('match_rag_chunks', {
    p_query_embedding: `[${embedding.join(',')}]`,
    p_similarity_threshold: CONFIG.similarityThreshold,
    p_match_count: CONFIG.vectorTopK,
    p_user_id: userId,
    p_document_id: null,
  });

  if (error) {
    console.error('[Vector Search] Error:', error);
    return [];
  }

  const allowedSet = new Set(allowedDocIds);
  return (data || [])
    .filter((item: any) => allowedSet.has(item.document_id))
    .map((item: any) => ({
      id: item.id,
      documentId: item.document_id,
      documentTitle: item.document_title || '',
      chunkIndex: item.chunk_index,
      content: item.content,
      score: item.similarity,
      source: 'vector' as const,
    }));
}

async function searchByFTS(
  supabase: any,
  searchTerms: string,
  allowedDocIds: string[]
): Promise<RetrievedChunk[]> {
  if (allowedDocIds.length === 0 || !searchTerms.trim()) return [];

  const { data, error } = await supabase.rpc('search_rag_chunks_fts', {
    p_query: searchTerms,
    p_document_ids: allowedDocIds,
    p_limit: CONFIG.ftsTopK,
  });

  if (error) {
    console.error('[FTS Search] Error:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    documentId: item.document_id,
    documentTitle: '',
    chunkIndex: item.chunk_index,
    content: item.content,
    score: item.rank,
    source: 'fts' as const,
  }));
}

async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.embeddingModel,
      input: text.replace(/\n/g, ' ').substring(0, 8000),
      dimensions: CONFIG.embeddingDimensions,
    }),
  });

  const data = await response.json();
  if (!data.data?.[0]?.embedding) {
    throw new Error('Failed to create embedding');
  }
  return data.data[0].embedding;
}

// ============================================================================
// STEP 4: RRF FUSION
// ============================================================================

function fuseWithRRF(
  vectorResults: RetrievedChunk[],
  ftsResults: RetrievedChunk[],
  docsMap: Map<string, DocumentInfo>,
  k: number = 60
): RetrievedChunk[] {
  const rrfScores = new Map<string, number>();
  const chunkMap = new Map<string, RetrievedChunk>();

  const processList = (list: RetrievedChunk[], sourceType: 'vector' | 'fts') => {
    list.forEach((item, rank) => {
      if (!item.documentTitle && docsMap.has(item.documentId)) {
        item.documentTitle = docsMap.get(item.documentId)!.title;
      }

      const existing = chunkMap.get(item.id);
      if (!existing) {
        chunkMap.set(item.id, item);
      } else if (item.score > existing.score) {
        chunkMap.set(item.id, { ...existing, score: item.score, source: 'both' });
      } else if (existing.source !== item.source) {
        chunkMap.set(item.id, { ...existing, source: 'both' });
      }

      const currentRRF = rrfScores.get(item.id) || 0;
      rrfScores.set(item.id, currentRRF + (1 / (k + rank + 1)));
    });
  };

  processList(vectorResults, 'vector');
  processList(ftsResults, 'fts');

  return Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, rrfScore]) => {
      const chunk = chunkMap.get(id)!;
      return { ...chunk, score: rrfScore };
    });
}

// ============================================================================
// STEP 5: COHERE RERANKING
// ============================================================================

async function rerankWithCohere(
  query: string,
  candidates: RetrievedChunk[],
  topK: number
): Promise<RerankResult[]> {
  const cohereApiKey = Deno.env.get('COHERE_API_KEY');
  
  if (!cohereApiKey) {
    console.warn('[Rerank] No COHERE_API_KEY, skipping reranking');
    return candidates.slice(0, topK).map(chunk => ({
      chunk,
      relevanceScore: chunk.score,
    }));
  }

  if (candidates.length === 0) {
    return [];
  }

  try {
    const documents = candidates.map(c => c.content.substring(0, 2000));

    const response = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cohereApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.cohereRerankModel,
        query: query,
        documents: documents,
        top_n: topK,
        return_documents: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Rerank] Cohere API error:', response.status, errorText);
      return candidates.slice(0, topK).map(chunk => ({
        chunk,
        relevanceScore: chunk.score,
      }));
    }

    const data = await response.json();
    console.log(`[Rerank] Cohere returned ${data.results?.length || 0} results`);

    return (data.results || []).map((result: any) => ({
      chunk: candidates[result.index],
      relevanceScore: result.relevance_score,
    }));
  } catch (error) {
    console.error('[Rerank] Error:', error);
    return candidates.slice(0, topK).map(chunk => ({
      chunk,
      relevanceScore: chunk.score,
    }));
  }
}

// ============================================================================
// STEP 6: RESPONSE GENERATION
// ============================================================================

async function generateResponse(
  query: string,
  rerankResults: RerankResult[],
  mode: ChatMode,
  history: any[],
  apiKey: string
): Promise<{ answer: string; tokensUsed: number }> {
  if (rerankResults.length === 0) {
    return {
      answer: "Je n'ai pas trouvé d'information pertinente dans les documents disponibles.",
      tokensUsed: 0,
    };
  }

  const context = rerankResults
    .map((r, i) => `[Source ${i + 1}] (${r.chunk.documentTitle})\n${r.chunk.content}`)
    .join('\n\n---\n\n');

  const allowAI = mode === 'corpus_plus_ai';

  const systemPrompt = `Tu es un assistant pédagogique expert pour les enseignants français.

SOURCES DOCUMENTAIRES :
${context}

INSTRUCTIONS :
1. Base ta réponse PRIORITAIREMENT sur les Sources ci-dessus.
2. Cite systématiquement les sources utilisées : [Source 1], [Source 2], etc.
3. Structure ta réponse avec des titres (##) et des puces (-) pour la lisibilité.
4. Si plusieurs sources se complètent, synthétise-les intelligemment.
${allowAI 
  ? `5. Si les sources sont insuffisantes, tu PEUX compléter avec tes connaissances générales, mais SIGNALE-LE clairement avec "💡 Complément IA :".` 
  : `5. Si l'information n'est pas dans les sources, dis-le clairement. Ne fabrique PAS d'information.`}

Réponds en français, de manière professionnelle et pédagogique.`;

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
        ...history.slice(-CONFIG.maxHistoryMessages),
        { role: 'user', content: query },
      ],
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  return {
    answer: data.choices?.[0]?.message?.content || 'Erreur lors de la génération de la réponse.',
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

// ============================================================================
// STEP 7: TOKEN MANAGEMENT
// ============================================================================

async function deductTokens(
  serviceClient: any,
  userId: string,
  tokensUsed: number
): Promise<void> {
  if (tokensUsed <= 0) return;

  const { data } = await serviceClient
    .from('profiles')
    .select('tokens')
    .eq('user_id', userId)
    .single();

  if (data) {
    await serviceClient
      .from('profiles')
      .update({ tokens: Math.max(0, data.tokens - tokensUsed) })
      .eq('user_id', userId);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

async function chatHandler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const startTime = Date.now();

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }

    const supabase = createSupabaseClient(authHeader);
    const serviceClient = createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const body = await req.json() as ChatRequest;
    const {
      message,
      conversationId,
      documentId,
      usePersonalCorpus = true,
      useProfAssistCorpus = true,
      useAI = false,
      levels,
      subjects,
    } = body;

    const effectiveMode: ChatMode = useAI ? 'corpus_plus_ai' : 'corpus_only';
    let totalTokensUsed = 0;

    // Déterminer automatiquement si HyDE est nécessaire
    const useHyDE = shouldUseHyDE(message);
    console.log(`[rag-chat] Query: "${message.substring(0, 50)}..." | HyDE: ${useHyDE} | AI: ${useAI}`);

    // ========== STEP 1: Get allowed documents ==========
    const docsMap = await getAllowedDocuments(serviceClient, user.id, {
      documentId,
      usePersonalCorpus,
      useProfAssistCorpus,
      levels,
      subjects,
    });

    const allowedDocIds = Array.from(docsMap.keys());

    // ========== CAS: Aucun document, IA seule ==========
    if (allowedDocIds.length === 0) {
      if (useAI) {
        let convId = conversationId;
        if (!convId) {
          const { data } = await serviceClient
            .from('rag_conversations')
            .insert({ user_id: user.id })
            .select('id')
            .single();
          convId = data?.id;
        }

        const { data: history } = await serviceClient
          .from('rag_messages')
          .select('role, content')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(CONFIG.maxHistoryMessages);

        await serviceClient.from('rag_messages').insert({
          conversation_id: convId,
          role: 'user',
          content: message,
        });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: CONFIG.chatModel,
            messages: [
              {
                role: 'system',
                content: 'Tu es un assistant pédagogique. Réponds selon tes connaissances générales. Précise que ta réponse ne provient pas de documents officiels.',
              },
              ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
              { role: 'user', content: message },
            ],
            temperature: 0.4,
          }),
        });

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || 'Erreur.';
        const tokensUsed = data.usage?.total_tokens || 0;

        await serviceClient.from('rag_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: answer,
          sources: [],
        });

        await deductTokens(serviceClient, user.id, tokensUsed);

        return new Response(
          JSON.stringify({
            answer,
            sources: [],
            conversationId: convId,
            tokensUsed,
            mode: 'ai_only',
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          answer: "Aucun document accessible. Activez un corpus ou l'option IA.",
          sources: [],
          tokensUsed: 0,
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // ========== STEP 2: Query Processing (HyDE automatique) ==========
    let queryForEmbedding = message;
    
    if (useHyDE) {
      const hydeResult = await generateHyDE(message, OPENAI_API_KEY);
      queryForEmbedding = hydeResult.hydeText;
      totalTokensUsed += hydeResult.tokensUsed;
    }

    const searchTerms = extractSearchTerms(message);
    console.log(`[FTS] Search terms: "${searchTerms}"`);

    // ========== STEP 3: Hybrid Retrieval (parallel) ==========
    const [embedding, ftsResults] = await Promise.all([
      createEmbedding(queryForEmbedding, OPENAI_API_KEY),
      searchByFTS(serviceClient, searchTerms, allowedDocIds),
    ]);

    const vectorResults = await searchByVector(serviceClient, user.id, embedding, allowedDocIds);

    console.log(`[Retrieval] Vector: ${vectorResults.length} | FTS: ${ftsResults.length}`);

    // ========== STEP 4: RRF Fusion ==========
    const fusedResults = fuseWithRRF(vectorResults, ftsResults, docsMap);
    console.log(`[Fusion] ${fusedResults.length} unique chunks after RRF`);

    // ========== STEP 5: Reranking ==========
    const rerankResults = await rerankWithCohere(
      message,
      fusedResults.slice(0, 30),
      CONFIG.rerankTopK
    );

    console.log(`[Rerank] Top result: "${rerankResults[0]?.chunk.documentTitle}" (score: ${rerankResults[0]?.relevanceScore.toFixed(3)})`);

    // ========== STEP 6: Conversation Management ==========
    let convId = conversationId;
    if (!convId) {
      const { data } = await serviceClient
        .from('rag_conversations')
        .insert({ user_id: user.id })
        .select('id')
        .single();
      convId = data?.id;
    }

    const { data: history } = await serviceClient
      .from('rag_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(CONFIG.maxHistoryMessages);

    await serviceClient.from('rag_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // ========== STEP 7: Response Generation ==========
    const { answer, tokensUsed } = await generateResponse(
      message,
      rerankResults,
      effectiveMode,
      history || [],
      OPENAI_API_KEY
    );

    totalTokensUsed += tokensUsed;

    // Format sources for response (index 1-based pour correspondre aux citations)
    const sources = rerankResults.map((r, index) => ({
      sourceIndex: index + 1, // [Source 1], [Source 2], etc.
      documentId: r.chunk.documentId,
      documentTitle: r.chunk.documentTitle,
      chunkId: r.chunk.id,
      chunkIndex: r.chunk.chunkIndex,
      excerpt: r.chunk.content.substring(0, CONFIG.excerptLength),
    }));

    await serviceClient.from('rag_messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: answer,
      sources,
    });

    await deductTokens(serviceClient, user.id, totalTokensUsed);

    const duration = Date.now() - startTime;
    console.log(`[rag-chat] Completed in ${duration}ms | Tokens: ${totalTokensUsed}`);

    return new Response(
      JSON.stringify({
        answer,
        sources,
        conversationId: convId,
        tokensUsed: totalTokensUsed,
        mode: effectiveMode,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[rag-chat] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
}

Deno.serve(chatHandler);
