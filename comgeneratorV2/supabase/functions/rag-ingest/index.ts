// supabase/functions/rag-ingest/index.ts
// Edge Function pour l'ingestion de documents avec enrichissement contextuel

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
  embeddingModel: 'text-embedding-3-small',
  embeddingDimension: 1536,
  maxChunkSize: 1500,       // Taille max en caractères
  minChunkSize: 200,        // Taille min en caractères
  chunkOverlap: 150,        // Chevauchement entre chunks
};

// ============================================================================
// TYPES
// ============================================================================

interface IngestRequest {
  documentId: string;
  scope?: 'global' | 'user';
}

interface DocumentRecord {
  id: string;
  user_id: string;
  title: string;
  storage_path: string;
  mime_type: string;
  scope: 'global' | 'user';
}

interface ChunkData {
  content: string;
  embedding: number[];
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

// ============================================================================
// HELPERS - CORS & AUTH
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
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
// EXTRACTION DE MOTS-CLÉS DU TITRE
// ============================================================================

/**
 * Extrait les mots-clés pédagogiques du titre du document
 * Pour enrichir l'embedding et améliorer la recherche
 */
function extractTitleKeywords(title: string): string {
  let clean = title
    .replace(/\.(txt|pdf|docx?)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const levelKeywords: string[] = [];

  // Détection maternelle / cycle 1
  if (/maternelle|cycle[_\s]*1/i.test(clean)) {
    levelKeywords.push('maternelle', 'cycle 1', 'petite section', 'moyenne section', 'grande section', 'PS', 'MS', 'GS');
  }

  // Détection cycle 2 (CP, CE1, CE2)
  if (/cycle[_\s]*2|cp|ce1|ce2|cours\s*préparatoire|cours\s*élémentaire/i.test(clean)) {
    levelKeywords.push('cycle 2', 'CP', 'CE1', 'CE2', 'cours préparatoire', 'cours élémentaire', 'élémentaire');
  }

  // Détection cycle 3 (CM1, CM2, 6e)
  if (/cycle[_\s]*3|cm1|cm2|sixième|6e|6ème/i.test(clean)) {
    levelKeywords.push('cycle 3', 'CM1', 'CM2', 'sixième', '6e', '6ème');
  }

  // Détection cycle 4 (5e, 4e, 3e)
  if (/cycle[_\s]*4|5e|5ème|4e|4ème|3e|3ème|cinquième|quatrième|troisième|collège/i.test(clean)) {
    levelKeywords.push('cycle 4', '5e', '4e', '3e', 'cinquième', 'quatrième', 'troisième', 'collège');
  }

  // Détection lycée
  if (/lycée|seconde|première|terminale|2nde|1ère|1ere|tle/i.test(clean)) {
    levelKeywords.push('lycée', 'seconde', 'première', 'terminale', '2nde', '1ère', 'Tle');
  }

  // Détection EPS
  if (/eps|éducation[_\s]*physique|sport/i.test(clean)) {
    levelKeywords.push('EPS', 'éducation physique et sportive', 'sport', 'activité physique', 'champ d\'apprentissage');
  }

  // Détection français
  if (/français|francais|lecture|écriture|grammaire|orthographe|conjugaison|vocabulaire/i.test(clean)) {
    levelKeywords.push('français', 'lecture', 'écriture', 'grammaire', 'orthographe', 'conjugaison', 'vocabulaire', 'étude de la langue');
  }

  // Détection mathématiques
  if (/math|maths|mathématiques|calcul|géométrie|numération/i.test(clean)) {
    levelKeywords.push('mathématiques', 'maths', 'calcul', 'géométrie', 'numération', 'nombres', 'opérations');
  }

  // Détection sciences
  if (/sciences|physique|chimie|svt|biologie|technologie/i.test(clean)) {
    levelKeywords.push('sciences', 'physique', 'chimie', 'SVT', 'biologie', 'technologie');
  }

  // Détection histoire-géo
  if (/histoire|géographie|géo|emc|enseignement\s*moral/i.test(clean)) {
    levelKeywords.push('histoire', 'géographie', 'EMC', 'enseignement moral et civique');
  }

  // Détection langues
  if (/anglais|english|espagnol|allemand|langue\s*vivante|lv1|lv2/i.test(clean)) {
    levelKeywords.push('anglais', 'espagnol', 'allemand', 'langue vivante', 'LV1', 'LV2');
  }

  // Détection arts
  if (/arts?\s*plastiques?|musique|éducation\s*musicale|art/i.test(clean)) {
    levelKeywords.push('arts plastiques', 'musique', 'éducation musicale', 'éducation artistique');
  }

  // Construire la chaîne finale
  const allKeywords = [clean, ...levelKeywords];
  return [...new Set(allKeywords)].join(' | ');
}

// ============================================================================
// EXTRACTION DE TEXTE
// ============================================================================

async function extractTextFromFile(
  supabase: any,
  storagePath: string,
  mimeType: string
): Promise<string> {
  // Télécharger le fichier depuis le storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('rag-documents')
    .download(storagePath);

  if (downloadError || !fileData) {
    throw new Error(`Impossible de télécharger le fichier: ${downloadError?.message}`);
  }

  // Extraction selon le type de fichier
  if (mimeType === 'text/plain') {
    return await fileData.text();
  }

  if (mimeType === 'application/pdf') {
    return await extractTextFromPDF(fileData);
  }

  if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') {
    return await extractTextFromDocx(fileData);
  }

  throw new Error(`Type de fichier non supporté: ${mimeType}`);
}

async function extractTextFromPDF(blob: Blob): Promise<string> {
  // Utilisation de pdf-parse via esm.sh
  const pdfParse = (await import('https://esm.sh/pdf-parse@1.1.1')).default;
  const buffer = await blob.arrayBuffer();
  const data = await pdfParse(new Uint8Array(buffer));
  return data.text;
}

async function extractTextFromDocx(blob: Blob): Promise<string> {
  // Utilisation de mammoth pour les fichiers Word
  const mammoth = await import('https://esm.sh/mammoth@1.6.0');
  const buffer = await blob.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

// ============================================================================
// CHUNKING SÉMANTIQUE AVEC ENRICHISSEMENT
// ============================================================================

interface SemanticChunk {
  content: string;
  enrichedContent: string;  // Contenu avec contexte du document
  index: number;
}

/**
 * Crée des chunks sémantiques enrichis avec le contexte du document
 */
function createSemanticChunks(
  text: string,
  documentTitle: string,
  maxSize: number = CONFIG.maxChunkSize,
  overlap: number = CONFIG.chunkOverlap
): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];

  // Extraire les mots-clés du titre
  const titleKeywords = extractTitleKeywords(documentTitle);

  // Nettoyer le texte
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Diviser par paragraphes/sections
  const paragraphs = cleanText.split(/\n\n+/);

  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;

    // Si le paragraphe seul dépasse la taille max, le découper
    if (trimmedPara.length > maxSize) {
      // Sauvegarder le chunk en cours s'il existe
      if (currentChunk.length >= CONFIG.minChunkSize) {
        chunks.push({
          content: currentChunk.trim(),
          enrichedContent: `[Source: ${documentTitle}]\n[Mots-clés: ${titleKeywords}]\n\n${currentChunk.trim()}`,
          index: chunkIndex++,
        });
        currentChunk = '';
      }

      // Découper le long paragraphe
      const sentences = trimmedPara.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxSize) {
          if (currentChunk.length >= CONFIG.minChunkSize) {
            chunks.push({
              content: currentChunk.trim(),
              enrichedContent: `[Source: ${documentTitle}]\n[Mots-clés: ${titleKeywords}]\n\n${currentChunk.trim()}`,
              index: chunkIndex++,
            });
          }
          currentChunk = sentence;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
      }
    } else {
      // Ajouter le paragraphe au chunk en cours
      if (currentChunk.length + trimmedPara.length + 2 > maxSize) {
        if (currentChunk.length >= CONFIG.minChunkSize) {
          chunks.push({
            content: currentChunk.trim(),
            enrichedContent: `[Source: ${documentTitle}]\n[Mots-clés: ${titleKeywords}]\n\n${currentChunk.trim()}`,
            index: chunkIndex++,
          });
        }
        currentChunk = trimmedPara;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
      }
    }
  }

  // Ajouter le dernier chunk
  if (currentChunk.length >= CONFIG.minChunkSize) {
    chunks.push({
      content: currentChunk.trim(),
      enrichedContent: `[Source: ${documentTitle}]\n[Mots-clés: ${titleKeywords}]\n\n${currentChunk.trim()}`,
      index: chunkIndex,
    });
  }

  console.log(`[rag-ingest] Créé ${chunks.length} chunks pour "${documentTitle}"`);
  console.log(`[rag-ingest] Mots-clés extraits: ${titleKeywords}`);

  return chunks;
}

// ============================================================================
// EMBEDDINGS
// ============================================================================

async function createEmbeddings(
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
      model: CONFIG.embeddingModel,
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur API OpenAI embeddings: ${error}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}

// ============================================================================
// GESTION DES TOKENS BETA
// ============================================================================

async function updateBetaTokens(
  supabase: any,
  userId: string,
  tokensUsed: number
): Promise<void> {
  try {
    // Incrémenter les tokens utilisés dans le profil
    const { error } = await supabase.rpc('increment_rag_beta_tokens', {
      p_user_id: userId,
      p_tokens: tokensUsed,
    });

    if (error) {
      console.warn(`[rag-ingest] Erreur mise à jour tokens beta: ${error.message}`);
    }
  } catch (err) {
    console.warn(`[rag-ingest] Erreur tokens beta:`, err);
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

async function ingestHandler(req: Request): Promise<Response> {
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
    const { documentId, scope = 'user' }: IngestRequest = await req.json();

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'documentId requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[rag-ingest] Début ingestion document ${documentId} (scope: ${scope})`);

    // Récupérer le document
    const { data: doc, error: docError } = await serviceClient
      .from('rag_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Document non trouvé' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier les permissions (sauf pour scope global avec admin)
    if (scope !== 'global' && doc.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mettre à jour le statut
    await serviceClient
      .from('rag_documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    try {
      // Extraire le texte
      console.log(`[rag-ingest] Extraction du texte...`);
      const text = await extractTextFromFile(serviceClient, doc.storage_path, doc.mime_type);

      if (!text || text.trim().length < 50) {
        throw new Error('Contenu du document insuffisant');
      }

      console.log(`[rag-ingest] Texte extrait: ${text.length} caractères`);

      // Créer les chunks sémantiques enrichis
      console.log(`[rag-ingest] Création des chunks...`);
      const chunks = createSemanticChunks(text, doc.title);

      if (chunks.length === 0) {
        throw new Error('Aucun chunk créé');
      }

      // Supprimer les anciens chunks
      await serviceClient
        .from('rag_chunks')
        .delete()
        .eq('document_id', documentId);

      // Créer les embeddings par batch (utiliser enrichedContent pour l'embedding)
      console.log(`[rag-ingest] Création des embeddings pour ${chunks.length} chunks...`);
      const batchSize = 20;
      let totalTokensUsed = 0;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        // Utiliser enrichedContent pour l'embedding (inclut les mots-clés du titre)
        const textsForEmbedding = batch.map(c => c.enrichedContent);
        const embeddings = await createEmbeddings(textsForEmbedding, OPENAI_API_KEY);

        // Estimer les tokens (environ 4 chars par token)
        totalTokensUsed += textsForEmbedding.join('').length / 4;

        // Insérer les chunks
        const chunksToInsert = batch.map((chunk, j) => ({
          document_id: documentId,
          chunk_index: chunk.index,
          content: chunk.enrichedContent, // Stocker la version enrichie
          embedding: JSON.stringify(embeddings[j]),
          metadata: {
            originalContent: chunk.content, // Garder l'original aussi
            titleKeywords: extractTitleKeywords(doc.title),
          },
        }));

        const { error: insertError } = await serviceClient
          .from('rag_chunks')
          .insert(chunksToInsert);

        if (insertError) {
          console.error(`[rag-ingest] Erreur insertion batch ${i}:`, insertError);
          throw insertError;
        }

        console.log(`[rag-ingest] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} inséré`);
      }

      // Mettre à jour le document
      await serviceClient
        .from('rag_documents')
        .update({
          status: 'ready',
          chunk_count: chunks.length,
          scope: scope,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      // Mettre à jour les tokens beta
      await updateBetaTokens(serviceClient, user.id, Math.ceil(totalTokensUsed));

      console.log(`[rag-ingest] Ingestion terminée: ${chunks.length} chunks, ~${Math.ceil(totalTokensUsed)} tokens`);

      return new Response(JSON.stringify({
        success: true,
        documentId,
        chunksCreated: chunks.length,
        betaTokensUsed: Math.ceil(totalTokensUsed),
        scope,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (processingError: any) {
      // Mettre à jour le document en erreur
      await serviceClient
        .from('rag_documents')
        .update({
          status: 'error',
          error_message: processingError.message,
        })
        .eq('id', documentId);

      throw processingError;
    }

  } catch (error: any) {
    console.error('[rag-ingest] Erreur:', error);

    return new Response(JSON.stringify({
      error: error.message || 'Erreur lors de l\'ingestion',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(ingestHandler);
