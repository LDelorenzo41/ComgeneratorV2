// supabase/functions/rag-ingest/index.ts
// Version avec support scope global/user
// + Chunking sémantique optimisé + tracking bêta
// + ENRICHISSEMENT CONTEXTE DOCUMENT pour meilleure recherche RAG
// + DOUBLE QUOTA: stockage permanent + import mensuel
// + EMBEDDING: text-embedding-3-large pour meilleure précision

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const CHUNK_CONFIG = {
  targetSentences: 6,
  maxSentences: 9,
  minSentences: 2,
  overlapSentences: 1,
  maxChunkChars: 2000,
  minChunkChars: 120,
};

const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-large',  // 🔄 UPGRADED: meilleure précision
  batchSize: 10,
};

const BETA_CONFIG = {
  storageLimit: 100000,
  monthlyImportLimit: 100000,
};

// ============================================================================
// TYPES
// ============================================================================

type DocumentScope = 'global' | 'user';

interface Section {
  title: string | null;
  content: string;
  level: number;
}

interface EnhancedChunkData {
  content: string;
  contextualContent: string;
  embeddingContent: string;
  chunkIndex: number;
  contentHash: string;
  tokenCount: number;
  metadata: {
    sectionTitle: string | null;
    documentContext: string;
    sentenceCount: number;
    charCount: number;
  };
}

interface EmbeddingResult {
  embeddings: number[][];
  tokensUsed: number;
}

interface BetaLimitCheck {
  canProceed: boolean;
  currentStorageUsage: number;
  storageLimit: number;
  monthlyImportUsage: number;
  monthlyImportLimit: number;
  resetDate: string | null;
  errorMessage?: string;
}

// ============================================================================
// VÉRIFICATION ADMIN POUR DOCUMENTS GLOBAUX
// ============================================================================

async function isAdminUser(
  supabase: SupabaseClient,
  userId: string,
  adminSecretHeader: string | null
): Promise<boolean> {
  const adminSecret = Deno.env.get('ADMIN_SECRET');
  if (adminSecret && adminSecretHeader === adminSecret) {
    console.log('Admin access via ADMIN_SECRET');
    return true;
  }

  const adminUserIds = Deno.env.get('ADMIN_USER_IDS');
  if (adminUserIds) {
    const adminList = adminUserIds.split(',').map(id => id.trim());
    if (adminList.includes(userId)) {
      console.log('Admin access via ADMIN_USER_IDS');
      return true;
    }
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();
    
    if (profile?.is_admin === true) {
      console.log('Admin access via profiles.is_admin');
      return true;
    }
  } catch {
    // Colonne n'existe peut-être pas, on ignore
  }

  return false;
}

// ============================================================================
// GESTION DES TOKENS BÊTA - DOUBLE QUOTA
// ============================================================================

async function getCurrentStorageTokens(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('rag_chunks')
    .select('token_count')
    .eq('user_id', userId)
    .eq('scope', 'user');

  if (error || !data) {
    console.warn('Error calculating storage tokens:', error);
    return 0;
  }

  return data.reduce((sum, chunk) => sum + (chunk.token_count || 0), 0);
}

async function checkBetaLimit(
  supabase: SupabaseClient,
  userId: string,
  estimatedNewTokens: number = 0
): Promise<BetaLimitCheck> {
  const currentStorageUsage = await getCurrentStorageTokens(supabase, userId);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('rag_beta_tokens_used, rag_beta_tokens_limit, rag_beta_reset_date')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.warn('Error fetching profile for beta limit:', error);
  }

  let monthlyImportUsage = profile?.rag_beta_tokens_used || 0;
  const monthlyImportLimit = profile?.rag_beta_tokens_limit || BETA_CONFIG.monthlyImportLimit;
  let resetDate = profile?.rag_beta_reset_date;

  if (resetDate && new Date(resetDate) <= new Date()) {
    await supabase
      .from('profiles')
      .update({
        rag_beta_tokens_used: 0,
        rag_beta_reset_date: getNextMonthDate(),
      })
      .eq('user_id', userId);

    monthlyImportUsage = 0;
    resetDate = getNextMonthDate();
    console.log(`Monthly import quota reset for user ${userId}`);
  }

  const wouldExceedStorage = (currentStorageUsage + estimatedNewTokens) > BETA_CONFIG.storageLimit;
  const wouldExceedMonthly = (monthlyImportUsage + estimatedNewTokens) > monthlyImportLimit;

  let errorMessage: string | undefined;
  
  if (wouldExceedStorage) {
    const available = Math.max(0, BETA_CONFIG.storageLimit - currentStorageUsage);
    errorMessage = `Limite de stockage atteinte (${currentStorageUsage.toLocaleString('fr-FR')} / ${BETA_CONFIG.storageLimit.toLocaleString('fr-FR')} tokens). ` +
      `Espace disponible: ${available.toLocaleString('fr-FR')} tokens. ` +
      `Supprimez des documents pour libérer de l'espace.`;
  } else if (wouldExceedMonthly) {
    const available = Math.max(0, monthlyImportLimit - monthlyImportUsage);
    errorMessage = `Limite mensuelle d'import atteinte (${monthlyImportUsage.toLocaleString('fr-FR')} / ${monthlyImportLimit.toLocaleString('fr-FR')} tokens). ` +
      `Disponible ce mois: ${available.toLocaleString('fr-FR')} tokens. ` +
      `Votre quota sera réinitialisé le mois prochain.`;
  }

  return {
    canProceed: !wouldExceedStorage && !wouldExceedMonthly,
    currentStorageUsage,
    storageLimit: BETA_CONFIG.storageLimit,
    monthlyImportUsage,
    monthlyImportLimit,
    resetDate,
    errorMessage,
  };
}

async function updateBetaTokensUsed(
  supabase: SupabaseClient,
  userId: string,
  tokensUsed: number
): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('rag_beta_tokens_used, rag_beta_reset_date')
    .eq('user_id', userId)
    .single();

  const currentUsage = profile?.rag_beta_tokens_used || 0;
  const resetDate = profile?.rag_beta_reset_date || getNextMonthDate();

  await supabase
    .from('profiles')
    .update({
      rag_beta_tokens_used: currentUsage + tokensUsed,
      rag_beta_reset_date: resetDate,
    })
    .eq('user_id', userId);

  console.log(`Beta monthly import tokens updated: ${currentUsage} + ${tokensUsed} = ${currentUsage + tokensUsed}`);
}

function getNextMonthDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

// ============================================================================
// NETTOYAGE DU TEXTE
// ============================================================================

function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function normalizeText(text: string): string {
  return sanitizeText(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

// ============================================================================
// EXTRACTION DE TEXTE
// ============================================================================

async function extractText(fileData: ArrayBuffer, mimeType: string): Promise<string> {
  console.log(`Extracting text from ${mimeType}...`);

  switch (mimeType) {
    case 'text/plain':
      return sanitizeText(new TextDecoder('utf-8').decode(fileData));

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await extractTextFromDOCX(fileData);

    case 'application/pdf':
      throw new Error(
        'Les fichiers PDF doivent être convertis côté client. ' +
        'Si vous voyez cette erreur, veuillez rafraîchir la page et réessayer.'
      );

    case 'application/msword':
      throw new Error(
        'Les fichiers .doc (ancien format) ne sont pas supportés. ' +
        'Veuillez convertir en .docx puis réessayer.'
      );

    default:
      throw new Error(`Type de fichier non supporté: ${mimeType}`);
  }
}

async function extractTextFromDOCX(data: ArrayBuffer): Promise<string> {
  console.log('Extracting DOCX...');

  try {
    const zip = await JSZip.loadAsync(data);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      throw new Error('Fichier DOCX invalide ou corrompu');
    }

    const paragraphs = documentXml.split(/<w:p[^>]*>/);
    const result: string[] = [];

    for (const para of paragraphs) {
      const paraTexts = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const paraContent = paraTexts.map((m) => m.replace(/<[^>]+>/g, '')).join('');
      if (paraContent.trim()) {
        result.push(paraContent);
      }
    }

    const text = result.join('\n').trim();
    console.log(`DOCX extracted: ${text.length} characters`);

    if (text.length < 10) {
      throw new Error('Le fichier DOCX semble vide ou ne contient pas de texte extractible');
    }

    return sanitizeText(text);
  } catch (error) {
    if (error instanceof Error && error.message.includes('DOCX')) {
      throw error;
    }
    throw new Error("Erreur lors de l'extraction du fichier DOCX. Vérifiez que le fichier n'est pas corrompu.");
  }
}

// ============================================================================
// DÉTECTION DE STRUCTURE
// ============================================================================

function detectSections(text: string): Section[] {
  const sections: Section[] = [];

  const headerPatterns = [
    /^(#{1,6})\s+(.+)$/gm,
    /^([A-Z][A-Z0-9\s]{2,50})$/gm,
    /^(\d+\.?\s+[A-Z].{5,80})$/gm,
    /^([IVXLC]+\.?\s+.{5,80})$/gm,
    /^([A-Z][a-zéèêàâôûùï]+(?:\s+[a-zéèêàâôûùï]+)*)\s*:$/gm,
  ];

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());

  let currentSection: Section = { title: null, content: '', level: 0 };

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    let isHeader = false;
    let headerLevel = 0;
    let headerText = '';

    for (const pattern of headerPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(trimmedPara);
      if (match && trimmedPara.length < 100) {
        isHeader = true;
        headerLevel = match[1]?.length || 1;
        headerText = match[2] || trimmedPara;
        break;
      }
    }

    if (isHeader) {
      if (currentSection.content.trim()) {
        sections.push({ ...currentSection });
      }
      currentSection = {
        title: headerText.trim(),
        content: '',
        level: headerLevel,
      };
    } else {
      currentSection.content += (currentSection.content ? '\n\n' : '') + trimmedPara;
    }
  }

  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }

  if (sections.length === 0) {
    return [{ title: null, content: text, level: 0 }];
  }

  return sections;
}

// ============================================================================
// DÉCOUPAGE EN PHRASES
// ============================================================================

function splitIntoSentences(text: string): string[] {
  let protectedText = text
    .replace(/M\.\s/g, 'M§DOT§ ')
    .replace(/Mme\.\s/g, 'Mme§DOT§ ')
    .replace(/Mlle\.\s/g, 'Mlle§DOT§ ')
    .replace(/Dr\.\s/g, 'Dr§DOT§ ')
    .replace(/Prof\.\s/g, 'Prof§DOT§ ')
    .replace(/etc\.\s/g, 'etc§DOT§ ')
    .replace(/ex\.\s/g, 'ex§DOT§ ')
    .replace(/cf\.\s/g, 'cf§DOT§ ')
    .replace(/p\.\s*(\d)/g, 'p§DOT§ $1')
    .replace(/(\d+)\.\s/g, '$1§DOT§ ')
    .replace(/\.\.\./g, '§ELLIPSIS§');

  const rawSentences = protectedText.split(/(?<=[.!?])\s+/);

  const sentences: string[] = [];

  for (const raw of rawSentences) {
    const sentence = raw
      .replace(/§DOT§/g, '.')
      .replace(/§ELLIPSIS§/g, '...')
      .trim();

    if (sentence.length > 15) {
      sentences.push(sentence);
    } else if (sentence.length > 0 && sentences.length > 0) {
      sentences[sentences.length - 1] += ' ' + sentence;
    }
  }

  return sentences;
}

// ============================================================================
// CHUNKING SÉMANTIQUE AMÉLIORÉ
// ============================================================================

function isNumberedItem(text: string): boolean {
  const patterns = [
    /^[•\-\*]\s/,
    /^\d+[\.\)]\s/,
    /^[a-z][\.\)]\s/i,
    /^n°\s*\d+/i,
    /^champ\s*(d'apprentissage\s*)?n°?\s*\d/i,
    /^«\s*[A-Z]/,
  ];
  return patterns.some(p => p.test(text.trim()));
}

function isNumberedSectionStart(text: string): { isStart: boolean; number: number | null } {
  const patterns = [
    /champ\s*(d'apprentissage\s*)?n°?\s*(\d+)/i,
    /^(\d+)\.\s+[A-Z]/,
    /CHAMP\s*(D'APPRENTISSAGE\s*)?N°?\s*(\d+)/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[2] || match[1], 10);
      return { isStart: true, number: isNaN(num) ? null : num };
    }
  }
  return { isStart: false, number: null };
}

function extractTitleKeywords(title: string): string {
  let clean = title
    .replace(/\.(txt|pdf|docx?)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const levelKeywords: string[] = [];
  
  if (/maternelle|cycle[_\s]*1/i.test(clean)) {
    levelKeywords.push('maternelle', 'cycle 1', 'petite section', 'moyenne section', 'grande section');
  }
  if (/élémentaire|cycle[_\s]*2/i.test(clean)) {
    levelKeywords.push('élémentaire', 'cycle 2', 'CP', 'CE1', 'CE2');
  }
  if (/cycle[_\s]*3/i.test(clean)) {
    levelKeywords.push('cycle 3', 'CM1', 'CM2', '6ème');
  }
  if (/cycle[_\s]*4|collège/i.test(clean)) {
    levelKeywords.push('cycle 4', 'collège', '5ème', '4ème', '3ème');
  }
  if (/lycée|seconde|première|terminale/i.test(clean)) {
    levelKeywords.push('lycée');
  }
  
  if (/eps|éducation[_\s]*physique|sportive/i.test(clean)) {
    levelKeywords.push('EPS', 'éducation physique', 'sport', 'activité physique', 'motricité');
  }
  if (/math/i.test(clean)) {
    levelKeywords.push('mathématiques');
  }
  if (/français|langue/i.test(clean)) {
    levelKeywords.push('français', 'langage');
  }
  if (/histoire|géographie/i.test(clean)) {
    levelKeywords.push('histoire', 'géographie');
  }
  if (/sciences/i.test(clean)) {
    levelKeywords.push('sciences');
  }
  if (/arts/i.test(clean)) {
    levelKeywords.push('arts', 'artistique');
  }

  const allKeywords = [clean, ...levelKeywords];
  return [...new Set(allKeywords)].join(' | ');
}

function createSemanticChunks(text: string, documentTitle: string): EnhancedChunkData[] {
  const chunks: EnhancedChunkData[] = [];
  const normalizedText = normalizeText(text);

  console.log(`Semantic chunking of ${normalizedText.length} characters...`);
  console.log(`Document title for context enrichment: "${documentTitle}"`);

  const sections = detectSections(normalizedText);
  console.log(`Detected ${sections.length} sections`);

  let globalChunkIndex = 0;

  for (const section of sections) {
    const sentences = splitIntoSentences(section.content);
    if (sentences.length === 0) continue;

    console.log(`Section "${section.title || 'Sans titre'}": ${sentences.length} sentences`);

    let sentenceIndex = 0;

    while (sentenceIndex < sentences.length) {
      let endIndex = Math.min(sentenceIndex + CHUNK_CONFIG.targetSentences, sentences.length);

      let chunkSentences = sentences.slice(sentenceIndex, endIndex);
      let chunkContent = chunkSentences.join(' ');

      const firstSentence = chunkSentences[0] || '';
      const sectionInfo = isNumberedSectionStart(firstSentence);
      
      if (sectionInfo.isStart && sectionInfo.number !== null) {
        let lookAhead = endIndex;
        while (lookAhead < sentences.length && lookAhead < sentenceIndex + CHUNK_CONFIG.maxSentences) {
          const nextSentence = sentences[lookAhead];
          const nextInfo = isNumberedSectionStart(nextSentence);
          
          if (nextInfo.isStart || isNumberedItem(nextSentence)) {
            lookAhead++;
          } else {
            break;
          }
        }
        
        if (lookAhead > endIndex) {
          endIndex = Math.min(lookAhead, sentenceIndex + CHUNK_CONFIG.maxSentences);
          chunkSentences = sentences.slice(sentenceIndex, endIndex);
          chunkContent = chunkSentences.join(' ');
        }
      }

      if (endIndex < sentences.length) {
        const nextSentence = sentences[endIndex];
        const nextInfo = isNumberedSectionStart(nextSentence);
        
        if (nextInfo.isStart && chunkSentences.length < CHUNK_CONFIG.maxSentences) {
          let lookAhead = endIndex;
          while (lookAhead < sentences.length && lookAhead < sentenceIndex + CHUNK_CONFIG.maxSentences) {
            const sent = sentences[lookAhead];
            if (isNumberedSectionStart(sent).isStart || isNumberedItem(sent)) {
              lookAhead++;
            } else {
              lookAhead++;
              break;
            }
          }
          endIndex = lookAhead;
          chunkSentences = sentences.slice(sentenceIndex, endIndex);
          chunkContent = chunkSentences.join(' ');
        }
      }

      while (
        chunkContent.length < CHUNK_CONFIG.minChunkChars &&
        endIndex < sentences.length &&
        chunkSentences.length < CHUNK_CONFIG.maxSentences
      ) {
        endIndex++;
        chunkSentences = sentences.slice(sentenceIndex, endIndex);
        chunkContent = chunkSentences.join(' ');
      }

      while (
        chunkContent.length > CHUNK_CONFIG.maxChunkChars &&
        chunkSentences.length > CHUNK_CONFIG.minSentences
      ) {
        chunkSentences.pop();
        chunkContent = chunkSentences.join(' ');
        endIndex--;
      }

      const contextParts: string[] = [];
      if (documentTitle) contextParts.push(`Document: ${documentTitle}`);
      if (section.title) contextParts.push(`Section: ${section.title}`);
      contextParts.push(chunkContent);
      const contextualContent = contextParts.join('\n\n');

      const embeddingParts: string[] = [];

      if (documentTitle) {
        const titleKeywords = extractTitleKeywords(documentTitle);
        embeddingParts.push(`[${titleKeywords}]`);
      }

      if (section.title) {
        embeddingParts.push(section.title);
      }

      const champMatches = chunkContent.match(/champ\s*(d'apprentissage\s*)?n°?\s*\d+/gi);
      if (champMatches) {
        const uniqueChamps = [...new Set(champMatches.map(m => m.toLowerCase()))];
        embeddingParts.push(`Champs mentionnés: ${uniqueChamps.join(', ')}`);
      }

      embeddingParts.push(chunkContent);
      const embeddingContent = embeddingParts.join('\n');

      if (chunkContent.length >= CHUNK_CONFIG.minChunkChars) {
        const enrichedContent = documentTitle 
          ? `[Source: ${documentTitle}]\n\n${chunkContent}`
          : chunkContent;

        chunks.push({
          content: enrichedContent,
          contextualContent,
          embeddingContent,
          chunkIndex: globalChunkIndex,
          contentHash: hashString(chunkContent),
          tokenCount: Math.ceil(embeddingContent.length / 4),
          metadata: {
            sectionTitle: section.title,
            documentContext: documentTitle,
            sentenceCount: chunkSentences.length,
            charCount: chunkContent.length,
          },
        });
        globalChunkIndex++;
      }

      const advance = Math.max(chunkSentences.length - CHUNK_CONFIG.overlapSentences, 1);
      sentenceIndex += advance;
    }
  }

  console.log(`Created ${chunks.length} semantic chunks with document context enrichment`);
  return chunks;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(16);
}

// ============================================================================
// EMBEDDINGS
// ============================================================================

async function generateEmbeddings(texts: string[], apiKey: string): Promise<EmbeddingResult> {
  const cleanTexts = texts.map((t) => sanitizeText(t).substring(0, 28000));

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      model: EMBEDDING_CONFIG.model, 
      input: cleanTexts,
      dimensions: 1536,  // 🆕 Réduire à 1536 dimensions pour compatibilité HNSW
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI error:', error);
    throw new Error(`Erreur OpenAI: ${response.status}`);
  }

  const data = await response.json();
  const embeddings = data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: any) => item.embedding);
  const tokensUsed = data.usage?.total_tokens || 0;

  return { embeddings, tokensUsed };
}


async function processEmbeddingsInBatches(
  chunks: EnhancedChunkData[],
  apiKey: string
): Promise<{
  results: { chunk: EnhancedChunkData; embedding: number[] }[];
  totalTokensUsed: number;
}> {
  const results: { chunk: EnhancedChunkData; embedding: number[] }[] = [];
  let totalTokensUsed = 0;

  for (let i = 0; i < chunks.length; i += EMBEDDING_CONFIG.batchSize) {
    const batch = chunks.slice(i, i + EMBEDDING_CONFIG.batchSize);
    const batchNum = Math.floor(i / EMBEDDING_CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(chunks.length / EMBEDDING_CONFIG.batchSize);

    console.log(`Embeddings batch ${batchNum}/${totalBatches} (model: ${EMBEDDING_CONFIG.model})`);

    const inputToIndices = new Map<string, number[]>();
    const uniqueInputs: string[] = [];

    for (let idx = 0; idx < batch.length; idx++) {
      const input = batch[idx].embeddingContent;
      const existing = inputToIndices.get(input);
      if (existing) {
        existing.push(idx);
      } else {
        inputToIndices.set(input, [idx]);
        uniqueInputs.push(input);
      }
    }

    const { embeddings: uniqueEmbeddings, tokensUsed } = await generateEmbeddings(uniqueInputs, apiKey);
    totalTokensUsed += tokensUsed;

    let u = 0;
    for (const input of uniqueInputs) {
      const indices = inputToIndices.get(input) || [];
      const emb = uniqueEmbeddings[u];
      for (const batchIndex of indices) {
        results.push({ chunk: batch[batchIndex], embedding: emb });
      }
      u++;
    }

    if (i + EMBEDDING_CONFIG.batchSize < chunks.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(`Total embedding tokens used: ${totalTokensUsed} (model: ${EMBEDDING_CONFIG.model})`);
  return { results, totalTokensUsed };
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let documentId: string | null = null;
  let supabaseAdmin: SupabaseClient | null = null;

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Non authentifié');
    }

    const adminSecretHeader = req.headers.get('x-admin-secret');

    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) {
      throw new Error('Non authentifié');
    }

    const { documentId: docId, scope: requestedScope } = await req.json();
    documentId = docId;
    
    let scope: DocumentScope = 'user';
    
    if (requestedScope === 'global') {
      const isAdmin = await isAdminUser(supabaseAdmin, user.id, adminSecretHeader);
      if (!isAdmin) {
        throw new Error('Accès refusé: droits administrateur requis pour les documents globaux');
      }
      scope = 'global';
      console.log(`📚 Document GLOBAL upload by admin ${user.id}`);
    } else {
      console.log(`📄 Document USER upload by ${user.id}`);
    }

    if (!documentId) {
      throw new Error('documentId requis');
    }

    const { data: document } = await supabaseAdmin
      .from('rag_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (!document) {
      throw new Error('Document non trouvé');
    }

    if (document.user_id !== user.id && document.scope !== 'global') {
      throw new Error('Document non autorisé');
    }

    await supabaseAdmin
      .from('rag_documents')
      .update({ 
        status: 'processing', 
        error_message: null,
        scope: scope
      })
      .eq('id', documentId);

    console.log(`=== Starting ingestion for ${documentId} (scope: ${scope}) ===`);
    console.log(`Type: ${document.mime_type}, File: ${document.title}`);
    console.log(`Embedding model: ${EMBEDDING_CONFIG.model}`);

    const { data: fileData } = await supabaseAdmin.storage
      .from('rag-documents')
      .download(document.storage_path);

    if (!fileData) {
      throw new Error('Fichier non trouvé dans le storage');
    }

    const extractedText = await extractText(await fileData.arrayBuffer(), document.mime_type);
    console.log(`Extracted ${extractedText.length} characters`);
    console.log(`Preview: ${extractedText.substring(0, 100)}...`);

    if (extractedText.length < 50) {
      throw new Error('Contenu insuffisant extrait du document');
    }

    const chunks = createSemanticChunks(extractedText, document.title);

    if (chunks.length === 0) {
      throw new Error('Aucun chunk créé - document peut-être trop court');
    }

    const estimatedTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    console.log(`Estimated tokens for this document: ${estimatedTokens}`);

    if (scope === 'user') {
      const betaStatus = await checkBetaLimit(supabaseAdmin, user.id, estimatedTokens);
      
      console.log(`Beta check - Storage: ${betaStatus.currentStorageUsage}/${betaStatus.storageLimit}, Monthly: ${betaStatus.monthlyImportUsage}/${betaStatus.monthlyImportLimit}`);
      
      if (!betaStatus.canProceed) {
        throw new Error(betaStatus.errorMessage || 'Limite bêta atteinte');
      }
    }

    await supabaseAdmin.from('rag_chunks').delete().eq('document_id', documentId);

    console.log(`Generating embeddings with ${EMBEDDING_CONFIG.model}...`);
    const { results: chunksWithEmbeddings, totalTokensUsed } = await processEmbeddingsInBatches(
      chunks,
      OPENAI_API_KEY
    );

    if (scope === 'user') {
      await updateBetaTokensUsed(supabaseAdmin, user.id, totalTokensUsed);
    } else {
      console.log(`⚠️ Document global: ${totalTokensUsed} tokens NON comptés dans le quota bêta`);
    }

    console.log('Inserting enriched chunks...');
    for (const { chunk, embedding } of chunksWithEmbeddings) {
      const { error } = await supabaseAdmin.from('rag_chunks').insert({
        document_id: documentId,
        user_id: user.id,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        content_hash: chunk.contentHash,
        embedding: `[${embedding.join(',')}]`,
        token_count: chunk.tokenCount,
        scope: scope,
        metadata: {
          sectionTitle: chunk.metadata.sectionTitle,
          documentContext: chunk.metadata.documentContext,
          sentenceCount: chunk.metadata.sentenceCount,
          charCount: chunk.metadata.charCount,
        },
      });

      if (error) {
        console.error(`Chunk ${chunk.chunkIndex} error:`, error);
        throw new Error(`Erreur insertion: ${error.message}`);
      }
    }

    await supabaseAdmin
      .from('rag_documents')
      .update({
        status: 'ready',
        chunk_count: chunks.length,
        error_message: null,
        scope: scope,
      })
      .eq('id', documentId);

    console.log(`✅ SUCCESS: ${chunks.length} enriched chunks created for ${document.title} (scope: ${scope})`);
    console.log(`✅ Embedding model used: ${EMBEDDING_CONFIG.model}`);
    if (scope === 'user') {
      console.log(`✅ Beta tokens used for this ingestion: ${totalTokensUsed}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        chunksCreated: chunks.length,
        charactersProcessed: extractedText.length,
        betaTokensUsed: scope === 'user' ? totalTokensUsed : 0,
        scope: scope,
        embeddingModel: EMBEDDING_CONFIG.model,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('❌ ERROR:', errorMessage);

    if (documentId && supabaseAdmin) {
      await supabaseAdmin
        .from('rag_documents')
        .update({
          status: 'error',
          error_message: errorMessage.substring(0, 500),
        })
        .eq('id', documentId);
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});