// supabase/functions/rag-chat/index.ts
// VERSION "MULTI-DOMAINES" (V1 Intelligence + V2 Sécurité + Architecture Générique)
// - Supporte: LANGUES (CECR), EPS, SCIENCES, HUMANITES (Configurable)
// - Sécurité: Filtrage strict des documents autorisés
// - Ranking: Hybride (Ne supprime pas les documents pertinents)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

// ============================================================================
// 1. CONFIGURATION DES DOMAINES MÉTIER (Le Cœur du Système)
// ============================================================================

interface DomainConfig {
  id: string;
  name: string;
  keywords: RegExp[];       // Regex pour détecter l'intention dans la question
  docPatterns: string[];    // Mots-clés pour identifier les documents (titre)
  bonus: number;            // Bonus de score
  minDocs: number;          // Minimum de documents à garantir (Rescue)
  promptRole: string;       // Rôle pour le prompt système
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
    bonus: 0.25,
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
    bonus: 0.20,
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
    bonus: 0.15,
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
    bonus: 0.15,
    minDocs: 2,
    promptRole: "Expert en humanités et culture générale"
  }
};

const CONFIG = {
  // Recherche
  defaultTopK: 8,
  maxTopK: 15,
  similarityThreshold: 0.28,
  
  // Bonus générique (hors domaines)
  referenceDocBonus: 0.10, // Bonus pour tout document "officiel" (Programme, Guide...)
  
  // Modèles
  chatModel: 'gpt-4o-mini',
  embeddingModel: 'text-embedding-3-large',
  embeddingDimensions: 1536,
  
  // LLM Helpers
  queryRewritingModel: 'gpt-4o-mini',
  hydeModel: 'gpt-4o-mini',
  rerankingModel: 'gpt-4o-mini',
  
  // Paramètres Re-ranking Hybride
  rerankingChunkCount: 25,
  rerankingContextLength: 1000,
  finalChunkCount: 10,
  
  // Historique
  maxHistoryMessages: 10,
  excerptLength: 450,
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
  // 🆕 Nouveaux paramètres pour la sélection des corpus
  usePersonalCorpus?: boolean;
  useProfAssistCorpus?: boolean;
  useAI?: boolean;
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
  scope?: 'global' | 'user';
  rerankScore?: number;
  llmRawScore?: number;
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

// ============================================================================
// HELPERS - CORS & AUTH
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

// ============================================================================
// INTELLIGENCE MÉTIER & DÉTECTION
// ============================================================================

// 1. Détection du Domaine
function detectDomainIntent(query: string): DomainConfig | null {
  for (const domain of Object.values(DOMAINS)) {
    if (domain.keywords.some(regex => regex.test(query))) {
      console.log(`[rag-chat] Domain detected: ${domain.id}`);
      return domain;
    }
  }
  return null;
}

// 2. Identification Document <-> Domaine
function isDomainDocument(docTitle: string, domain: DomainConfig): boolean {
  const titleLower = docTitle.toLowerCase();
  return domain.docPatterns.some(p => titleLower.includes(p));
}

// 3. Identification Document "Officiel" (Générique)
function isReferenceDocument(title: string): boolean {
  return /programme|guide|référentiel|officiel|accompagnement/i.test(title.toLowerCase());
}

// 4. Détection Comparative (V1 Logic)
function isComparativeQuestion(query: string): boolean {
  const comparativePatterns = [
    /diff[ée]ren/i, /compar/i, /entre.+et/i, /versus|vs/i, /par rapport/i,
    /contrairement/i, /similitude/i, /commun/i, /cycle\s*\d.+cycle\s*\d/i,
    /niveau\s*[A-C][1-2].+niveau\s*[A-C][1-2]/i,
  ];
  return comparativePatterns.some(p => p.test(query));
}

function extractComparisonTargets(query: string): string[] {
  const targets: string[] = [];
  const cycleMatches = query.match(/cycle\s*(\d)/gi);
  if (cycleMatches) {
    const seenNums = new Set<string>();
    cycleMatches.forEach(m => {
      const num = m.match(/\d/)?.[0];
      if (num && !seenNums.has(num)) { seenNums.add(num); targets.push(`cycle_${num}`); }
    });
  }
  // Extraction spécifique pour le domaine Langues (legacy support)
  const cecrMatches = query.match(/\b[A-Ca-c][1-2]\b/gi);
  if (cecrMatches) {
    const seen = new Set<string>();
    cecrMatches.forEach(m => {
      const l = m.toUpperCase();
      if (!seen.has(l)) { seen.add(l); targets.push(`cecr_${l}`); }
    });
  }
  return targets;
}

// Helper pour Langues (V1)
function extractCECRLevels(query: string): string[] {
  const matches = query.match(/\b[A-Ca-c][1-2]\b/gi);
  return matches ? [...new Set(matches.map(m => m.toUpperCase()))] : [];
}

// ============================================================================
// HyDE: HYPOTHETICAL DOCUMENT EMBEDDINGS (ADAPTATIF)
// ============================================================================

async function generateHypotheticalAnswer(
  query: string,
  domain: DomainConfig | null,
  apiKey: string
): Promise<{ hypotheticalAnswer: string; tokensUsed: number }> {
  const isComparative = isComparativeQuestion(query);
  const targets = extractComparisonTargets(query);

  let prompt: string;
  
  if (domain?.id === 'LANGUES') {
    // Prompt Spécifique Langues (V1)
    const levels = extractCECRLevels(query).join(', ') || 'les niveaux';
    prompt = `Tu es un ${domain.promptRole}. Génère une réponse technique sur "${query}".
    IMPORTANT (${levels}):
    - Utilise vocabulaire CECR: descripteurs, production/réception.
    - Décris ce que l'élève "peut faire".
    - 200-400 mots.`;
  } else if (domain?.id === 'EPS') {
    // Prompt Spécifique EPS
    prompt = `Tu es un ${domain.promptRole}. Réponds à "${query}".
    IMPORTANT:
    - Utilise le vocabulaire officiel (Champs d'Apprentissage, AFC, Attendus).
    - Mentionne les conduites motrices et situations d'apprentissage.
    - 200-400 mots.`;
  } else if (isComparative && targets.length >= 2) {
    // Prompt Comparatif V1
    prompt = `Expert Programmes Scolaires. Compare explicitement ${targets.map(t => t.replace('_', ' ')).join(' et ')} pour "${query}".
    - Structure par différences et similitudes.
    - Spécificités de chaque cycle.`;
  } else {
    // Prompt Standard
    prompt = `Expert Éducation Nationale. Réponds factuellement à "${query}".
    - Utilise le vocabulaire officiel.
    - Structure claire.`;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.hydeModel,
        messages: [{ role: 'system', content: 'Tu es un expert pédagogique.' }, { role: 'user', content: prompt }],
        temperature: 0.3, max_tokens: 600,
      }),
    });

    if (!response.ok) return { hypotheticalAnswer: query, tokensUsed: 0 };
    const data = await response.json();
    return { hypotheticalAnswer: data.choices[0]?.message?.content || query, tokensUsed: data.usage?.total_tokens || 0 };
  } catch (error) {
    console.warn('[rag-chat] HyDE error:', error);
    return { hypotheticalAnswer: query, tokensUsed: 0 };
  }
}

// ============================================================================
// QUERY REWRITING (ADAPTATIF)
// ============================================================================

async function rewriteQueryForSearch(
  query: string,
  domain: DomainConfig | null,
  apiKey: string
): Promise<{ queries: string[]; tokensUsed: number }> {
  let prompt: string;
  
  if (domain?.id === 'LANGUES') {
    const levels = extractCECRLevels(query).join(', ');
    prompt = `Expert Recherche CECR. Question: "${query}"
    Génère des mots-clés ciblant:
    1. Termes CECR (descripteurs, compétences)
    2. Niveaux spécifiques (${levels})
    JSON: {"queries": ["q1", "q2", ...]}`;
  } else if (domain?.id === 'EPS') {
    prompt = `Expert Recherche EPS. Question: "${query}"
    Génère des mots-clés ciblant:
    1. Champs d'apprentissage
    2. Activités physiques (APSA)
    3. Compétences visées
    JSON: {"queries": ["q1", "q2", ...]}`;
  } else {
    prompt = `Expert Recherche Éducation. Reformule: "${query}" pour moteur documentaire.
    Utilise synonymes officiels et niveaux scolaires.
    JSON: {"queries": ["q1", "q2", ...]}`;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.queryRewritingModel,
        messages: [{ role: 'system', content: 'JSON only.' }, { role: 'user', content: prompt }],
        temperature: 0.3, max_tokens: 300,
      }),
    });
    if (!response.ok) return { queries: [query], tokensUsed: 0 };
    const data = await response.json();
    const jsonMatch = data.choices[0]?.message?.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { queries: [query, ...(parsed.queries || [])].slice(0, 6), tokensUsed: data.usage?.total_tokens || 0 };
    }
    return { queries: [query], tokensUsed: data.usage?.total_tokens || 0 };
  } catch (error) {
    return { queries: [query], tokensUsed: 0 };
  }
}

// ============================================================================
// EXTRACTION TERMES-CLÉS (ÉLARGIE)
// ============================================================================

function extractKeyTerms(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const terms: string[] = [];

  const mappings: Record<string, string[]> = {
    // Cycles
    'maternelle': ['cycle 1'], 'cycle 1': ['maternelle'],
    'cycle 2': ['CP', 'CE1', 'CE2'],
    'cycle 3': ['CM1', 'CM2', '6e'], 'cycle 4': ['5e', '4e', '3e'],
    // EPS
    'eps': ['éducation physique', 'sport', 'apsa'],
    'sport': ['eps', 'éducation physique'],
    // Langues
    'a1': ['A1', 'débutant'], 'a2': ['A2', 'élémentaire'],
    'b1': ['B1', 'indépendant'], 'b2': ['B2', 'avancé'],
    'c1': ['C1', 'autonome'],
    'cecr': ['cadre européen', 'descripteur'],
    // Maths
    'math': ['mathématiques', 'calcul'], 'géométrie': ['figure', 'espace'],
  };

  // Mots simples
  query.split(/[\s,.?!]+/).forEach(w => {
    if (w.length > 3 && !['pour','avec','dans','quel','comment'].includes(w.toLowerCase())) terms.push(w);
  });

  // Regex Niveaux
  const levelMatch = query.match(/\b([A-Ca-c][1-2])\b/g);
  if (levelMatch) levelMatch.forEach(l => terms.push(l.toUpperCase()));

  // Mapping
  for (const [k, v] of Object.entries(mappings)) {
    if (lowerQuery.includes(k)) terms.push(...v);
  }

  return [...new Set(terms)];
}

// ============================================================================
// GESTION DOCUMENTS (SÉCURITÉ V2)
// ============================================================================

// 🆕 Fonction mise à jour avec filtrage selon les switches
async function getAllowedDocuments(
  supabase: any, 
  userId: string, 
  docId?: string,
  usePersonalCorpus: boolean = true,
  useProfAssistCorpus: boolean = true
): Promise<Map<string, DocumentInfo>> {
  const docsMap = new Map<string, DocumentInfo>();
  console.log(`[rag-chat] === SECURITY: Fetching allowed documents ===`);
  console.log(`[rag-chat] Filters: personal=${usePersonalCorpus}, profassist=${useProfAssistCorpus}`);

  // Si aucun corpus sélectionné, retourner vide
  if (!usePersonalCorpus && !useProfAssistCorpus) {
    console.log(`[rag-chat] No corpus selected, returning empty`);
    return docsMap;
  }

  let query = supabase.from('rag_documents').select('id, title, scope, user_id').eq('status', 'ready');
  
  if (docId) {
    query = query.eq('id', docId);
  } else {
    // 🆕 Construire le filtre selon les switches
    const filters: string[] = [];
    if (useProfAssistCorpus) {
      filters.push('scope.eq.global');
    }
    if (usePersonalCorpus) {
      filters.push(`and(scope.eq.user,user_id.eq.${userId})`);
    }
    
    if (filters.length === 1) {
      // Un seul filtre
      if (useProfAssistCorpus) {
        query = query.eq('scope', 'global');
      } else {
        query = query.eq('scope', 'user').eq('user_id', userId);
      }
    } else {
      // Les deux filtres
      query = query.or(`scope.eq.global,and(scope.eq.user,user_id.eq.${userId})`);
    }
  }

  const { data } = await query;
  if (data) {
    data.forEach((d: any) => docsMap.set(d.id, { id: d.id, title: d.title, scope: d.scope }));
    console.log(`[rag-chat] Allowed docs count: ${data.length}`);
  }
  return docsMap;
}


// ============================================================================
// EMBEDDINGS
// ============================================================================

async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.embeddingModel,
        input: text.replace(/\n/g, ' '),
        dimensions: CONFIG.embeddingDimensions,
      }),
    });
    if (!response.ok) throw new Error(`Embedding API Error: ${response.statusText}`);
    const data = await response.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error('[rag-chat] Embedding Error:', err);
    throw err;
  }
}

// ============================================================================
// STRATÉGIES DE RECHERCHE (V1 + V2 Unifiées)
// ============================================================================

// 1. Vectorielle
async function searchByVector(supabase: any, userId: string, embedding: number[], topK: number, allowedDocIds: Set<string>): Promise<MatchedChunk[]> {
  try {
    const { data, error } = await supabase.rpc('match_rag_chunks', {
      p_query_embedding: `[${embedding.join(',')}]`,
      p_similarity_threshold: CONFIG.similarityThreshold,
      p_match_count: topK * 3,
      p_user_id: userId,
      p_document_id: null,
    });

    if (error) return [];

    return (data || [])
      .filter((item: any) => allowedDocIds.has(item.document_id))
      .map((item: any) => ({
        id: item.id, documentId: item.document_id, documentTitle: item.document_title,
        chunkIndex: item.chunk_index, content: item.content, score: item.similarity, scope: item.scope,
      }));
  } catch (err) { return []; }
}

// 2. Mots-clés (Robust V2)
async function searchByKeywords(
  supabase: any,
  allowedDocIds: string[],
  allowedDocs: Map<string, DocumentInfo>,
  keywords: string[]
): Promise<MatchedChunk[]> {
  if (keywords.length === 0 || allowedDocIds.length === 0) return [];
  
  const chunkScores = new Map<string, { chunk: MatchedChunk; score: number }>();
  const effectiveKeywords = keywords.slice(0, 5);

  for (const keyword of effectiveKeywords) {
    if (keyword.length < 3) continue;
    const { data: chunks } = await supabase
      .from('rag_chunks')
      .select('id, document_id, chunk_index, content, scope')
      .in('document_id', allowedDocIds)
      .ilike('content', `%${keyword}%`)
      .limit(8);

    if (chunks) {
      for (const chunk of chunks) {
        const doc = allowedDocs.get(chunk.document_id);
        if (!doc) continue;
        
        const key = chunk.id;
        const existing = chunkScores.get(key);
        const titleBonus = doc.title.toLowerCase().includes(keyword.toLowerCase()) ? 0.2 : 0;

        if (existing) {
          existing.score += 0.3 + titleBonus;
        } else {
          chunkScores.set(key, {
            chunk: {
              id: chunk.id, documentId: doc.id, documentTitle: doc.title,
              chunkIndex: chunk.chunk_index, content: chunk.content,
              score: 0.70 + titleBonus, scope: chunk.scope as any || doc.scope,
            },
            score: 0.70 + titleBonus,
          });
        }
      }
    }
  }
  return Array.from(chunkScores.values()).sort((a, b) => b.score - a.score).map(i => i.chunk);
}

// 3. Recherche Spécifique Domaine (Généralisation de searchCECRDocuments)
async function searchSpecificDomainDocuments(
  supabase: any,
  allowedDocs: Map<string, DocumentInfo>,
  domain: DomainConfig,
  query: string
): Promise<MatchedChunk[]> {
  const targetDocIds: string[] = [];
  
  // Filtrer les documents qui correspondent au pattern du domaine (ex: contient "EPS")
  allowedDocs.forEach((doc, id) => {
    if (isDomainDocument(doc.title, domain)) targetDocIds.push(id);
  });

  if (targetDocIds.length === 0) return [];
  console.log(`[rag-chat] Searching specific ${domain.id} docs (${targetDocIds.length} found)...`);

  const { data: chunks } = await supabase
    .from('rag_chunks')
    .select('id, document_id, chunk_index, content, scope')
    .in('document_id', targetDocIds)
    .limit(30);

  const results: MatchedChunk[] = [];
  
  if (chunks) {
    for (const chunk of chunks) {
      const contentLower = chunk.content.toLowerCase();
      let score = 0.85; // Base élevée car doc spécifique

      // Bonus si mots-clés de la query présents
      const queryWords = extractKeyTerms(query);
      let matches = 0;
      queryWords.forEach(w => { if (contentLower.includes(w.toLowerCase())) matches++; });
      
      score += (matches * 0.05);

      if (matches > 0 || domain.id === 'LANGUES') { // Pour langues on est plus permissif (niveaux)
         results.push({
           id: chunk.id, documentId: chunk.document_id, documentTitle: allowedDocs.get(chunk.document_id)!.title,
           chunkIndex: chunk.chunk_index, content: chunk.content, score, scope: chunk.scope as any
         });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 15);
}

// ============================================================================
// LOGIQUE MÉTIER & BONUS (V2 GENERALISÉE)
// ============================================================================

function applyDomainBonus(
  chunks: MatchedChunk[],
  domain: DomainConfig | null
): MatchedChunk[] {
  console.log(`[rag-chat] Applying Domain Bonuses (${domain?.id || 'None'})...`);
  
  return chunks.map(chunk => {
    let newScore = chunk.score;
    
    // 1. Bonus Document Officiel (Générique)
    if (isReferenceDocument(chunk.documentTitle)) newScore += CONFIG.referenceDocBonus;

    // 2. Bonus Domaine Spécifique
    if (domain && isDomainDocument(chunk.documentTitle, domain)) {
      newScore += domain.bonus;
    }
    
    return { ...chunk, score: newScore };
  }).sort((a, b) => b.score - a.score);
}

function ensureDomainDocuments(
  chunks: MatchedChunk[],
  allAvailableChunks: MatchedChunk[],
  domain: DomainConfig | null,
  topK: number
): MatchedChunk[] {
  if (!domain) return chunks.slice(0, topK);

  const domainChunks = chunks.filter(c => isDomainDocument(c.documentTitle, domain));
  
  if (domainChunks.length >= domain.minDocs) return chunks.slice(0, topK);

  console.log(`[rag-chat] Rescue: Injecting missing ${domain.id} documents...`);
  
  const existingIds = new Set(chunks.map(c => c.id));
  const missingCount = domain.minDocs - domainChunks.length;
  
  const rescueChunks = allAvailableChunks
    .filter(c => isDomainDocument(c.documentTitle, domain) && !existingIds.has(c.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, missingCount);
    
  const merged = [...chunks, ...rescueChunks].sort((a, b) => b.score - a.score);
  return merged.slice(0, topK);
}

// ============================================================================
// RE-RANKING (HYBRIDE & DOUX)
// ============================================================================

async function rerankChunksWithLLM(
  query: string,
  chunks: MatchedChunk[],
  topN: number,
  apiKey: string
): Promise<{ chunks: MatchedChunk[]; tokensUsed: number }> {
  if (chunks.length <= 5) return { chunks: chunks.slice(0, topN), tokensUsed: 0 };

  console.log(`[rag-chat] Re-ranking ${chunks.length} chunks...`);

  const excerpts = chunks.slice(0, CONFIG.rerankingChunkCount).map((chunk, index) => ({
    id: index, title: chunk.documentTitle, 
    text: chunk.content.substring(0, CONFIG.rerankingContextLength),
  }));

  const prompt = `Évalue la pertinence (0-10) pour: "${query}"
  - 10: Réponse directe.
  - 5: Pertinent.
  - 0: Hors sujet.
  
  Extraits:
  ${excerpts.map(e => `[${e.id}] (${e.title})\n${e.text}`).join('\n\n')}
  
  JSON: {"scores": [{"id": 0, "score": 8}, ...]}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.rerankingModel,
        messages: [{ role: 'system', content: 'JSON only.' }, { role: 'user', content: prompt }],
        temperature: 0.1, max_tokens: 800,
      }),
    });

    const data = await response.json();
    const jsonMatch = data.choices[0]?.message?.content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const scoreMap = new Map(parsed.scores?.map((s: any) => [s.id, s.score]) || []);

      const reranked = chunks.map((chunk, index) => {
        const llmScore = scoreMap.get(index) ?? 5;
        // Hybride: 40% initial, 60% LLM
        const hybridScore = (chunk.score * 0.4) + ((llmScore / 10) * 0.6);
        return { ...chunk, rerankScore: hybridScore, llmRawScore: llmScore };
      });

      reranked.sort((a, b) => b.rerankScore! - a.rerankScore!);

      // Filtrage doux (on garde si > 0 ou si c'est nécessaire pour le topN)
      const valid = reranked.filter(c => c.llmRawScore! > 0);
      return { chunks: (valid.length >= topN ? valid : reranked).slice(0, topN), tokensUsed: data.usage?.total_tokens || 0 };
    }
  } catch (err) {
    console.warn('[rag-chat] Rerank fail', err);
  }
  return { chunks: chunks.slice(0, topN), tokensUsed: 0 };
}

// ============================================================================
// GÉNÉRATION & HANDLER
// ============================================================================

async function generateResponse(
  query: string,
  chunks: MatchedChunk[],
  mode: ChatMode,
  history: any[],
  domain: DomainConfig | null,
  apiKey: string
): Promise<{ answer: string; tokens: number }> {
  if (chunks.length === 0) return { answer: "Je n'ai pas trouvé d'information.", tokens: 0 };

  const context = chunks.map((c, i) => `[Source ${i + 1}] ${c.documentTitle}\n${c.content}`).join('\n\n---\n\n');

  // Prompt Système Dynamique
  let roleDesc = domain ? domain.promptRole : "assistant pédagogique expert";
  
  let systemPrompt = `Tu es un ${roleDesc}.
  ${mode === 'corpus_only' ? "Utilise UNIQUEMENT les sources." : "Utilise les sources en priorité."}
  RÈGLES:
  1. Cite les sources [Source X].
  2. Structure ta réponse.
  3. ${domain?.id === 'LANGUES' ? "Utilise terminologie CECR." : ""}
  4. ${domain?.id === 'EPS' ? "Utilise terminologie APSA/Champs d'apprentissage." : ""}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: `SOURCES:\n${context}\n\nQUESTION: ${query}\n\nRéponse:` }
      ],
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  return { answer: data.choices[0]?.message?.content || 'Erreur.', tokens: data.usage?.total_tokens || 0 };
}

async function chatHandler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Err', { status: 405, headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Auth Missing');

    const supabase = await createSupabaseClient(authHeader);
    const serviceClient = await createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User Invalid');

    const { 
  message, 
  mode = 'corpus_plus_ai', 
  searchMode = 'fast', 
  conversationId, 
  documentId,
  // 🆕 Nouveaux paramètres avec valeurs par défaut
  usePersonalCorpus = true,
  useProfAssistCorpus = true,
  useAI = false
} = await req.json() as ChatRequest;

// 🆕 Déterminer le mode effectif basé sur useAI
const effectiveMode: ChatMode = useAI ? 'corpus_plus_ai' : 'corpus_only';


    console.log(`[rag-chat] Handling: "${message}"`);

    // 1. SÉCURITÉ: Docs autorisés
    // 🆕 Passer les switches à la fonction
const allowedDocsMap = await getAllowedDocuments(
  serviceClient, 
  user.id, 
  documentId,
  usePersonalCorpus,
  useProfAssistCorpus
);

    const allowedDocIdsArr = Array.from(allowedDocsMap.keys());
    const allowedDocIdsSet = new Set(allowedDocIdsArr);
    // 🆕 Gestion du cas "IA seule" (aucun corpus mais useAI activé)
if (allowedDocIdsArr.length === 0) {
  if (useAI && !usePersonalCorpus && !useProfAssistCorpus) {
    // Mode IA seule - répondre directement sans recherche de documents
    console.log(`[rag-chat] AI-only mode, no corpus search`);
    
    let convId = conversationId;
    if (!convId) {
      const {data} = await serviceClient.from('rag_conversations').insert({user_id: user.id}).select('id').single();
      convId = data.id;
    }
    
    const { data: hist } = await serviceClient.from('rag_messages').select('role, content').eq('conversation_id', convId).limit(CONFIG.maxHistoryMessages);
    await serviceClient.from('rag_messages').insert({conversation_id: convId, role: 'user', content: message});
    
    // Générer une réponse IA sans contexte documentaire
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.chatModel,
        messages: [
          { role: 'system', content: 'Tu es un assistant pédagogique expert. Réponds de manière claire et structurée.' },
          ...(hist || []),
          { role: 'user', content: message }
        ],
        temperature: 0.3,
      }),
    });
    
    const data = await response.json();
    const answer = data.choices[0]?.message?.content || 'Erreur lors de la génération.';
    const tokensUsed = data.usage?.total_tokens || 0;
    
    await serviceClient.from('rag_messages').insert({conversation_id: convId, role: 'assistant', content: answer, sources: []});
    
    // Déduire les tokens
    serviceClient.from('profiles').select('tokens').eq('user_id', user.id).single()
      .then(({data}) => { if(data) serviceClient.from('profiles').update({tokens: Math.max(0, data.tokens - tokensUsed)}).eq('user_id', user.id); });
    
    return new Response(JSON.stringify({
      answer, 
      sources: [], 
      conversationId: convId, 
      tokensUsed, 
      mode: 'corpus_plus_ai',
      searchMode: 'fast'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
  
  return new Response(JSON.stringify({ 
    answer: "Aucun document disponible dans les corpus sélectionnés.", 
    sources: [],
    conversationId: null,
    tokensUsed: 0,
    mode: effectiveMode
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
}


    // 2. DÉTECTION
    const activeDomain = detectDomainIntent(message);
    const isComparative = isComparativeQuestion(message);
    const effectiveSearchMode = (activeDomain || isComparative || searchMode === 'precise') ? 'precise' : 'fast';
    let totalTokens = 0;

    // 3. PRÉPARATION (HyDE / Rewrite)
    let hypothetical = message;
    if (effectiveSearchMode === 'precise') {
      const h = await generateHypotheticalAnswer(message, activeDomain, OPENAI_API_KEY);
      hypothetical = h.hypotheticalAnswer;
      totalTokens += h.tokensUsed;
    }

    let queries = [message];
    if (effectiveSearchMode === 'precise') {
      const rw = await rewriteQueryForSearch(message, activeDomain, OPENAI_API_KEY);
      queries = rw.queries;
      totalTokens += rw.tokensUsed;
    }

    // Embeddings
    const qEmb = await createEmbedding(message, OPENAI_API_KEY);
    const hEmb = effectiveSearchMode === 'precise' ? await createEmbedding(hypothetical, OPENAI_API_KEY) : [];
    totalTokens += Math.ceil((message.length + hypothetical.length) / 4);

    // 4. RECHERCHE UNIFIÉE
    const allChunks: MatchedChunk[] = [];
    const seenIds = new Set<string>();
    const add = (arr: MatchedChunk[]) => arr.forEach(c => { if(!seenIds.has(c.id)) { seenIds.add(c.id); allChunks.push(c); }});

    // A. Recherche Spécifique Domaine
    if (activeDomain) {
      add(await searchSpecificDomainDocuments(serviceClient, allowedDocsMap, activeDomain, message));
    }

    // B. Recherche Mots-clés (Sur variantes)
    for (const q of queries.slice(0, 3)) {
      add(await searchByKeywords(serviceClient, allowedDocIdsArr, allowedDocsMap, extractKeyTerms(q)));
    }

    // C. Vectorielle
    if (hEmb.length > 0) {
      const hydeRes = await searchByVector(serviceClient, user.id, hEmb, CONFIG.defaultTopK, allowedDocIdsSet);
      hydeRes.forEach(c => c.score *= 1.1); // Boost HyDE
      add(hydeRes);
    }
    add(await searchByVector(serviceClient, user.id, qEmb, CONFIG.defaultTopK, allowedDocIdsSet));

    // 5. CLASSEMENT & LOGIQUE MÉTIER
    let candidates = applyDomainBonus(allChunks, activeDomain);

    if (effectiveSearchMode === 'precise') {
      const rr = await rerankChunksWithLLM(message, candidates, CONFIG.finalChunkCount, OPENAI_API_KEY);
      candidates = rr.chunks;
      totalTokens += rr.tokensUsed;
    } else {
      candidates = candidates.slice(0, CONFIG.finalChunkCount);
    }

    // Sauvetage (Rescue)
    candidates = ensureDomainDocuments(candidates, allChunks, activeDomain, CONFIG.finalChunkCount);
    console.log(`[rag-chat] Final count: ${candidates.length}`);

    // 6. GÉNÉRATION
    let convId = conversationId;
    if (!convId) {
      const {data} = await serviceClient.from('rag_conversations').insert({user_id: user.id}).select('id').single();
      convId = data.id;
    }
    const { data: hist } = await serviceClient.from('rag_messages').select('role, content').eq('conversation_id', convId).limit(CONFIG.maxHistoryMessages);
    await serviceClient.from('rag_messages').insert({conversation_id: convId, role: 'user', content: message});

    // Ligne ~820
const { answer, tokens } = await generateResponse(message, candidates, effectiveMode, hist || [], activeDomain, OPENAI_API_KEY);

    totalTokens += tokens;

    const sources = candidates.map(c => ({
      documentId: c.documentId, documentTitle: c.documentTitle, chunkId: c.id, chunkIndex: c.chunkIndex,
      excerpt: c.content.substring(0, CONFIG.excerptLength), score: c.score, scope: c.scope
    }));
    await serviceClient.from('rag_messages').insert({conversation_id: convId, role: 'assistant', content: answer, sources});
    
    serviceClient.from('profiles').select('tokens').eq('user_id', user.id).single()
      .then(({data}) => { if(data) serviceClient.from('profiles').update({tokens: Math.max(0, data.tokens - totalTokens)}).eq('user_id', user.id); });

return new Response(JSON.stringify({
  answer, sources, conversationId: convId, tokensUsed: totalTokens, mode: effectiveMode, searchMode: effectiveSearchMode
}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});


  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({error: e.message}), {status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'}});
  }
}

Deno.serve(chatHandler);


