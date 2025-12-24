// supabase/functions/rag-ingest/index.ts
// Edge Function pour l'ingestion des documents : extraction, chunking, embeddings
// Avec système de quota dual (stockage + import mensuel)

// Déclarations pour l'environnement Deno
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
// @ts-ignore - Import dynamique JSZip pour DOCX
import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration du chunking
const CHUNK_CONFIG = {
  targetSize: 1000,       // Taille cible en caractères (~250 tokens)
  maxSize: 1500,          // Taille max absolue
  minSize: 200,           // Taille min (éviter chunks trop petits)
  overlap: 150,           // Chevauchement entre chunks
};

// Configuration des embeddings - text-embedding-3-large avec dimensions réduites
const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-large',
  batchSize: 10,          // Réduit pour éviter les timeouts
  dimensions: 1536,       // Réduit de 3072 à 1536 pour compatibilité HNSW
};

// Configuration des quotas bêta
const BETA_CONFIG = {
  storageLimit: 100000,       // 100k tokens max stockage permanent
  monthlyImportLimit: 100000, // 100k tokens/mois pour imports
};

interface IngestRequest {
  documentId: string;
  scope?: 'user' | 'global';  // Permet aux admins de créer des docs globaux
}

interface ChunkData {
  content: string;
  chunkIndex: number;
  contentHash: string;
  tokenCount: number;
}

// ============================================================================
// VÉRIFICATION DES QUOTAS BÊTA
// ============================================================================

interface QuotaCheck {
  canProceed: boolean;
  storageUsed: number;
  storageLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  error?: string;
}

/**
 * Vérifie si l'utilisateur a le droit d'importer selon les quotas
 */
async function checkBetaQuotas(
  supabase: SupabaseClient,
  userId: string,
  estimatedTokens: number
): Promise<QuotaCheck> {
  // Récupérer le profil avec les infos de quota
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('rag_beta_tokens_used, rag_beta_storage_tokens, rag_beta_monthly_reset')
    .eq('user_id', userId)
    .single();

  if (profileError) {
    console.error('Error fetching profile for quota check:', profileError);
    return {
      canProceed: false,
      storageUsed: 0,
      storageLimit: BETA_CONFIG.storageLimit,
      monthlyUsed: 0,
      monthlyLimit: BETA_CONFIG.monthlyImportLimit,
      error: 'Impossible de vérifier le quota'
    };
  }

  // Valeurs par défaut si les champs n'existent pas encore
  const storageUsed = profile?.rag_beta_storage_tokens || 0;
  const monthlyUsed = profile?.rag_beta_tokens_used || 0;
  const lastReset = profile?.rag_beta_monthly_reset;

  // Vérifier si le quota mensuel doit être réinitialisé
  let actualMonthlyUsed = monthlyUsed;
  const now = new Date();
  if (lastReset) {
    const resetDate = new Date(lastReset);
    // Si on est dans un nouveau mois, le quota mensuel est à 0
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      actualMonthlyUsed = 0;
    }
  }

  // Vérification quota stockage
  if (storageUsed + estimatedTokens > BETA_CONFIG.storageLimit) {
    return {
      canProceed: false,
      storageUsed,
      storageLimit: BETA_CONFIG.storageLimit,
      monthlyUsed: actualMonthlyUsed,
      monthlyLimit: BETA_CONFIG.monthlyImportLimit,
      error: `Quota de stockage dépassé. Utilisé: ${storageUsed}/${BETA_CONFIG.storageLimit} tokens. Supprimez des documents pour libérer de l'espace.`
    };
  }

  // Vérification quota mensuel d'import
  if (actualMonthlyUsed + estimatedTokens > BETA_CONFIG.monthlyImportLimit) {
    return {
      canProceed: false,
      storageUsed,
      storageLimit: BETA_CONFIG.storageLimit,
      monthlyUsed: actualMonthlyUsed,
      monthlyLimit: BETA_CONFIG.monthlyImportLimit,
      error: `Quota mensuel d'import dépassé. Utilisé: ${actualMonthlyUsed}/${BETA_CONFIG.monthlyImportLimit} tokens. Votre quota sera réinitialisé le mois prochain.`
    };
  }

  return {
    canProceed: true,
    storageUsed,
    storageLimit: BETA_CONFIG.storageLimit,
    monthlyUsed: actualMonthlyUsed,
    monthlyLimit: BETA_CONFIG.monthlyImportLimit
  };
}

/**
 * Met à jour les quotas après une ingestion réussie
 */
async function updateBetaQuotas(
  supabase: SupabaseClient,
  userId: string,
  tokensUsed: number,
  currentQuota: QuotaCheck
): Promise<void> {
  const now = new Date();

  const { error } = await supabase
    .from('profiles')
    .update({
      rag_beta_storage_tokens: currentQuota.storageUsed + tokensUsed,
      rag_beta_tokens_used: currentQuota.monthlyUsed + tokensUsed,
      rag_beta_monthly_reset: now.toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating beta quotas:', error);
    // Non bloquant - on log mais on continue
  }
}

/**
 * Vérifie si l'utilisateur est admin
 */
async function isUserAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.is_admin === true;
}

// ============================================================================
// EXTRACTION DE TEXTE
// ============================================================================

/**
 * Extrait le texte d'un fichier selon son type MIME
 */
async function extractText(fileData: ArrayBuffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'text/plain':
      return extractTextFromPlain(fileData);
    case 'application/pdf':
      return extractTextFromPDF(fileData);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractTextFromDOCX(fileData);
    case 'application/msword':
      return extractTextFromDOC(fileData);
    default:
      throw new Error(`Type MIME non supporté: ${mimeType}`);
  }
}

/**
 * Extraction texte brut
 */
function extractTextFromPlain(data: ArrayBuffer): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(data);
}

/**
 * Extraction PDF - Approche robuste pour Deno
 */
async function extractTextFromPDF(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data);
  const text: string[] = [];
  const content = new TextDecoder('latin1').decode(bytes);

  const btEtMatches = content.match(/BT[\s\S]*?ET/g) || [];

  for (const block of btEtMatches) {
    const textMatches = block.match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g) || [];
    for (const match of textMatches) {
      const cleanText = match
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');

      if (cleanText.trim()) {
        text.push(cleanText);
      }
    }
  }

  if (text.length === 0) {
    const readableText = content.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.,!?;:'"()-]{10,}/g) || [];
    text.push(...readableText.filter(t => t.trim().length > 10));
  }

  const result = text.join(' ').replace(/\s+/g, ' ').trim();

  if (result.length < 50) {
    console.warn('Extraction PDF limitée - le PDF peut contenir des images ou être protégé');
  }

  return result;
}

/**
 * Extraction DOCX via JSZip
 */
async function extractTextFromDOCX(data: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      throw new Error('Fichier DOCX invalide: document.xml introuvable');
    }

    const paragraphs = documentXml.split(/<w:p[^>]*>/);
    const result: string[] = [];

    for (const para of paragraphs) {
      const paraTexts = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const paraContent = paraTexts
        .map(m => m.replace(/<[^>]+>/g, ''))
        .join('');

      if (paraContent.trim()) {
        result.push(paraContent);
      }
    }

    return result.join('\n').trim();
  } catch (error) {
    console.error('Erreur extraction DOCX:', error);
    throw new Error('Impossible d\'extraire le texte du fichier DOCX');
  }
}

/**
 * Extraction DOC (format binaire legacy)
 */
function extractTextFromDOC(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const content = decoder.decode(bytes);

  const readableText = content.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.,!?;:'"()-]{5,}/g) || [];

  const result = readableText
    .filter(t => t.trim().length > 5)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (result.length < 50) {
    console.warn('Format .doc partiellement supporté. Conversion en .docx recommandée.');
  }

  return result;
}

// ============================================================================
// CHUNKING
// ============================================================================

/**
 * Divise le texte en chunks avec chevauchement
 */
function chunkText(text: string): ChunkData[] {
  const chunks: ChunkData[] = [];
  const normalizedText = normalizeText(text);

  if (normalizedText.length <= CHUNK_CONFIG.targetSize) {
    chunks.push(createChunk(normalizedText, 0));
    return chunks;
  }

  const sentences = splitIntoSentences(normalizedText);

  let currentChunk = '';
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

    if (potentialChunk.length > CHUNK_CONFIG.maxSize && currentChunk.length > 0) {
      chunks.push(createChunk(currentChunk.trim(), chunkIndex));
      chunkIndex++;

      const overlapStart = Math.max(0, currentChunk.length - CHUNK_CONFIG.overlap);
      const overlapText = currentChunk.substring(overlapStart);

      currentChunk = overlapText + ' ' + sentence;
    } else {
      currentChunk = potentialChunk;
    }
  }

  if (currentChunk.trim().length >= CHUNK_CONFIG.minSize) {
    chunks.push(createChunk(currentChunk.trim(), chunkIndex));
  } else if (chunks.length > 0 && currentChunk.trim().length > 0) {
    const lastChunk = chunks[chunks.length - 1];
    lastChunk.content += ' ' + currentChunk.trim();
    lastChunk.contentHash = hashString(lastChunk.content);
    lastChunk.tokenCount = estimateTokens(lastChunk.content);
  }

  return chunks;
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

function splitIntoSentences(text: string): string[] {
  const sentencePattern = /(?<=[.!?])\s+(?=[A-ZÀ-Ú])|(?<=\n\n)/g;
  const sentences = text.split(sentencePattern);
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function createChunk(content: string, index: number): ChunkData {
  return {
    content,
    chunkIndex: index,
    contentHash: hashString(content),
    tokenCount: estimateTokens(content),
  };
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================================
// EMBEDDINGS
// ============================================================================

/**
 * Génère les embeddings pour un batch de textes via OpenAI
 * Utilise text-embedding-3-large avec dimensions réduites
 */
async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_CONFIG.model,
      input: texts,
      dimensions: EMBEDDING_CONFIG.dimensions,  // Réduction des dimensions
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI Embeddings API error:', error);
    throw new Error(`Erreur API OpenAI: ${response.status}`);
  }

  const data = await response.json();
  const sortedData = data.data.sort((a: any, b: any) => a.index - b.index);

  return sortedData.map((item: any) => item.embedding);
}

async function processEmbeddingsInBatches(
  chunks: ChunkData[],
  apiKey: string
): Promise<{ chunk: ChunkData; embedding: number[] }[]> {
  const results: { chunk: ChunkData; embedding: number[] }[] = [];

  for (let i = 0; i < chunks.length; i += EMBEDDING_CONFIG.batchSize) {
    const batch = chunks.slice(i, i + EMBEDDING_CONFIG.batchSize);
    const texts = batch.map(c => c.content);

    console.log(`Processing embeddings batch ${Math.floor(i / EMBEDDING_CONFIG.batchSize) + 1}/${Math.ceil(chunks.length / EMBEDDING_CONFIG.batchSize)}`);

    const embeddings = await generateEmbeddings(texts, apiKey);

    for (let j = 0; j < batch.length; j++) {
      results.push({
        chunk: batch[j],
        embedding: embeddings[j],
      });
    }

    if (i + EMBEDDING_CONFIG.batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return results;
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

const ingestHandler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let documentId: string | null = null;
  let supabaseAdmin: SupabaseClient | null = null;

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      console.error('Missing environment variables');
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

    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    const body: IngestRequest = await req.json();
    documentId = body.documentId;
    const requestedScope = body.scope || 'user';

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'documentId est requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier les droits admin pour les documents globaux
    const isAdmin = await isUserAdmin(supabaseAdmin, user.id);
    const scope = (requestedScope === 'global' && isAdmin) ? 'global' : 'user';

    // Récupérer le document
    const { data: document, error: docError } = await supabaseAdmin
      .from('rag_documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return new Response(
        JSON.stringify({ error: 'Document non trouvé ou accès refusé' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Estimation préalable des tokens (basée sur la taille du fichier)
    const estimatedTokens = Math.ceil(document.size / 4);

    // Vérification des quotas bêta (sauf pour les admins sur docs globaux)
    let quotaCheck: QuotaCheck | null = null;
    if (scope !== 'global') {
      quotaCheck = await checkBetaQuotas(supabaseAdmin, user.id, estimatedTokens);

      if (!quotaCheck.canProceed) {
        return new Response(
          JSON.stringify({
            error: quotaCheck.error,
            quotaExceeded: true,
            storageUsed: quotaCheck.storageUsed,
            storageLimit: quotaCheck.storageLimit,
            monthlyUsed: quotaCheck.monthlyUsed,
            monthlyLimit: quotaCheck.monthlyLimit
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Mettre à jour le statut à 'processing'
    await supabaseAdmin
      .from('rag_documents')
      .update({ status: 'processing', error_message: null, scope })
      .eq('id', documentId);

    console.log(`Starting ingestion for document ${documentId}, type: ${document.mime_type}, scope: ${scope}`);

    // Télécharger le fichier depuis Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('rag-documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Erreur téléchargement fichier: ${downloadError?.message || 'Fichier non trouvé'}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();

    // Extraire le texte
    console.log('Extracting text...');
    const extractedText = await extractText(arrayBuffer, document.mime_type);

    if (!extractedText || extractedText.length < 10) {
      throw new Error('Extraction de texte échouée ou contenu insuffisant');
    }

    console.log(`Extracted ${extractedText.length} characters`);

    // Chunking
    console.log('Chunking text...');
    const chunks = chunkText(extractedText);
    console.log(`Created ${chunks.length} chunks`);

    // Calculer les tokens réels
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

    // Revérification des quotas avec les tokens réels (sauf admin/global)
    if (scope !== 'global' && quotaCheck) {
      if (quotaCheck.storageUsed + totalTokens > BETA_CONFIG.storageLimit) {
        throw new Error(`Le document utiliserait ${totalTokens} tokens, dépassant le quota de stockage disponible (${BETA_CONFIG.storageLimit - quotaCheck.storageUsed} tokens restants).`);
      }
      if (quotaCheck.monthlyUsed + totalTokens > BETA_CONFIG.monthlyImportLimit) {
        throw new Error(`Le document utiliserait ${totalTokens} tokens, dépassant le quota mensuel d'import disponible (${BETA_CONFIG.monthlyImportLimit - quotaCheck.monthlyUsed} tokens restants).`);
      }
    }

    // Supprimer les chunks existants (idempotence)
    await supabaseAdmin.rpc('delete_document_chunks', { p_document_id: documentId });

    // Générer les embeddings
    console.log('Generating embeddings...');
    const chunksWithEmbeddings = await processEmbeddingsInBatches(chunks, OPENAI_API_KEY);

    // Insérer les chunks dans la base
    console.log('Inserting chunks...');
    const chunkInserts = chunksWithEmbeddings.map(({ chunk, embedding }) => ({
      document_id: documentId,
      user_id: user.id,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      content_hash: chunk.contentHash,
      embedding: `[${embedding.join(',')}]`,
      token_count: chunk.tokenCount,
      metadata: {
        charCount: chunk.content.length,
      },
    }));

    const insertBatchSize = 50;
    for (let i = 0; i < chunkInserts.length; i += insertBatchSize) {
      const batch = chunkInserts.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabaseAdmin
        .from('rag_chunks')
        .insert(batch);

      if (insertError) {
        console.error('Chunk insert error:', insertError);
        throw new Error(`Erreur insertion chunks: ${insertError.message}`);
      }
    }

    // Mettre à jour le document comme 'ready'
    await supabaseAdmin
      .from('rag_documents')
      .update({
        status: 'ready',
        chunk_count: chunks.length,
        token_count: totalTokens,
        error_message: null,
      })
      .eq('id', documentId);

    // Mettre à jour les quotas bêta (sauf pour les docs globaux)
    if (scope !== 'global' && quotaCheck) {
      await updateBetaQuotas(supabaseAdmin, user.id, totalTokens, quotaCheck);
    }

    console.log(`Ingestion completed for document ${documentId}: ${chunks.length} chunks, ${totalTokens} tokens`);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        chunksCreated: chunks.length,
        totalTokens,
        totalCharacters: extractedText.length,
        scope,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    console.error('Ingestion error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

    if (documentId && supabaseAdmin) {
      await supabaseAdmin
        .from('rag_documents')
        .update({
          status: 'error',
          error_message: errorMessage.substring(0, 500),
        })
        .eq('id', documentId);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

Deno.serve(ingestHandler);
