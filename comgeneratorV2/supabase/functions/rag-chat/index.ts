// supabase/functions/rag-chat/index.ts
// Edge Function pour le chat RAG avec:
// - Mode de recherche: Rapide (économique) / Précis (complet)
// - Query Rewriting amélioré pour questions comparatives
// - HyDE (Hypothetical Document Embeddings)
// - Re-ranking LLM
// - text-embedding-3-large (dimensions réduites à 1536)
// - Déduction des tokens du compte utilisateur
// - Citation des sources dans les réponses

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Recherche
  defaultTopK: 8,
  maxTopK: 15,
  similarityThreshold: 0.30,
  
  // Modèles
  chatModel: 'gpt-4o-mini',
  embeddingModel: 'text-embedding-3-large',
  embeddingDimensions: 1536,
  
  // Query Rewriting
  queryRewritingModel: 'gpt-4o-mini',
  
  // HyDE (Hypothetical Document Embeddings)
  hydeModel: 'gpt-4o-mini',
  
  // Re-ranking
  rerankingModel: 'gpt-4o-mini',
  rerankingChunkCount: 20,
  finalChunkCount: 10,
  
  // Historique
  maxHistoryMessages: 10,
  
  // Sources
  excerptLength: 400,
};

// ============================================================================
// TYPES
// ============================================================================

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

interface MatchedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
  scope?: 'global' | 'user';
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
  tokensRemaining?: number;
  mode: ChatMode;
  searchMode: SearchMode;
}

// ============================================================================
// HELPERS - CORS & AUTH
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function createSupabaseClient(authHeader: string) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function createServiceClient() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, serviceRoleKey);
}

// ============================================================================
// DÉTECTION DE QUESTION COMPARATIVE
// ============================================================================

function isComparativeQuestion(query: string): boolean {
  const comparativePatterns = [
    /diff[ée]ren/i,
    /compar/i,
    /entre.+et/i,
    /versus|vs/i,
    /par rapport/i,
    /contrairement/i,
    /similitude/i,
    /commun/i,
    /cycle\s*\d.+cycle\s*\d/i,
  ];
  return comparativePatterns.some(p => p.test(query));
}

function extractComparisonTargets(query: string): string[] {
  const targets: string[] = [];
  
  const cycleMatches = query.match(/cycle\s*(\d)/gi);
  if (cycleMatches) {
    const seenNums = new Set<string>();
    for (const match of cycleMatches) {
      const num = match.match(/\d/)?.[0];
      if (num && !seenNums.has(num)) {
        seenNums.add(num);
        targets.push(`cycle_${num}`);
      }
    }
  }
  
  return targets;
}

// ============================================================================
// HyDE: HYPOTHETICAL DOCUMENT EMBEDDINGS
// ============================================================================

async function generateHypotheticalAnswer(
  query: string,
  apiKey: string
): Promise<{ hypotheticalAnswer: string; tokensUsed: number }> {
  const isComparative = isComparativeQuestion(query);
  const targets = extractComparisonTargets(query);

  console.log(`[rag-chat] HyDE: Generating for "${query.substring(0, 50)}..." (comparative: ${isComparative})`);

  let prompt: string;
  
  if (isComparative && targets.length >= 2) {
    prompt = `Tu es un expert en programmes scolaires français. Génère une réponse comparative détaillée.

Question: "${query}"

IMPORTANT pour cette question COMPARATIVE:
- Compare explicitement ${targets.map(t => t.replace('_', ' ')).join(' et ')}
- Structure la réponse avec les spécificités de CHAQUE niveau/cycle
- Utilise le vocabulaire officiel (compétences, attendus, objectifs, etc.)
- Mentionne les différences ET les points communs
- 200-400 mots

Réponse hypothétique structurée:`;
  } else {
    prompt = `Tu es un expert en éducation nationale française. Génère une réponse complète et détaillée.

Question: "${query}"

IMPORTANT:
- Écris une réponse factuelle et structurée
- Utilise le vocabulaire officiel de l'Éducation Nationale
- Inclus des termes spécifiques (cycles, compétences, attendus, programmes)
- 150-300 mots

Réponse hypothétique:`;
  }

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
            content: 'Tu es un assistant expert en programmes scolaires français. Tu génères des réponses détaillées basées sur les textes officiels.' 
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      console.warn('[rag-chat] HyDE generation failed, using original query');
      return { hypotheticalAnswer: query, tokensUsed: 0 };
    }

    const data = await response.json();
    const hypotheticalAnswer = data.choices[0]?.message?.content || query;
    const tokensUsed = data.usage?.total_tokens || 0;

    console.log(`[rag-chat] HyDE: Generated ${hypotheticalAnswer.length} chars`);

    return { hypotheticalAnswer, tokensUsed };
  } catch (error) {
    console.warn('[rag-chat] HyDE error:', error);
    return { hypotheticalAnswer: query, tokensUsed: 0 };
  }
}

// ============================================================================
// QUERY REWRITING
// ============================================================================

async function rewriteQueryForSearch(
  query: string,
  apiKey: string
): Promise<{ queries: string[]; tokensUsed: number }> {
  const isComparative = isComparativeQuestion(query);
  const targets = extractComparisonTargets(query);

  console.log(`[rag-chat] Query Rewriting: "${query.substring(0, 50)}..."`);

  let prompt: string;
  
  if (isComparative && targets.length >= 2) {
    prompt = `Tu es un expert en recherche documentaire pour l'éducation nationale.

Question COMPARATIVE originale: "${query}"

Cette question compare: ${targets.map(t => t.replace('_', ' ')).join(' et ')}

Génère des requêtes de recherche SÉPARÉES:
1. Des requêtes spécifiques pour ${targets[0]?.replace('_', ' ')}
2. Des requêtes spécifiques pour ${targets[1]?.replace('_', ' ')}
3. Des requêtes sur le thème général (sans filtre de niveau)

Inclus les termes: EPS, éducation physique, objectifs, compétences, attendus, programmes

Réponds UNIQUEMENT avec un JSON:
{"queries": ["requête 1", "requête 2", ...]}

Génère 5-6 requêtes variées.`;
  } else {
    prompt = `Tu es un expert en éducation nationale française. Reformule cette question pour la recherche documentaire.

Question: "${query}"

Génère 3-4 reformulations avec:
1. Termes officiels de l'Éducation Nationale
2. Synonymes pertinents
3. Niveaux scolaires précisés
4. Abréviations ET formes longues (EPS/éducation physique)

Réponds en JSON: {"queries": ["reformulation 1", "reformulation 2", ...]}`;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.queryRewritingModel,
        messages: [
          { role: 'system', content: 'Tu génères des requêtes de recherche. Réponds uniquement en JSON valide.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      console.warn('[rag-chat] Query Rewriting failed');
      return { queries: [query], tokensUsed: 0 };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const queries = [query, ...(parsed.queries || [])];
      console.log(`[rag-chat] Query variations: ${queries.length}`);
      return { queries: queries.slice(0, 7), tokensUsed };
    }

    return { queries: [query], tokensUsed };
  } catch (error) {
    console.warn('[rag-chat] Query Rewriting error:', error);
    return { queries: [query], tokensUsed: 0 };
  }
}

// ============================================================================
// RE-RANKING
// ============================================================================

async function rerankChunksWithLLM(
  query: string,
  chunks: MatchedChunk[],
  topN: number,
  apiKey: string
): Promise<{ chunks: MatchedChunk[]; tokensUsed: number }> {
  if (chunks.length === 0) {
    return { chunks: [], tokensUsed: 0 };
  }

  if (chunks.length <= topN) {
    return { chunks, tokensUsed: 0 };
  }

  console.log(`[rag-chat] Re-ranking ${chunks.length} chunks...`);

  const excerpts = chunks.slice(0, 20).map((chunk, index) => ({
    id: index,
    title: chunk.documentTitle,
    text: chunk.content.substring(0, 600),
  }));

  const prompt = `Évalue la pertinence de chaque extrait pour cette question.

Question: "${query}"

Extraits:
${excerpts.map(e => `[${e.id}] (${e.title})\n${e.text}`).join('\n\n---\n\n')}

Score 0-10:
- 10 = Répond directement avec infos spécifiques
- 7-9 = Contient la réponse
- 4-6 = Partiellement pertinent
- 1-3 = Marginalement lié
- 0 = Hors sujet

JSON: {"scores": [{"id": 0, "score": 8}, ...]}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.rerankingModel,
        messages: [
          { role: 'system', content: 'Tu évalues la pertinence documentaire. Réponds en JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      return { chunks: chunks.slice(0, topN), tokensUsed: 0 };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const scores = parsed.scores || [];

      const scoreMap = new Map<number, number>();
      for (const s of scores) {
        scoreMap.set(s.id, s.score);
      }

      const rerankedChunks = chunks
        .slice(0, 20)
        .map((chunk, index) => ({
          ...chunk,
          rerankScore: scoreMap.get(index) ?? 0,
        }))
        .filter(c => c.rerankScore >= 3)
        .sort((a, b) => b.rerankScore - a.rerankScore)
        .slice(0, topN);

      console.log(`[rag-chat] Re-ranked: ${rerankedChunks.length} chunks with score >= 3`);

      return { chunks: rerankedChunks, tokensUsed };
    }

    return { chunks: chunks.slice(0, topN), tokensUsed };
  } catch (error) {
    console.warn('[rag-chat] Re-ranking error:', error);
    return { chunks: chunks.slice(0, topN), tokensUsed: 0 };
  }
}

// ============================================================================
// EXTRACTION DE TERMES-CLÉS
// ============================================================================

function extractKeyTerms(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const terms: string[] = [];

  const mappings: Record<string, string[]> = {
    'maternelle': ['maternelle', 'cycle 1'],
    'cycle 1': ['maternelle', 'cycle 1'],
    'cycle 2': ['cycle 2', 'CP', 'CE1', 'CE2'],
    'cycle 3': ['cycle 3', 'CM1', 'CM2', '6e', '6ème'],
    'cycle 4': ['cycle 4', '5e', '4e', '3e', 'collège'],
    'collège': ['collège', 'cycle 3', 'cycle 4'],
    'eps': ['EPS', 'éducation physique', 'sport', 'activité physique', 'champ d\'apprentissage'],
    'éducation physique': ['EPS', 'éducation physique', 'sport'],
    'sport': ['EPS', 'sport', 'activité physique'],
    'objectif': ['objectif', 'attendu', 'compétence', 'visée'],
    'compétence': ['compétence', 'attendu', 'objectif'],
    'différence': ['spécificité', 'particularité', 'évolution', 'progression'],
  };

  for (const [key, values] of Object.entries(mappings)) {
    if (lowerQuery.includes(key)) {
      terms.push(...values);
    }
  }

  return [...new Set(terms)];
}

// ============================================================================
// RECHERCHE VECTORIELLE
// ============================================================================

async function searchByVector(
  supabase: any,
  userId: string,
  embedding: number[],
  topK: number,
  documentId?: string
): Promise<MatchedChunk[]> {
  try {
    const { data, error } = await supabase.rpc('match_rag_chunks', {
      p_query_embedding: `[${embedding.join(',')}]`,
      p_similarity_threshold: CONFIG.similarityThreshold,
      p_match_count: topK,
      p_user_id: userId,
      p_document_id: documentId || null,
    });

    if (error) {
      console.error('[rag-chat] Vector search error:', error);
      return [];
    }

    console.log(`[rag-chat] Vector search returned ${data?.length || 0} chunks`);

    return (data || []).map((item: any) => ({
      id: item.id,
      documentId: item.document_id,
      documentTitle: item.document_title,
      chunkIndex: item.chunk_index,
      content: item.content,
      score: item.similarity,
      scope: item.scope,
    }));
  } catch (err) {
    console.error('[rag-chat] Vector search exception:', err);
    return [];
  }
}

// ============================================================================
// RECHERCHE PAR MOTS-CLÉS
// ============================================================================

async function searchByKeywords(
  supabase: any,
  userId: string,
  keywords: string[],
  limit: number = 10
): Promise<MatchedChunk[]> {
  if (keywords.length === 0) return [];

  const chunkScores = new Map<string, { chunk: MatchedChunk; score: number }>();

  for (const keyword of keywords.slice(0, 6)) {
    try {
      const { data: docs } = await supabase
        .from('rag_documents')
        .select('id, title, scope')
        .or(`scope.eq.global,user_id.eq.${userId}`)
        .eq('status', 'ready')
        .ilike('title', `%${keyword}%`)
        .limit(5);

      if (docs && docs.length > 0) {
        for (const doc of docs) {
          const { data: chunks } = await supabase
            .from('rag_chunks')
            .select('id, document_id, chunk_index, content, scope')
            .eq('document_id', doc.id)
            .limit(8);

          if (chunks) {
            for (const chunk of chunks) {
              const key = chunk.id;
              const existing = chunkScores.get(key);
              if (existing) {
                existing.score += 1;
              } else {
                chunkScores.set(key, {
                  chunk: {
                    id: chunk.id,
                    documentId: doc.id,
                    documentTitle: doc.title,
                    chunkIndex: chunk.chunk_index,
                    content: chunk.content,
                    score: 0.85,
                    scope: chunk.scope || doc.scope,
                  },
                  score: 1,
                });
              }
            }
          }
        }
      }

      const { data: contentChunks } = await supabase
        .from('rag_chunks')
        .select(`
          id, document_id, chunk_index, content, scope,
          rag_documents!inner(id, title, scope, user_id)
        `)
        .or(`scope.eq.global,rag_documents.user_id.eq.${userId}`)
        .ilike('content', `%${keyword}%`)
        .limit(5);

      if (contentChunks) {
        for (const chunk of contentChunks) {
          const key = chunk.id;
          const existing = chunkScores.get(key);
          const doc = chunk.rag_documents;
          if (existing) {
            existing.score += 0.5;
          } else {
            chunkScores.set(key, {
              chunk: {
                id: chunk.id,
                documentId: doc.id,
                documentTitle: doc.title,
                chunkIndex: chunk.chunk_index,
                content: chunk.content,
                score: 0.8,
                scope: chunk.scope || doc.scope,
              },
              score: 0.5,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[rag-chat] Keyword search error for "${keyword}":`, err);
    }
  }

  const results = Array.from(chunkScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.chunk);

  console.log(`[rag-chat] Keyword search: ${results.length} chunks`);
  return results;
}

// ============================================================================
// RECHERCHE HYBRIDE - AVEC SUPPORT QUESTIONS COMPARATIVES
// ============================================================================

async function searchChunksHybrid(
  supabase: any,
  userId: string,
  originalQuery: string,
  queryVariations: string[],
  hydeEmbedding: number[],
  queryEmbedding: number[],
  topK: number,
  useHyDE: boolean,
  documentId?: string
): Promise<MatchedChunk[]> {
  const allChunks: MatchedChunk[] = [];
  const seenIds = new Set<string>();

  const isComparative = isComparativeQuestion(originalQuery);
  const targets = extractComparisonTargets(originalQuery);

  console.log(`[rag-chat] Search: comparative=${isComparative}, targets=${targets.join(', ')}`);

  // ========== STRATÉGIE POUR QUESTIONS COMPARATIVES ==========
  if (isComparative && targets.length >= 2) {
    console.log(`[rag-chat] Comparative search for: ${targets.join(' vs ')}`);
    
    for (const target of targets) {
      console.log(`[rag-chat] Searching for: ${target}`);
      
      // Recherche par titre de document
      const { data: docs } = await supabase
        .from('rag_documents')
        .select('id, title, scope')
        .or(`scope.eq.global,user_id.eq.${userId}`)
        .eq('status', 'ready')
        .ilike('title', `%${target}%`);
      
      if (docs && docs.length > 0) {
        console.log(`[rag-chat] Found ${docs.length} docs for "${target}"`);
        
        for (const doc of docs) {
          const { data: chunks } = await supabase
            .from('rag_chunks')
            .select('id, document_id, chunk_index, content, scope')
            .eq('document_id', doc.id)
            .order('chunk_index', { ascending: true })
            .limit(Math.ceil(topK / targets.length) + 3);
          
          if (chunks) {
            for (const chunk of chunks) {
              if (!seenIds.has(chunk.id)) {
                seenIds.add(chunk.id);
                allChunks.push({
                  id: chunk.id,
                  documentId: doc.id,
                  documentTitle: doc.title,
                  chunkIndex: chunk.chunk_index,
                  content: chunk.content,
                  score: 0.90,
                  scope: chunk.scope || doc.scope,
                });
              }
            }
          }
        }
      }
    }
    
    // Compléter avec recherche vectorielle
    if (queryEmbedding.length > 0) {
      const vectorChunks = await searchByVector(supabase, userId, queryEmbedding, topK, documentId);
      for (const chunk of vectorChunks) {
        if (!seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          allChunks.push(chunk);
        }
      }
    }
    
    console.log(`[rag-chat] Comparative search total: ${allChunks.length} chunks`);
  }
  // ========== STRATÉGIE STANDARD ==========
  else {
    // 1. Recherche par mots-clés
    for (const query of queryVariations.slice(0, 4)) {
      const terms = extractKeyTerms(query);
      if (terms.length > 0) {
        const keywordChunks = await searchByKeywords(supabase, userId, terms, 8);
        for (const chunk of keywordChunks) {
          if (!seenIds.has(chunk.id)) {
            seenIds.add(chunk.id);
            allChunks.push(chunk);
          }
        }
      }
    }

    // 2. Recherche vectorielle HyDE
    if (useHyDE && hydeEmbedding.length > 0) {
      const hydeChunks = await searchByVector(supabase, userId, hydeEmbedding, topK * 2, documentId);
      for (const chunk of hydeChunks) {
        if (!seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          chunk.score = Math.min(1, chunk.score * 1.1);
          allChunks.push(chunk);
        }
      }
    }

    // 3. Recherche vectorielle standard
    const vectorChunks = await searchByVector(supabase, userId, queryEmbedding, topK * 2, documentId);
    for (const chunk of vectorChunks) {
      if (!seenIds.has(chunk.id)) {
        seenIds.add(chunk.id);
        allChunks.push(chunk);
      }
    }
  }

  console.log(`[rag-chat] Final combined: ${allChunks.length} unique chunks`);

  return allChunks.sort((a, b) => b.score - a.score);
}

// ============================================================================
// EMBEDDINGS
// ============================================================================

async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.embeddingModel,
      input: text,
      dimensions: CONFIG.embeddingDimensions,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur embedding: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ============================================================================
// GÉNÉRATION DE RÉPONSE
// ============================================================================

async function generateResponse(
  query: string,
  chunks: MatchedChunk[],
  mode: ChatMode,
  history: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<{ answer: string; tokensUsed: number }> {
  
  if (chunks.length === 0) {
    return {
      answer: "Je n'ai pas trouvé d'information pertinente dans les documents disponibles pour répondre à cette question. Essayez de reformuler votre question ou vérifiez que les documents appropriés ont été importés.",
      tokensUsed: 0,
    };
  }

  const context = chunks
    .map((chunk, i) => {
      const scopeLabel = chunk.scope === 'global' ? '📚' : '📄';
      return `[Source ${i + 1}] ${scopeLabel} ${chunk.documentTitle}\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  let systemPrompt: string;

  if (mode === 'corpus_only') {
    systemPrompt = `Tu es un assistant pédagogique pour les enseignants français. Tu réponds UNIQUEMENT à partir des documents fournis.

RÈGLES STRICTES:
1. Réponds UNIQUEMENT avec les informations des sources fournies
2. CITE OBLIGATOIREMENT les sources utilisées avec le format [Source X] ou [Titre du document]
3. Si l'information n'est pas dans les sources, dis: "Cette information n'est pas présente dans les documents disponibles."
4. Structure ta réponse clairement (titres, listes à puces)
5. Pour les questions comparatives, organise par niveau/cycle

IMPORTANT: Chaque affirmation doit être liée à une source.`;
  } else {
    systemPrompt = `Tu es un assistant pédagogique expert. Tu utilises les documents fournis comme base, complétés par tes connaissances.

RÈGLES:
1. Commence TOUJOURS par les informations des sources (prioritaires)
2. CITE les sources avec [Source X] ou [Titre du document]
3. Marque tes compléments avec [Complément IA]
4. Structure clairement la réponse

Pour les questions comparatives, organise par niveau/cycle.`;
  }

  const userPrompt = `DOCUMENTS DISPONIBLES:
${context}

---

QUESTION: ${query}

Réponds en citant systématiquement les sources utilisées.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-CONFIG.maxHistoryMessages),
    { role: 'user', content: userPrompt },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.chatModel,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur génération: ${error}`);
  }

  const data = await response.json();
  return {
    answer: data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer de réponse.',
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

// ============================================================================
// GESTION DES CONVERSATIONS
// ============================================================================

async function getOrCreateConversation(
  supabase: any,
  userId: string,
  conversationId?: string
): Promise<string> {
  if (conversationId) {
    const { data } = await supabase
      .from('rag_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (data) return conversationId;
  }

  const { data, error } = await supabase
    .from('rag_conversations')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (error) throw new Error('Impossible de créer la conversation');
  return data.id;
}

async function getConversationHistory(
  supabase: any,
  conversationId: string
): Promise<Array<{ role: string; content: string }>> {
  const { data } = await supabase
    .from('rag_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(CONFIG.maxHistoryMessages * 2);

  return data || [];
}

async function saveMessage(
  supabase: any,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  sources?: SourceChunk[]
): Promise<void> {
  await supabase.from('rag_messages').insert({
    conversation_id: conversationId,
    role,
    content,
    sources: sources || null,
  });
}

// ============================================================================
// GESTION DES TOKENS
// ============================================================================

async function checkAndDeductUserTokens(
  supabase: any,
  userId: string,
  tokensToDeduct: number
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  try {
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('user_id', userId)
      .single();

    if (fetchError || !profile) {
      console.error('[rag-chat] Error fetching profile:', fetchError);
      return { success: false, newBalance: 0, error: 'Profil non trouvé' };
    }

    const currentBalance = profile.tokens || 0;

    if (currentBalance < tokensToDeduct) {
      return { 
        success: false, 
        newBalance: currentBalance, 
        error: `Tokens insuffisants (${currentBalance} disponibles)` 
      };
    }

    const newBalance = currentBalance - tokensToDeduct;
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ tokens: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[rag-chat] Error updating tokens:', updateError);
      return { success: false, newBalance: currentBalance, error: 'Erreur mise à jour tokens' };
    }

    console.log(`[rag-chat] Tokens: ${currentBalance} - ${tokensToDeduct} = ${newBalance}`);
    
    return { success: true, newBalance };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[rag-chat] Token error:', errorMessage);
    return { success: false, newBalance: 0, error: errorMessage };
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

async function chatHandler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY non configurée');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = await createSupabaseClient(authHeader);
    const serviceClient = await createServiceClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      message,
      mode = 'corpus_plus_ai',
      searchMode = 'fast',
      conversationId,
      documentId,
      topK = CONFIG.defaultTopK,
    }: ChatRequest = await req.json();

    if (!message || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Configuration dynamique selon le mode de recherche
    const useHyDE = searchMode === 'precise';
    const useQueryRewriting = searchMode === 'precise';
    const useReranking = searchMode === 'precise';

    console.log(`[rag-chat] ========================================`);
    console.log(`[rag-chat] Query: "${message}"`);
    console.log(`[rag-chat] Mode: ${mode}, SearchMode: ${searchMode}`);
    console.log(`[rag-chat] HyDE: ${useHyDE}, Rewriting: ${useQueryRewriting}, Reranking: ${useReranking}`);

    let totalTokensUsed = 0;

    // HyDE - seulement en mode précis
    let hypotheticalAnswer = message;
    let hydeTokens = 0;
    if (useHyDE) {
      const hydeResult = await generateHypotheticalAnswer(message, OPENAI_API_KEY);
      hypotheticalAnswer = hydeResult.hypotheticalAnswer;
      hydeTokens = hydeResult.tokensUsed;
      console.log(`[rag-chat] HyDE: ${hydeTokens} tokens`);
    }
    totalTokensUsed += hydeTokens;

    // Query Rewriting - seulement en mode précis
    let queryVariations = [message];
    let rewriteTokens = 0;
    if (useQueryRewriting) {
      const rewriteResult = await rewriteQueryForSearch(message, OPENAI_API_KEY);
      queryVariations = rewriteResult.queries;
      rewriteTokens = rewriteResult.tokensUsed;
      console.log(`[rag-chat] Query Rewriting: ${rewriteTokens} tokens, ${queryVariations.length} variations`);
    }
    totalTokensUsed += rewriteTokens;

    // Embeddings
    console.log(`[rag-chat] Creating embeddings...`);
    const queryEmbedding = await createEmbedding(message, OPENAI_API_KEY);
    totalTokensUsed += Math.ceil(message.length / 4);

    let hydeEmbedding: number[] = [];
    if (useHyDE && hypotheticalAnswer !== message) {
      hydeEmbedding = await createEmbedding(hypotheticalAnswer, OPENAI_API_KEY);
      totalTokensUsed += Math.ceil(hypotheticalAnswer.length / 4);
    }

    // Recherche hybride
    const chunksToRerank = useReranking ? CONFIG.rerankingChunkCount : topK;
    const retrievedChunks = await searchChunksHybrid(
      serviceClient,
      user.id,
      message,
      queryVariations,
      hydeEmbedding,
      queryEmbedding,
      chunksToRerank,
      useHyDE,
      documentId
    );

    console.log(`[rag-chat] Retrieved: ${retrievedChunks.length} chunks`);

    // Re-ranking - seulement en mode précis
    let finalChunks = retrievedChunks.slice(0, topK);
    let rerankTokens = 0;
    if (useReranking && retrievedChunks.length > topK) {
      const rerankResult = await rerankChunksWithLLM(
        message,
        retrievedChunks,
        CONFIG.finalChunkCount,
        OPENAI_API_KEY
      );
      finalChunks = rerankResult.chunks;
      rerankTokens = rerankResult.tokensUsed;
      console.log(`[rag-chat] Re-ranking: ${rerankTokens} tokens`);
    }
    totalTokensUsed += rerankTokens;

    console.log(`[rag-chat] Final chunks: ${finalChunks.length}`);

    // Conversation
    const convId = await getOrCreateConversation(serviceClient, user.id, conversationId);
    const history = await getConversationHistory(serviceClient, convId);

    await saveMessage(serviceClient, convId, 'user', message);

    // Génération
    const { answer, tokensUsed: genTokens } = await generateResponse(
      message,
      finalChunks,
      mode,
      history,
      OPENAI_API_KEY
    );
    totalTokensUsed += genTokens;
    console.log(`[rag-chat] Generation: ${genTokens} tokens`);

    // Sources pour la réponse
    const sources: SourceChunk[] = finalChunks.map(chunk => ({
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      excerpt: chunk.content.substring(0, CONFIG.excerptLength) + 
        (chunk.content.length > CONFIG.excerptLength ? '...' : ''),
      score: chunk.score,
      scope: chunk.scope,
    }));

    await saveMessage(serviceClient, convId, 'assistant', answer, sources);

    // Déduction tokens
    console.log(`[rag-chat] Total tokens: ${totalTokensUsed}`);
    
    const tokenResult = await checkAndDeductUserTokens(serviceClient, user.id, totalTokensUsed);
    
    if (!tokenResult.success) {
      console.warn(`[rag-chat] Token deduction failed: ${tokenResult.error}`);
    }

    console.log(`[rag-chat] ========================================`);

    const response: ChatResponse = {
      answer,
      sources,
      conversationId: convId,
      tokensUsed: totalTokensUsed,
      tokensRemaining: tokenResult.newBalance,
      mode,
      searchMode,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[rag-chat] Error:', errorMessage);

    const status = errorMessage.includes('Tokens insuffisants') ? 402 : 500;

    return new Response(JSON.stringify({ error: errorMessage }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(chatHandler);

