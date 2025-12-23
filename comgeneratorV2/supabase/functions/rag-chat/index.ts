// supabase/functions/rag-chat/index.ts
// Edge Function pour le chat RAG avec Query Rewriting et Re-ranking

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
  // Paramètres de recherche
  defaultTopK: 6,
  maxTopK: 12,
  similarityThreshold: 0.28,

  // Modèles
  chatModel: 'gpt-4o-mini',
  embeddingModel: 'text-embedding-3-small',

  // Phase 2: Query Rewriting
  enableQueryRewriting: true,
  queryRewritingModel: 'gpt-4o-mini',

  // Phase 1: Re-ranking
  enableReranking: true,
  rerankingModel: 'gpt-4o-mini',
  rerankingChunkCount: 15,  // Chunks à récupérer avant re-ranking
  finalChunkCount: 8,       // Chunks après re-ranking

  // Historique
  maxHistoryMessages: 10,
};

// ============================================================================
// TYPES
// ============================================================================

type ChatMode = 'corpus_only' | 'corpus_plus_ai';

interface ChatRequest {
  message: string;
  mode: ChatMode;
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
  mode: ChatMode;
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
// PHASE 2: QUERY REWRITING
// ============================================================================

/**
 * Utilise un LLM pour générer des variations de la requête
 * avec synonymes, termes officiels et niveaux scolaires
 */
async function rewriteQueryForSearch(
  query: string,
  apiKey: string
): Promise<{ queries: string[]; tokensUsed: number }> {
  if (!CONFIG.enableQueryRewriting) {
    return { queries: [query], tokensUsed: 0 };
  }

  console.log(`[rag-chat] Query Rewriting: "${query}"`);

  const prompt = `Tu es un expert en éducation nationale française. Ta tâche est de reformuler la question suivante pour maximiser les chances de trouver les bons documents pédagogiques.

Question originale: "${query}"

Génère 3-4 reformulations de cette question en:
1. Utilisant les termes officiels de l'Éducation Nationale
2. Ajoutant des synonymes pertinents
3. Précisant les niveaux scolaires si implicites (maternelle, cycle 1/2/3/4, CP, CE1, CM2, collège, lycée)
4. Incluant les abréviations ET les formes longues (EPS/éducation physique, EMC/enseignement moral et civique)

EXEMPLES:
- "grammaire CP" → ["grammaire cours préparatoire cycle 2", "étude de la langue CP CE1 CE2", "français grammaire élémentaire cycle 2"]
- "sport maternelle" → ["activité physique maternelle cycle 1", "EPS éducation physique maternelle", "agir s'exprimer comprendre activité physique petite section"]
- "programmes français" → ["programme français cycle 2 cycle 3", "français lecture écriture grammaire", "enseignement français élémentaire collège"]

Réponds UNIQUEMENT avec un JSON valide contenant un tableau "queries" (4 éléments max):
{"queries": ["reformulation 1", "reformulation 2", "reformulation 3"]}`;

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
          { role: 'system', content: 'Tu es un assistant qui génère des reformulations de questions. Réponds uniquement en JSON valide.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.warn('[rag-chat] Query Rewriting failed, using original query');
      return { queries: [query], tokensUsed: 0 };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    // Parser le JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const queries = [query, ...(parsed.queries || [])];
      console.log(`[rag-chat] Query variations: ${queries.length}`);
      return { queries: queries.slice(0, 5), tokensUsed };
    }

    return { queries: [query], tokensUsed };
  } catch (error) {
    console.warn('[rag-chat] Query Rewriting error:', error);
    return { queries: [query], tokensUsed: 0 };
  }
}

// ============================================================================
// PHASE 1: RE-RANKING
// ============================================================================

/**
 * Utilise un LLM pour réordonner les chunks par pertinence réelle
 */
async function rerankChunksWithLLM(
  query: string,
  chunks: MatchedChunk[],
  topN: number,
  apiKey: string
): Promise<{ chunks: MatchedChunk[]; tokensUsed: number }> {
  if (!CONFIG.enableReranking || chunks.length === 0) {
    return { chunks: chunks.slice(0, topN), tokensUsed: 0 };
  }

  console.log(`[rag-chat] Re-ranking ${chunks.length} chunks...`);

  // Préparer les extraits pour le LLM (limiter la taille)
  const excerpts = chunks.map((chunk, index) => ({
    id: index,
    text: chunk.content.substring(0, 500) + (chunk.content.length > 500 ? '...' : ''),
  }));

  const prompt = `Tu es un expert en pertinence documentaire. Évalue la pertinence de chaque extrait par rapport à la question.

Question: "${query}"

Extraits à évaluer:
${excerpts.map(e => `[${e.id}] ${e.text}`).join('\n\n')}

Pour chaque extrait, attribue un score de 0 à 10:
- 10 = Répond DIRECTEMENT et COMPLÈTEMENT à la question
- 7-9 = Contient la réponse mais avec du contexte superflu
- 4-6 = Partiellement pertinent, informations connexes
- 1-3 = Marginalement lié au sujet
- 0 = Hors sujet

IMPORTANT: Privilégie les extraits qui contiennent des INFORMATIONS SPÉCIFIQUES et CONCRÈTES plutôt que des introductions générales.

Réponds UNIQUEMENT avec un JSON valide:
{"scores": [{"id": 0, "score": 8}, {"id": 1, "score": 3}, ...]}`;

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
          { role: 'system', content: 'Tu es un évaluateur de pertinence documentaire. Réponds uniquement en JSON valide.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.warn('[rag-chat] Re-ranking failed, using vector scores');
      return { chunks: chunks.slice(0, topN), tokensUsed: 0 };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    // Parser le JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const scores = parsed.scores || [];

      // Créer une map id -> score
      const scoreMap = new Map<number, number>();
      for (const s of scores) {
        scoreMap.set(s.id, s.score);
      }

      // Réordonner les chunks par score LLM
      const rerankedChunks = chunks
        .map((chunk, index) => ({
          ...chunk,
          rerankScore: scoreMap.get(index) ?? 0,
        }))
        .sort((a, b) => b.rerankScore - a.rerankScore)
        .slice(0, topN);

      console.log(`[rag-chat] Re-ranked: top scores = ${rerankedChunks.map(c => c.rerankScore).join(', ')}`);

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

  // Niveaux scolaires
  const levelMappings: Record<string, string[]> = {
    'maternelle': ['maternelle', 'cycle 1', 'petite section', 'moyenne section', 'grande section', 'PS', 'MS', 'GS'],
    'cycle 1': ['maternelle', 'cycle 1', 'petite section', 'moyenne section', 'grande section'],
    'cp': ['CP', 'cours préparatoire', 'cycle 2'],
    'ce1': ['CE1', 'cours élémentaire 1', 'cycle 2'],
    'ce2': ['CE2', 'cours élémentaire 2', 'cycle 2'],
    'cycle 2': ['cycle 2', 'CP', 'CE1', 'CE2', 'cours préparatoire', 'cours élémentaire'],
    'cm1': ['CM1', 'cours moyen 1', 'cycle 3'],
    'cm2': ['CM2', 'cours moyen 2', 'cycle 3'],
    '6e': ['6e', '6ème', 'sixième', 'cycle 3'],
    'sixième': ['6e', '6ème', 'sixième', 'cycle 3'],
    'cycle 3': ['cycle 3', 'CM1', 'CM2', '6e', 'sixième'],
    '5e': ['5e', '5ème', 'cinquième', 'cycle 4', 'collège'],
    '4e': ['4e', '4ème', 'quatrième', 'cycle 4', 'collège'],
    '3e': ['3e', '3ème', 'troisième', 'cycle 4', 'collège'],
    'cycle 4': ['cycle 4', '5e', '4e', '3e', 'collège'],
    'collège': ['collège', 'cycle 3', 'cycle 4', '6e', '5e', '4e', '3e'],
    'lycée': ['lycée', 'seconde', 'première', 'terminale', '2nde'],
    'seconde': ['seconde', '2nde', 'lycée'],
    'première': ['première', '1ère', 'lycée'],
    'terminale': ['terminale', 'Tle', 'lycée'],
  };

  // Matières
  const subjectMappings: Record<string, string[]> = {
    'eps': ['EPS', 'éducation physique', 'sport', 'activité physique', 'champ d\'apprentissage'],
    'éducation physique': ['EPS', 'éducation physique', 'sport', 'activité physique'],
    'sport': ['EPS', 'sport', 'activité physique', 'éducation physique'],
    'français': ['français', 'lecture', 'écriture', 'grammaire', 'orthographe', 'vocabulaire', 'étude de la langue'],
    'grammaire': ['grammaire', 'français', 'étude de la langue', 'syntaxe', 'conjugaison'],
    'lecture': ['lecture', 'français', 'compréhension', 'lire'],
    'écriture': ['écriture', 'français', 'production d\'écrit', 'rédaction'],
    'orthographe': ['orthographe', 'français', 'dictée'],
    'math': ['mathématiques', 'maths', 'calcul', 'géométrie', 'numération'],
    'maths': ['mathématiques', 'maths', 'calcul', 'géométrie', 'numération'],
    'mathématiques': ['mathématiques', 'maths', 'calcul', 'géométrie', 'numération', 'nombres'],
    'calcul': ['calcul', 'mathématiques', 'opérations', 'nombres'],
    'géométrie': ['géométrie', 'mathématiques', 'espace', 'figures'],
    'sciences': ['sciences', 'SVT', 'physique', 'chimie', 'biologie', 'technologie'],
    'svt': ['SVT', 'sciences de la vie', 'biologie', 'sciences'],
    'histoire': ['histoire', 'histoire-géographie', 'passé', 'civilisation'],
    'géographie': ['géographie', 'histoire-géographie', 'territoire', 'espace'],
    'emc': ['EMC', 'enseignement moral et civique', 'citoyenneté', 'éducation civique'],
    'anglais': ['anglais', 'langue vivante', 'LV1', 'English'],
    'arts plastiques': ['arts plastiques', 'art', 'dessin', 'création artistique'],
    'musique': ['musique', 'éducation musicale', 'chant'],
  };

  // Chercher les niveaux
  for (const [key, values] of Object.entries(levelMappings)) {
    if (lowerQuery.includes(key)) {
      terms.push(...values);
    }
  }

  // Chercher les matières
  for (const [key, values] of Object.entries(subjectMappings)) {
    if (lowerQuery.includes(key)) {
      terms.push(...values);
    }
  }

  // Dédupliquer
  return [...new Set(terms)];
}

// ============================================================================
// RECHERCHE HYBRIDE
// ============================================================================

/**
 * Recherche par titre de document
 */
async function searchByDocumentTitle(
  supabase: any,
  userId: string,
  searchTerms: string[],
  limit: number = 10
): Promise<MatchedChunk[]> {
  if (searchTerms.length === 0) return [];

  const results: MatchedChunk[] = [];
  const chunkScores = new Map<string, { chunk: MatchedChunk; score: number; matchedTerms: string[] }>();

  // Prioriser certains termes
  const priorityTerms = searchTerms.filter(t =>
    /cycle|maternelle|cp|ce|cm|eps|français|math|grammaire/i.test(t)
  );

  const termsToSearch = priorityTerms.length > 0 ? priorityTerms : searchTerms.slice(0, 5);

  for (const term of termsToSearch) {
    try {
      // Chercher dans les titres de documents
      const { data: docs } = await supabase
        .from('rag_documents')
        .select('id, title, scope')
        .or(`scope.eq.global,user_id.eq.${userId}`)
        .eq('status', 'ready')
        .ilike('title', `%${term}%`)
        .limit(3);

      if (!docs || docs.length === 0) continue;

      for (const doc of docs) {
        // Récupérer les chunks qui contiennent le terme
        const { data: chunks } = await supabase
          .from('rag_chunks')
          .select('id, document_id, chunk_index, content')
          .eq('document_id', doc.id)
          .ilike('content', `%${term}%`)
          .order('chunk_index', { ascending: true })
          .limit(5);

        if (!chunks) continue;

        for (const chunk of chunks) {
          const key = chunk.id;
          const existing = chunkScores.get(key);

          if (existing) {
            existing.score += 1;
            existing.matchedTerms.push(term);
          } else {
            chunkScores.set(key, {
              chunk: {
                id: chunk.id,
                documentId: doc.id,
                documentTitle: doc.title,
                chunkIndex: chunk.chunk_index,
                content: chunk.content,
                score: 0.9,
                scope: doc.scope,
              },
              score: 1,
              matchedTerms: [term],
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[rag-chat] Erreur recherche titre pour "${term}":`, err);
    }
  }

  // Trier par score (nombre de termes matchés) puis par index
  const sortedChunks = Array.from(chunkScores.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.chunk.chunkIndex - b.chunk.chunkIndex;
    })
    .slice(0, limit)
    .map(item => item.chunk);

  console.log(`[rag-chat] Title search: ${sortedChunks.length} chunks from ${chunkScores.size} unique`);

  return sortedChunks;
}

/**
 * Recherche par mots-clés dans le contenu
 */
async function searchByKeywords(
  supabase: any,
  userId: string,
  keywords: string[],
  limit: number = 10
): Promise<MatchedChunk[]> {
  if (keywords.length === 0) return [];

  const chunkScores = new Map<string, { chunk: MatchedChunk; score: number }>();

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const { data: chunks } = await supabase
        .from('rag_chunks')
        .select(`
          id,
          document_id,
          chunk_index,
          content,
          rag_documents!inner (
            id,
            title,
            scope,
            user_id
          )
        `)
        .or(`rag_documents.scope.eq.global,rag_documents.user_id.eq.${userId}`)
        .ilike('content', `%${keyword}%`)
        .limit(5);

      if (!chunks) continue;

      for (const chunk of chunks) {
        const doc = chunk.rag_documents;
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
              scope: doc.scope,
            },
            score: 1,
          });
        }
      }
    } catch (err) {
      console.warn(`[rag-chat] Erreur keyword search pour "${keyword}":`, err);
    }
  }

  return Array.from(chunkScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.chunk);
}

/**
 * Recherche vectorielle
 */
async function searchByVector(
  supabase: any,
  userId: string,
  embedding: number[],
  topK: number,
  documentId?: string
): Promise<MatchedChunk[]> {
  try {
    const { data, error } = await supabase.rpc('match_rag_chunks', {
      query_embedding: JSON.stringify(embedding),
      match_threshold: CONFIG.similarityThreshold,
      match_count: topK,
      p_user_id: userId,
      p_document_id: documentId || null,
    });

    if (error) {
      console.error('[rag-chat] Vector search error:', error);
      return [];
    }

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

/**
 * Recherche combinée avec Query Rewriting
 */
async function searchChunksWithRewriting(
  supabase: any,
  userId: string,
  originalQuery: string,
  queryVariations: string[],
  queryEmbedding: number[],
  topK: number,
  documentId?: string
): Promise<MatchedChunk[]> {
  const allChunks: MatchedChunk[] = [];
  const seenIds = new Set<string>();

  // Pour chaque variation de requête
  for (const query of queryVariations) {
    const terms = extractKeyTerms(query);

    if (terms.length > 0) {
      // Recherche par titre
      const titleChunks = await searchByDocumentTitle(supabase, userId, terms, 5);
      for (const chunk of titleChunks) {
        if (!seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          allChunks.push(chunk);
        }
      }

      // Recherche par mots-clés
      const keywordChunks = await searchByKeywords(supabase, userId, terms, 5);
      for (const chunk of keywordChunks) {
        if (!seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          allChunks.push(chunk);
        }
      }
    }
  }

  // Recherche vectorielle avec la requête originale
  const vectorChunks = await searchByVector(supabase, userId, queryEmbedding, topK * 2, documentId);
  for (const chunk of vectorChunks) {
    if (!seenIds.has(chunk.id)) {
      seenIds.add(chunk.id);
      allChunks.push(chunk);
    }
  }

  console.log(`[rag-chat] Combined search: ${allChunks.length} unique chunks`);

  // Trier par score
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
  // Préparer le contexte
  const context = chunks
    .map((chunk, i) => `[Source ${i + 1}: ${chunk.documentTitle}]\n${chunk.content}`)
    .join('\n\n---\n\n');

  let systemPrompt: string;
  let userPrompt: string;

  if (mode === 'corpus_only') {
    systemPrompt = `Tu es un assistant pédagogique pour les enseignants français. Tu réponds UNIQUEMENT à partir des documents fournis.

RÈGLES STRICTES:
- Réponds UNIQUEMENT avec les informations des sources fournies
- Si l'information n'est pas dans les sources, dis "Je n'ai pas trouvé cette information dans les documents disponibles."
- Cite les sources pertinentes en mentionnant leur titre
- Sois précis et factuel
- Utilise un langage professionnel adapté aux enseignants`;

    userPrompt = `Documents disponibles:\n${context}\n\n---\n\nQuestion: ${query}`;
  } else {
    systemPrompt = `Tu es un assistant pédagogique expert pour les enseignants français. Tu utilises les documents fournis comme base, complétés par tes connaissances.

RÈGLES:
- Privilégie les informations des sources fournies
- Tu peux compléter avec tes connaissances pédagogiques si pertinent
- Distingue clairement ce qui vient des sources et ce qui vient de tes connaissances
- Cite les sources quand tu les utilises
- Sois précis, pratique et adapté au contexte éducatif français`;

    userPrompt = `Documents de référence:\n${context}\n\n---\n\nQuestion: ${query}`;
  }

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
      max_tokens: 1500,
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
    // Vérifier que la conversation existe et appartient à l'utilisateur
    const { data } = await supabase
      .from('rag_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (data) return conversationId;
  }

  // Créer une nouvelle conversation
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
    sources: sources ? JSON.stringify(sources) : null,
  });
}

// ============================================================================
// GESTION DES TOKENS BETA
// ============================================================================

async function checkAndUpdateTokens(
  supabase: any,
  userId: string,
  tokensUsed: number
): Promise<void> {
  try {
    // Vérifier la limite
    const { data: profile } = await supabase
      .from('profiles')
      .select('rag_beta_tokens_used, rag_beta_tokens_limit')
      .eq('user_id', userId)
      .single();

    if (profile) {
      const used = profile.rag_beta_tokens_used || 0;
      const limit = profile.rag_beta_tokens_limit || 200000;

      if (used + tokensUsed > limit) {
        throw new Error('Limite de tokens beta atteinte');
      }
    }

    // Incrémenter
    await supabase.rpc('increment_rag_beta_tokens', {
      p_user_id: userId,
      p_tokens: tokensUsed,
    });
  } catch (err: any) {
    if (err.message === 'Limite de tokens beta atteinte') throw err;
    console.warn('[rag-chat] Token update warning:', err);
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

async function chatHandler(req: Request): Promise<Response> {
  // CORS preflight
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

    // Authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = await createSupabaseClient(authHeader);
    const serviceClient = await createServiceClient();

    // Vérifier l'utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Récupérer les paramètres
    const {
      message,
      mode = 'corpus_plus_ai',
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

    console.log(`[rag-chat] Query: "${message}" (mode: ${mode})`);

    let totalTokensUsed = 0;

    // PHASE 2: Query Rewriting
    const { queries: queryVariations, tokensUsed: rewriteTokens } = await rewriteQueryForSearch(
      message,
      OPENAI_API_KEY
    );
    totalTokensUsed += rewriteTokens;
    console.log(`[rag-chat] Phase 2 (Query Rewriting): ${rewriteTokens} tokens, ${queryVariations.length} variations`);

    // Créer l'embedding de la requête originale
    const queryEmbedding = await createEmbedding(message, OPENAI_API_KEY);
    totalTokensUsed += Math.ceil(message.length / 4);

    // Recherche hybride avec toutes les variations
    const chunksToRerank = CONFIG.enableReranking ? CONFIG.rerankingChunkCount : topK;
    const retrievedChunks = await searchChunksWithRewriting(
      serviceClient,
      user.id,
      message,
      queryVariations,
      queryEmbedding,
      chunksToRerank,
      documentId
    );

    console.log(`[rag-chat] Retrieved ${retrievedChunks.length} chunks for re-ranking`);

    // PHASE 1: Re-ranking
    const { chunks: finalChunks, tokensUsed: rerankTokens } = await rerankChunksWithLLM(
      message,
      retrievedChunks,
      CONFIG.enableReranking ? CONFIG.finalChunkCount : topK,
      OPENAI_API_KEY
    );
    totalTokensUsed += rerankTokens;
    console.log(`[rag-chat] Phase 1 (Re-ranking): ${rerankTokens} tokens, ${finalChunks.length} final chunks`);

    // Gérer la conversation
    const convId = await getOrCreateConversation(serviceClient, user.id, conversationId);
    const history = await getConversationHistory(serviceClient, convId);

    // Sauvegarder le message utilisateur
    await saveMessage(serviceClient, convId, 'user', message);

    // Générer la réponse
    const { answer, tokensUsed: genTokens } = await generateResponse(
      message,
      finalChunks,
      mode,
      history,
      OPENAI_API_KEY
    );
    totalTokensUsed += genTokens;
    console.log(`[rag-chat] Generation: ${genTokens} tokens`);

    // Préparer les sources
    const sources: SourceChunk[] = finalChunks.map(chunk => ({
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      excerpt: chunk.content.substring(0, 300) + (chunk.content.length > 300 ? '...' : ''),
      score: chunk.score,
      scope: chunk.scope,
    }));

    // Sauvegarder la réponse
    await saveMessage(serviceClient, convId, 'assistant', answer, sources);

    // Mettre à jour les tokens
    await checkAndUpdateTokens(serviceClient, user.id, totalTokensUsed);

    console.log(`[rag-chat] Total tokens: ${totalTokensUsed}`);

    const response: ChatResponse = {
      answer,
      sources,
      conversationId: convId,
      tokensUsed: totalTokensUsed,
      mode,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[rag-chat] Error:', error);

    const status = error.message === 'Limite de tokens beta atteinte' ? 429 : 500;

    return new Response(JSON.stringify({
      error: error.message || 'Erreur lors du traitement de la requête',
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(chatHandler);
