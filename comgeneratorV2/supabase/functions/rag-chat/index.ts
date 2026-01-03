// supabase/functions/rag-chat/index.ts
// VERSION V4 "PRODUCTION"
// - Base solide V2.5 (RRF, Fallback, Corpus, IA Gen)
// - Patch V3 (Regex tirets "demi-fond", Stopwords stricts)
// - Boost Lexical (Force la remontée du document contenant le mot-clé exact)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

// ============================================================================
// 1. CONFIGURATION COMPLETE
// ============================================================================

interface DomainConfig {
  id: string;
  name: string;
  keywords: RegExp[];
  docPatterns: string[];
  bonus: number;
  minDocs: number;
  promptRole: string;
}

const DOMAINS: Record<string, DomainConfig> = {
  LANGUES: {
    id: 'LANGUES',
    name: 'Langues Vivantes / CECR',
    keywords: [
      /\bcecr\b/i, /\bniveau\s*de\s*langue/i, /\b[a-c][1-2]\b/i, 
      /\bcompétence\s*linguistique/i, /\blangue\s*vivante/i, /\blv[1-2]\b/i,
      /\boral\s*(compréhension|production)/i, /\bécrit\s*(compréhension|production)/i
    ],
    docPatterns: ['cecr', 'cecrl', 'cadre européen', 'guide-langue', 'reperles'],
    bonus: 0.15,
    minDocs: 3,
    promptRole: "Expert en didactique des langues et CECR"
  },
  EPS: {
    id: 'EPS',
    name: 'Éducation Physique et Sportive',
    keywords: [
      /\beps\b/i, /\béducation\s*physique/i, /\bchamp\s*d'apprentissage/i, 
      /\bapsa\b/i, /\bmotricité/i, /\bperformance\s*sportive/i, /\bsport\b/i
    ],
    docPatterns: ['eps', 'éducation physique', 'sport', 'apsa', 'guide-eps'],
    bonus: 0.10,
    minDocs: 2,
    promptRole: "Expert en pédagogie de l'EPS et motricité"
  },
  SCIENCES: {
    id: 'SCIENCES',
    name: 'Mathématiques et Sciences',
    keywords: [
      /\bmath[s]?\b/i, /\bmathématique/i, /\bgéométrie/i, /\balgèbre/i, 
      /\bthéorème/i, /\bcalcul\b/i, /\bphysique\b/i, /\bchimie\b/i, /\bsvt\b/i
    ],
    docPatterns: ['math', 'science', 'physique', 'chimie'],
    bonus: 0.10,
    minDocs: 2,
    promptRole: "Expert en didactique des sciences"
  },
  HUMANITES: {
    id: 'HUMANITES',
    name: 'Histoire-Géo et Français',
    keywords: [
      /\bhistoire\b/i, /\bgéographie\b/i, /\bemc\b/i, /\bfrançais\b/i, 
      /\blittérature/i, /\bgrammaire/i, /\bchronologie/i
    ],
    docPatterns: ['histoire', 'géographie', 'français', 'littérature'],
    bonus: 0.10,
    minDocs: 2,
    promptRole: "Expert en humanités et culture générale"
  }
};

const CONFIG = {
  defaultTopK: 15,           
  similarityThreshold: 0.26, // Seuil légèrement baissé pour attraper plus large avant le tri
  referenceDocBonus: 0.05,
  chatModel: 'gpt-4o-mini',  
  embeddingModel: 'text-embedding-3-large',
  embeddingDimensions: 1536,
  queryRewritingModel: 'gpt-4o-mini',
  finalChunkCount: 8,        
  maxHistoryMessages: 6,     
  excerptLength: 700,        
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
  usePersonalCorpus?: boolean;
  useProfAssistCorpus?: boolean;
  useAI?: boolean;
  levels?: string[];
  subjects?: string[];
  documentTypes?: string[];
}

interface DocumentInfo {
  id: string;
  title: string;
  scope: string;
}

interface MatchedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;      
  rrfScore?: number;  
  scope?: 'global' | 'user';
  sourceType?: 'vector' | 'keyword' | 'domain';
}

// ============================================================================
// HELPERS
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function createSupabaseClient(authHeader: string) {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function createServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

function normalizeStr(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ============================================================================
// EXTRACTION INTELLIGENTE (LE PATCH "DEMI-FOND")
// ============================================================================

function extractKeyTerms(query: string): string[] {
  // Regex : Garde les lettres, chiffres, accents ET les tirets (-)
  const words = query.split(/[^a-zA-Z0-9\u00C0-\u017F-]+/).filter(w => w.length > 0);
  
  const terms: string[] = [];
  
  // LISTE NOIRE STRICTE (Mots vides + mots pédagogiques génériques polluants)
  const stopWords = new Set([
    'pour','avec','dans','quel','quelle','quelles','comment','est-ce','que','les','des','une', 'le', 'la', 'un', 'au', 'aux',
    'cycle', 'cycles', 'niveau', 'niveaux', 'classe', 'classes', 
    'evaluer', 'evaluation', 'competence', 'competences', 'situation', 'situations',
    'enseignement', 'enseigner', 'eleve', 'eleves', 'objectifs', 'objectif', 'possible',
    'activite', 'activites', 'apprendre', 'faire'
  ]);

  const mappings: Record<string, string[]> = {
    'maternelle': ['cycle_1'], 'cycle 1': ['maternelle'],
    'cycle 2': ['CP', 'CE1', 'CE2'],
    'cycle 3': ['CM1', 'CM2', '6e'], 'cycle 4': ['5e', '4e', '3e'],
    'eps': ['éducation physique', 'sport', 'apsa'],
    'cecr': ['cadre européen', 'descripteur'],
  };

  words.forEach(w => {
    const norm = normalizeStr(w);
    // On garde si > 3 lettres ET pas dans stopwords
    // EXCEPTION : Si contient un tiret (demi-fond), on garde TOUJOURS
    if (w.includes('-') || (w.length > 3 && !stopWords.has(norm))) {
      terms.push(w);
    }
  });

  // Mappings additionnels
  const queryLower = normalizeStr(query);
  for (const [k, v] of Object.entries(mappings)) {
    if (queryLower.includes(k)) terms.push(...v);
  }

  return [...new Set(terms)];
}

// ============================================================================
// LOGIQUE MÉTIER & FILTRES
// ============================================================================

function inferFiltersFromQuery(query: string): { levels?: string[]; subjects?: string[]; } {
  const q = normalizeStr(query);
  const levels = new Set<string>();
  const subjects = new Set<string>();

  // Format DB exact (avec underscores)
  if (q.match(/\bcycle\s*1\b/)) levels.add('cycle_1');
  if (q.match(/\bcycle\s*2\b/)) levels.add('cycle_2');
  if (q.match(/\bcycle\s*3\b/)) levels.add('cycle_3');
  if (q.match(/\bcycle\s*4\b/)) levels.add('cycle_4');
  
  if (q.includes('college')) levels.add('collège');
  if (q.includes('lycee')) levels.add('lycée');

  const disciplineMap: Record<string, string> = {
    'eps': 'EPS', 'sport': 'EPS', 'math': 'Mathématiques', 'francais': 'Français',
    'anglais': 'Langues', 'espagnol': 'Langues', 'allemand': 'Langues',
    'histoire': 'Histoire-Géographie', 'geographie': 'Histoire-Géographie'
  };

  for (const [key, value] of Object.entries(disciplineMap)) {
    if (q.includes(key)) subjects.add(value);
  }

  return { levels: levels.size ? Array.from(levels) : undefined, subjects: subjects.size ? Array.from(subjects) : undefined };
}

function detectDomainIntent(query: string): DomainConfig | null {
  for (const domain of Object.values(DOMAINS)) {
    if (domain.keywords.some(regex => regex.test(query))) return domain;
  }
  return null;
}

function isDomainDocument(docTitle: string, domain: DomainConfig): boolean {
  return domain.docPatterns.some(p => docTitle.toLowerCase().includes(p));
}

function isReferenceDocument(title: string): boolean {
  return /programme|guide|référentiel|officiel|accompagnement/i.test(title.toLowerCase());
}

// ============================================================================
// DATA & SEARCH
// ============================================================================

async function rewriteQueryForSearch(query: string, apiKey: string): Promise<{ queries: string[]; tokensUsed: number }> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.queryRewritingModel,
        messages: [
          { role: 'system', content: 'Génère 2 variantes de recherche optimisées (JSON) avec synonymes.' },
          { role: 'user', content: `Question: "${query}"\nJSON: {"queries": ["v1", "v2"]}` }
        ],
        temperature: 0.3, max_tokens: 150,
      }),
    });
    const data = await response.json();
    const jsonMatch = data.choices[0]?.message?.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { queries: [query, ...(parsed.queries || [])], tokensUsed: data.usage?.total_tokens || 0 };
    }
    return { queries: [query], tokensUsed: data.usage?.total_tokens || 0 };
  } catch {
    return { queries: [query], tokensUsed: 0 };
  }
}

async function getAllowedDocuments(
  supabase: any, userId: string, docId?: string,
  usePersonalCorpus: boolean = true, useProfAssistCorpus: boolean = true,
  filters?: { levels?: string[]; subjects?: string[]; documentTypes?: string[]; }
): Promise<Map<string, DocumentInfo>> {
  const docsMap = new Map<string, DocumentInfo>();
  const { levels, subjects, documentTypes } = filters || {};

  if (!usePersonalCorpus && !useProfAssistCorpus) return docsMap;

  let query = supabase.from('rag_documents').select('id, title, scope, user_id, levels, subjects, document_type').eq('status', 'ready');
  
  // Filtrage Corpus
  if (docId) query = query.eq('id', docId);
  else {
    if (usePersonalCorpus && useProfAssistCorpus) query = query.or(`scope.eq.global,and(scope.eq.user,user_id.eq.${userId})`);
    else if (useProfAssistCorpus) query = query.eq('scope', 'global');
    else if (usePersonalCorpus) query = query.eq('scope', 'user').eq('user_id', userId);
  }

  // Filtrage Métadonnées Strict
  if (levels?.length) query = query.overlaps('levels', levels);
  if (subjects?.length) query = query.overlaps('subjects', subjects);
  if (documentTypes?.length) query = query.in('document_type', documentTypes);

  const { data } = await query;

  // FALLBACK DE SÉCURITÉ
  if (!data || data.length === 0) {
    console.log('[rag-chat] Filters too strict, applying fallback...');
    let fallbackQuery = supabase.from('rag_documents').select('id, title, scope').eq('status', 'ready');
    
    // On garde juste la restriction de corpus
    if (docId) fallbackQuery = fallbackQuery.eq('id', docId);
    else if (usePersonalCorpus && useProfAssistCorpus) fallbackQuery = fallbackQuery.or(`scope.eq.global,and(scope.eq.user,user_id.eq.${userId})`);
    else if (useProfAssistCorpus) fallbackQuery = fallbackQuery.eq('scope', 'global');
    else if (usePersonalCorpus) fallbackQuery = fallbackQuery.eq('scope', 'user').eq('user_id', userId);

    const { data: fallbackData } = await fallbackQuery;
    if (fallbackData) fallbackData.forEach((d: any) => docsMap.set(d.id, { id: d.id, title: d.title, scope: d.scope }));
    return docsMap;
  }

  data.forEach((d: any) => docsMap.set(d.id, { id: d.id, title: d.title, scope: d.scope }));
  return docsMap;
}

async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CONFIG.embeddingModel, input: text.replace(/\n/g, ' '), dimensions: CONFIG.embeddingDimensions }),
  });
  const data = await response.json();
  return data.data[0].embedding;
}

async function searchByVector(supabase: any, userId: string, embedding: number[], topK: number, allowedDocIds: Set<string>): Promise<MatchedChunk[]> {
  const { data, error } = await supabase.rpc('match_rag_chunks', {
    p_query_embedding: `[${embedding.join(',')}]`,
    p_similarity_threshold: CONFIG.similarityThreshold,
    p_match_count: topK,
    p_user_id: userId,
    p_document_id: null,
  });
  if (error || !data) return [];
  return data
    .filter((item: any) => allowedDocIds.has(item.document_id))
    .map((item: any) => ({
      id: item.id, documentId: item.document_id, documentTitle: item.document_title,
      chunkIndex: item.chunk_index, content: item.content, 
      score: item.similarity, 
      scope: item.scope, sourceType: 'vector'
    }));
}

async function searchByKeywords(supabase: any, allowedDocIds: string[], keywords: string[]): Promise<MatchedChunk[]> {
  if (keywords.length === 0 || allowedDocIds.length === 0) return [];
  
  // On priorise les mots composés et longs
  const effectiveKeywords = keywords.slice(0, 8);
  const results: MatchedChunk[] = [];
  
  console.log(`[rag-chat] Searching keywords: ${effectiveKeywords.join(', ')}`);

  for (const k of effectiveKeywords) {
      const { data } = await supabase.from('rag_chunks')
        .select('id, document_id, chunk_index, content, scope')
        .in('document_id', allowedDocIds).ilike('content', `%${k}%`).limit(6);
      
      if (data) {
          data.forEach((c: any) => {
              results.push({
                  id: c.id, documentId: c.document_id, documentTitle: '', chunkIndex: c.chunk_index, 
                  content: c.content, 
                  score: 1.0, // Score max pour un hit exact
                  scope: c.scope, sourceType: 'keyword'
              });
          });
      }
  }
  return results;
}

// ============================================================================
// FUSION RRF + BOOST LEXICAL (Le cœur du système)
// ============================================================================

function fuseResultsWithBoost(
  vectorResults: MatchedChunk[], keywordResults: MatchedChunk[], domainResults: MatchedChunk[],
  docsMap: Map<string, DocumentInfo>, 
  boostTerms: string[],
  k = 60
): MatchedChunk[] {
  const rrfScores = new Map<string, number>();
  const chunkMap = new Map<string, MatchedChunk>();

  const processList = (list: MatchedChunk[]) => {
    list.forEach((item, rank) => {
      // Hydratation Titre
      if (!item.documentTitle && docsMap.has(item.documentId)) item.documentTitle = docsMap.get(item.documentId)!.title;
      
      // Stockage (garde le meilleur score natif)
      if (!chunkMap.has(item.id)) chunkMap.set(item.id, item);
      else {
        const existing = chunkMap.get(item.id)!;
        if (item.score > existing.score) chunkMap.set(item.id, { ...existing, score: item.score });
      }

      // RRF
      const currentRRF = rrfScores.get(item.id) || 0;
      rrfScores.set(item.id, currentRRF + (1 / (k + rank + 1)));
    });
  };

  processList(vectorResults);
  processList(keywordResults);
  processList(domainResults);

  let candidates = Array.from(rrfScores.entries())
    .map(([id, rrfScore]) => {
      const chunk = chunkMap.get(id)!;
      return { ...chunk, rrfScore }; 
    });

  // --- LE BOOST LEXICAL ---
  // Si un chunk contient "demi-fond" ou "apsa", on booste massivement son score RRF
  // Cela permet de faire remonter le doc pertinent même s'il était mal classé vectoriellement
  if (boostTerms.length > 0) {
    candidates = candidates.map(chunk => {
        let boost = 1.0;
        const contentNorm = normalizeStr(chunk.content);
        
        boostTerms.forEach(term => {
          const termNorm = normalizeStr(term);
          // Si le terme est un mot composé ou long, gros boost
          if (contentNorm.includes(termNorm)) {
            boost += (term.includes('-') ? 2.0 : 0.5); 
          }
        });
        
        // On booste le RRF (le critère de tri)
        return { ...chunk, rrfScore: (chunk.rrfScore || 0) * boost };
    });
  }

  // Tri final par RRF boosté
  return candidates.sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0));
}

async function generateResponse(
  query: string, chunks: MatchedChunk[], mode: ChatMode, history: any[], domain: DomainConfig | null, apiKey: string
): Promise<{ answer: string; tokens: number }> {
  
  if (chunks.length === 0) return { answer: "Je n'ai pas trouvé d'information pertinente.", tokens: 0 };

  const context = chunks.map((c, i) => `[Source ${i + 1}] (Titre: ${c.documentTitle})\n${c.content.replace(/\s+/g, ' ')}`).join('\n\n');
  let roleDesc = domain ? domain.promptRole : "Assistant Pédagogique Expert";
  const allowAI = mode === 'corpus_plus_ai';
  
  const systemPrompt = `Tu es un ${roleDesc}.
  
  CONTEXTE DOCUMENTAIRE :
  ${context}

  INSTRUCTIONS :
  1. Base-toi EN PRIORITÉ sur les "Sources" ci-dessus.
  2. Cite systématiquement les sources utilisées (ex: [Source 1]).
  3. Structure la réponse avec des titres et des puces.
  ${allowAI 
    ? "4. Si les sources sont incomplètes, TU PEUX compléter avec tes connaissances générales, mais tu dois PRECISER CLAIREMENT ce qui vient de toi." 
    : "4. Si la réponse n'est pas dans les sources, dis simplement que tu ne trouves pas l'information."}
  
  ${domain?.id === 'LANGUES' ? "Utilise la terminologie CECR." : ""}
  ${domain?.id === 'EPS' ? "Utilise le vocabulaire APSA/AFC." : ""}
  `;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.chatModel,
      messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: query }],
      temperature: 0.3, 
    }),
  });

  const data = await response.json();
  return { answer: data.choices[0]?.message?.content || 'Erreur.', tokens: data.usage?.total_tokens || 0 };
}

async function deductTokens(serviceClient: any, userId: string, tokensUsed: number): Promise<void> {
  if (tokensUsed <= 0) return;
  const { data } = await serviceClient.from('profiles').select('tokens').eq('user_id', userId).single();
  if (data) await serviceClient.from('profiles').update({ tokens: Math.max(0, data.tokens - tokensUsed) }).eq('user_id', userId);
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

async function chatHandler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Auth Missing');

    const supabase = await createSupabaseClient(authHeader);
    const serviceClient = await createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User Invalid');

    const body = await req.json() as ChatRequest;
    const {
      message, searchMode = 'fast', conversationId, documentId,
      usePersonalCorpus = true, useProfAssistCorpus = true, useAI = false,
      levels, subjects, documentTypes
    } = body;

    const effectiveMode: ChatMode = useAI ? 'corpus_plus_ai' : 'corpus_only';
    const activeDomain = detectDomainIntent(message);
    const inferred = inferFiltersFromQuery(message);
    const effectiveLevels = levels?.length ? levels : inferred.levels;
    const effectiveSubjects = subjects?.length ? subjects : inferred.subjects;

    const allowedDocsMap = await getAllowedDocuments(
      serviceClient, user.id, documentId, usePersonalCorpus, useProfAssistCorpus,
      { levels: effectiveLevels, subjects: effectiveSubjects, documentTypes }
    );
    const allowedDocIdsArr = Array.from(allowedDocsMap.keys());
    const allowedDocIdsSet = new Set(allowedDocIdsArr);

    // CAS IA SEULE / AUCUN DOC
    if (allowedDocIdsArr.length === 0) {
      if (useAI) {
        let convId = conversationId;
        if (!convId) {
          const { data } = await serviceClient.from('rag_conversations').insert({ user_id: user.id }).select('id').single();
          convId = data?.id;
        }
        const { data: hist } = await serviceClient.from('rag_messages')
          .select('role, content')
          .eq('conversation_id', convId).order('created_at', { ascending: true }).limit(6);
        await serviceClient.from('rag_messages').insert({ conversation_id: convId, role: 'user', content: message });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: CONFIG.chatModel,
            messages: [
              { role: 'system', content: 'Tu es un assistant pédagogique. Réponds selon tes connaissances générales en précisant que cela ne vient pas de documents officiels.' },
              ...(hist || []).map((m: any) => ({ role: m.role, content: m.content })),
              { role: 'user', content: message }
            ],
            temperature: 0.4,
          }),
        });
        
        const data = await response.json();
        const answer = data.choices[0]?.message?.content || 'Erreur IA.';
        const tokensUsed = data.usage?.total_tokens || 0;

        await serviceClient.from('rag_messages').insert({ conversation_id: convId, role: 'assistant', content: answer, sources: [] });
        await deductTokens(serviceClient, user.id, tokensUsed);
        return new Response(JSON.stringify({ answer, sources: [], conversationId: convId, tokensUsed, mode: 'ai_generalist' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ answer: "Aucun document accessible. Activez l'IA pour une réponse générique.", sources: [], tokensUsed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // RECHERCHE
    let queries = [message];
    let totalTokens = 0;

    if (searchMode === 'precise') {
       const rw = await rewriteQueryForSearch(message, OPENAI_API_KEY);
       queries = rw.queries; 
       totalTokens += rw.tokensUsed;
    }

    const embeddingPromise = createEmbedding(queries[0], OPENAI_API_KEY);
    const keyTerms = extractKeyTerms(queries.join(' ')); 

    const [embedding, keywordResults, domainSpecificResults] = await Promise.all([
        embeddingPromise,
        searchByKeywords(serviceClient, allowedDocIdsArr, keyTerms),
        activeDomain ? 
            serviceClient.from('rag_chunks')
            .select('id, document_id, chunk_index, content, scope')
            .in('document_id', allowedDocIdsArr.filter(id => isDomainDocument(allowedDocsMap.get(id)?.title || '', activeDomain!)))
            .limit(10)
            .then((res: any) => (res.data || []).map((c: any) => ({
                id: c.id, documentId: c.document_id, documentTitle: '', chunkIndex: c.chunk_index,
                content: c.content, score: 1.0, scope: c.scope, sourceType: 'domain'
            })))
            : Promise.resolve([])
    ]);

    const vectorResults = await searchByVector(serviceClient, user.id, embedding, CONFIG.defaultTopK, allowedDocIdsSet);

    // FUSION + BOOST
    let candidates = fuseResultsWithBoost(vectorResults, keywordResults, domainSpecificResults, allowedDocsMap, keyTerms);

    // Bonus Doc Reference (Optionnel)
    candidates = candidates.map(c => {
        let boost = 1;
        if (isReferenceDocument(c.documentTitle)) boost += 0.05;
        if (activeDomain && isDomainDocument(c.documentTitle, activeDomain)) boost += activeDomain.bonus;
        return { ...c, score: Math.min(0.99, c.score * boost) };
    }); // On ne re-trie pas ici, le Boost RRF a déjà fait le travail

    const finalChunks = candidates.slice(0, CONFIG.finalChunkCount);

    console.log(`[rag-chat] Top Doc: ${finalChunks[0]?.documentTitle}`);

    let convId = conversationId;
    if (!convId) {
      const { data } = await serviceClient.from('rag_conversations').insert({ user_id: user.id }).select('id').single();
      convId = data?.id;
    }

    const { data: hist } = await serviceClient.from('rag_messages')
        .select('role, content')
        .eq('conversation_id', convId).order('created_at', { ascending: true }).limit(6);

    await serviceClient.from('rag_messages').insert({ conversation_id: convId, role: 'user', content: message });

    const { answer, tokens } = await generateResponse(message, finalChunks, effectiveMode, hist || [], activeDomain, OPENAI_API_KEY);
    totalTokens += tokens;

    const sources = finalChunks.map(c => ({
      documentId: c.documentId, documentTitle: c.documentTitle, chunkId: c.id, chunkIndex: c.chunkIndex,
      excerpt: c.content.substring(0, CONFIG.excerptLength), score: c.score, scope: c.scope
    }));

    await serviceClient.from('rag_messages').insert({ conversation_id: convId, role: 'assistant', content: answer, sources });
    await deductTokens(serviceClient, user.id, totalTokens);

    return new Response(JSON.stringify({
      answer, sources, conversationId: convId, tokensUsed: totalTokens
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

Deno.serve(chatHandler);
