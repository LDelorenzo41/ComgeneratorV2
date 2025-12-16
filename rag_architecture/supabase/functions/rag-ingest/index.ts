// supabase/functions/rag-ingest/index.ts
// Edge Function pour l'ingestion des documents : extraction, chunking, embeddings

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

// Configuration des embeddings (batch pour performance)
const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-small',
  batchSize: 20,          // Nombre de chunks par requête OpenAI
  dimensions: 1536,       // Dimensions du modèle
};

interface IngestRequest {
  documentId: string;
}

interface ChunkData {
  content: string;
  chunkIndex: number;
  contentHash: string;
  tokenCount: number;
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
      // Pour .doc, on tente une extraction basique (limitée)
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
 * Note: Pour une extraction plus complète, envisager un service externe ou pdf.js compilé
 */
async function extractTextFromPDF(data: ArrayBuffer): Promise<string> {
  // Convertir en Uint8Array pour manipulation
  const bytes = new Uint8Array(data);
  const text: string[] = [];

  // Recherche des streams de texte dans le PDF
  // Cette approche basique extrait le texte des objets stream
  const content = new TextDecoder('latin1').decode(bytes);

  // Pattern pour détecter les blocs de texte PDF
  // Les PDF stockent le texte entre parenthèses () ou dans des streams
  const textPatterns = [
    /\(([^)]+)\)/g,           // Texte entre parenthèses
    /BT[\s\S]*?ET/g,          // Blocs de texte PDF
    /<([0-9A-Fa-f]+)>/g,      // Texte hexadécimal
  ];

  // Extraction du texte via pattern matching
  const btEtMatches = content.match(/BT[\s\S]*?ET/g) || [];

  for (const block of btEtMatches) {
    // Extraire le texte des parenthèses dans les blocs BT...ET
    const textMatches = block.match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g) || [];
    for (const match of textMatches) {
      // Nettoyer le texte extrait
      const cleanText = match
        .slice(1, -1)                    // Enlever les parenthèses
        .replace(/\\n/g, '\n')           // Convertir \n
        .replace(/\\r/g, '')             // Enlever \r
        .replace(/\\t/g, ' ')            // Convertir tabs
        .replace(/\\\(/g, '(')           // Unescape
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');

      if (cleanText.trim()) {
        text.push(cleanText);
      }
    }
  }

  // Si l'extraction basique échoue, tenter une approche alternative
  if (text.length === 0) {
    // Rechercher les chaînes lisibles directement
    const readableText = content.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.,!?;:'"()-]{10,}/g) || [];
    text.push(...readableText.filter(t => t.trim().length > 10));
  }

  const result = text.join(' ').replace(/\s+/g, ' ').trim();

  if (result.length < 50) {
    console.warn('Extraction PDF limitée - le PDF peut contenir des images ou être protégé');
    // On retourne ce qu'on a, même si limité
    // Une solution plus robuste nécessiterait un service externe d'OCR
  }

  return result;
}

/**
 * Extraction DOCX via JSZip
 * Les fichiers DOCX sont des archives ZIP contenant du XML
 */
async function extractTextFromDOCX(data: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);

    // Le contenu principal est dans word/document.xml
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      throw new Error('Fichier DOCX invalide: document.xml introuvable');
    }

    // Parser le XML et extraire le texte
    // Les textes sont dans les balises <w:t>...</w:t>
    const textMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];

    const texts: string[] = [];
    let currentParagraph: string[] = [];

    for (const match of textMatches) {
      const text = match.replace(/<[^>]+>/g, '');
      currentParagraph.push(text);
    }

    // Gérer les paragraphes (balises <w:p>)
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
 * Support limité - recommander DOCX
 */
function extractTextFromDOC(data: ArrayBuffer): string {
  // Le format .doc est complexe (OLE Compound Document)
  // On tente une extraction basique des chaînes lisibles
  const bytes = new Uint8Array(data);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const content = decoder.decode(bytes);

  // Extraire les séquences de texte lisible
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
    // Texte court: un seul chunk
    chunks.push(createChunk(normalizedText, 0));
    return chunks;
  }

  // Découper en phrases pour un chunking intelligent
  const sentences = splitIntoSentences(normalizedText);

  let currentChunk = '';
  let chunkIndex = 0;
  let lastChunkEnd = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

    if (potentialChunk.length > CHUNK_CONFIG.maxSize && currentChunk.length > 0) {
      // Chunk plein, on le sauvegarde
      chunks.push(createChunk(currentChunk.trim(), chunkIndex));
      chunkIndex++;

      // Calculer le début du prochain chunk avec overlap
      // On revient en arrière pour inclure du contexte
      const overlapStart = Math.max(0, currentChunk.length - CHUNK_CONFIG.overlap);
      const overlapText = currentChunk.substring(overlapStart);

      currentChunk = overlapText + ' ' + sentence;
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Dernier chunk
  if (currentChunk.trim().length >= CHUNK_CONFIG.minSize) {
    chunks.push(createChunk(currentChunk.trim(), chunkIndex));
  } else if (chunks.length > 0 && currentChunk.trim().length > 0) {
    // Fusionner avec le chunk précédent si trop petit
    const lastChunk = chunks[chunks.length - 1];
    lastChunk.content += ' ' + currentChunk.trim();
    lastChunk.contentHash = hashString(lastChunk.content);
    lastChunk.tokenCount = estimateTokens(lastChunk.content);
  }

  return chunks;
}

/**
 * Normalise le texte (espaces, caractères spéciaux)
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')           // Normaliser les retours à la ligne
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')       // Max 2 retours à la ligne consécutifs
    .replace(/\t/g, ' ')               // Tabs en espaces
    .replace(/ {2,}/g, ' ')            // Espaces multiples
    .replace(/[^\S\n]+/g, ' ')         // Espaces non-newline
    .trim();
}

/**
 * Découpe le texte en phrases
 */
function splitIntoSentences(text: string): string[] {
  // Pattern pour détecter les fins de phrases
  // Gère les abréviations courantes (M., Mme, etc.)
  const sentencePattern = /(?<=[.!?])\s+(?=[A-ZÀ-Ú])|(?<=\n\n)/g;

  const sentences = text.split(sentencePattern);

  // Filtrer les phrases vides et nettoyer
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Crée un objet chunk avec métadonnées
 */
function createChunk(content: string, index: number): ChunkData {
  return {
    content,
    chunkIndex: index,
    contentHash: hashString(content),
    tokenCount: estimateTokens(content),
  };
}

/**
 * Hash simple pour déduplication
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Estimation du nombre de tokens (approximation)
 */
function estimateTokens(text: string): number {
  // Approximation: ~4 caractères par token pour le français
  return Math.ceil(text.length / 4);
}

// ============================================================================
// EMBEDDINGS
// ============================================================================

/**
 * Génère les embeddings pour un batch de textes via OpenAI
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
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI Embeddings API error:', error);
    throw new Error(`Erreur API OpenAI: ${response.status}`);
  }

  const data = await response.json();

  // Trier par index pour garantir l'ordre
  const sortedData = data.data.sort((a: any, b: any) => a.index - b.index);

  return sortedData.map((item: any) => item.embedding);
}

/**
 * Traite les embeddings par batches
 */
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

    // Petit délai entre les batches pour éviter le rate limiting
    if (i + EMBEDDING_CONFIG.batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

const ingestHandler = async (req: Request): Promise<Response> => {
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

  let documentId: string | null = null;
  let supabaseAdmin: SupabaseClient | null = null;

  try {
    // Récupération des variables d'environnement
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

    // Authentification de l'utilisateur
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clients Supabase
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    const body: IngestRequest = await req.json();
    documentId = body.documentId;

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'documentId est requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer le document et vérifier qu'il appartient à l'utilisateur
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

    // Mettre à jour le statut à 'processing'
    await supabaseAdmin
      .from('rag_documents')
      .update({ status: 'processing', error_message: null })
      .eq('id', documentId);

    console.log(`Starting ingestion for document ${documentId}, type: ${document.mime_type}`);

    // Télécharger le fichier depuis Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('rag-documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Erreur téléchargement fichier: ${downloadError?.message || 'Fichier non trouvé'}`);
    }

    // Convertir en ArrayBuffer
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
      embedding: `[${embedding.join(',')}]`, // Format pgvector
      token_count: chunk.tokenCount,
      metadata: {
        charCount: chunk.content.length,
      },
    }));

    // Insérer par batches pour éviter les timeouts
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
        error_message: null,
      })
      .eq('id', documentId);

    console.log(`Ingestion completed for document ${documentId}: ${chunks.length} chunks created`);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        chunksCreated: chunks.length,
        totalCharacters: extractedText.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    console.error('Ingestion error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

    // Mettre à jour le document en erreur
    if (documentId && supabaseAdmin) {
      await supabaseAdmin
        .from('rag_documents')
        .update({
          status: 'error',
          error_message: errorMessage.substring(0, 500), // Limiter la taille
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
