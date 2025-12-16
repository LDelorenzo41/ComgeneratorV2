// supabase/functions/rag-upload-sign/index.ts
// Edge Function pour générer un chemin d'upload sécurisé et créer l'entrée document

// Déclarations pour l'environnement Deno
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

interface UploadSignRequest {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface UploadSignResponse {
  documentId: string;
  storagePath: string;
  uploadUrl: string;
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types MIME autorisés pour l'upload
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];

// Taille max: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const uploadSignHandler = async (req: Request): Promise<Response> => {
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

  try {
    // Récupération des variables d'environnement
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
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

    // Client Supabase avec service role pour les opérations admin
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Client Supabase avec le token de l'utilisateur pour vérifier l'auth
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Vérifier l'utilisateur authentifié
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parser le body de la requête
    const body: UploadSignRequest = await req.json();
    const { fileName, mimeType, fileSize } = body;

    // Validation des paramètres
    if (!fileName || !mimeType) {
      return new Response(
        JSON.stringify({ error: 'fileName et mimeType sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validation du type MIME
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return new Response(
        JSON.stringify({
          error: 'Type de fichier non autorisé. Formats acceptés: PDF, DOCX, TXT',
          allowedTypes: ALLOWED_MIME_TYPES
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validation de la taille
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `Fichier trop volumineux. Taille max: ${MAX_FILE_SIZE / 1024 / 1024} MB`,
          maxSize: MAX_FILE_SIZE
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Générer un ID unique pour le document
    const documentId = crypto.randomUUID();

    // Nettoyer le nom de fichier
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    // Construire le chemin de stockage: {user_id}/{document_id}/{filename}
    const storagePath = `${user.id}/${documentId}/${sanitizedFileName}`;

    // Créer l'entrée dans rag_documents
    const { error: insertError } = await supabaseAdmin
      .from('rag_documents')
      .insert({
        id: documentId,
        user_id: user.id,
        title: fileName,
        source_type: 'upload',
        storage_path: storagePath,
        mime_type: mimeType,
        file_size: fileSize || null,
        status: 'uploaded',
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création du document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Générer une URL signée pour l'upload
    const { data: signedData, error: signError } = await supabaseAdmin
      .storage
      .from('rag-documents')
      .createSignedUploadUrl(storagePath);

    if (signError) {
      console.error('Sign error:', signError);
      // Rollback: supprimer le document créé
      await supabaseAdmin.from('rag_documents').delete().eq('id', documentId);

      return new Response(
        JSON.stringify({ error: 'Erreur lors de la génération de l\'URL d\'upload' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log pour audit (sans données sensibles)
    console.log(`Upload signed for user ${user.id}, document ${documentId}, type ${mimeType}`);

    // Retourner les informations d'upload
    const response: UploadSignResponse = {
      documentId,
      storagePath,
      uploadUrl: signedData.signedUrl,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    console.error('Unexpected error in rag-upload-sign:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne du serveur';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

Deno.serve(uploadSignHandler);
