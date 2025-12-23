// supabase/functions/rag-upload-sign/index.ts
// Edge Function pour générer des URLs signées d'upload

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
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  allowedMimeTypes: [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
  storageBucket: 'rag-documents',
  signedUrlExpiresIn: 3600, // 1 heure
};

// ============================================================================
// TYPES
// ============================================================================

interface SignRequest {
  fileName: string;
  mimeType: string;
  fileSize: number;
  scope?: 'global' | 'user';
}

interface SignResponse {
  documentId: string;
  storagePath: string;
  uploadUrl: string;
}

// ============================================================================
// HELPERS
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

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}

function getSourceType(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'text/plain') return 'txt';
  if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return 'docx';
  return 'unknown';
}

async function checkIsAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();

    if (profile?.is_admin === true) {
      return true;
    }

    // Vérifier les ADMIN_USER_IDS dans les variables d'environnement
    const adminUserIds = Deno.env.get('ADMIN_USER_IDS')?.split(',') || [];
    if (adminUserIds.includes(userId)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

async function uploadSignHandler(req: Request): Promise<Response> {
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
    const { fileName, mimeType, fileSize, scope = 'user' }: SignRequest = await req.json();

    // Validations
    if (!fileName || !mimeType) {
      return new Response(JSON.stringify({ error: 'fileName et mimeType requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!CONFIG.allowedMimeTypes.includes(mimeType)) {
      return new Response(JSON.stringify({
        error: `Type de fichier non supporté. Types acceptés: PDF, TXT, DOCX`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (fileSize > CONFIG.maxFileSize) {
      return new Response(JSON.stringify({
        error: `Fichier trop volumineux. Taille max: ${CONFIG.maxFileSize / (1024 * 1024)} MB`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier les permissions pour scope global
    if (scope === 'global') {
      const adminSecret = req.headers.get('x-admin-secret');
      const envAdminSecret = Deno.env.get('ADMIN_SECRET');

      const isValidAdminSecret = adminSecret && envAdminSecret && adminSecret === envAdminSecret;
      const isAdmin = await checkIsAdmin(serviceClient, user.id);

      if (!isValidAdminSecret && !isAdmin) {
        return new Response(JSON.stringify({
          error: 'Permissions insuffisantes pour créer un document global',
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Générer les identifiants
    const documentId = generateUUID();
    const sanitizedName = sanitizeFileName(fileName);
    const timestamp = Date.now();
    const storagePath = scope === 'global'
      ? `global/${documentId}_${timestamp}_${sanitizedName}`
      : `${user.id}/${documentId}_${timestamp}_${sanitizedName}`;

    console.log(`[rag-upload-sign] Creating document: ${fileName} (scope: ${scope})`);

    // Créer l'enregistrement du document
    const { error: insertError } = await serviceClient
      .from('rag_documents')
      .insert({
        id: documentId,
        user_id: user.id,
        title: fileName,
        source_type: getSourceType(mimeType),
        storage_path: storagePath,
        mime_type: mimeType,
        file_size: fileSize,
        status: 'uploaded',
        scope: scope,
        chunk_count: 0,
      });

    if (insertError) {
      console.error('[rag-upload-sign] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Erreur création document' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Générer l'URL signée pour l'upload
    const { data: signedData, error: signError } = await serviceClient.storage
      .from(CONFIG.storageBucket)
      .createSignedUploadUrl(storagePath);

    if (signError || !signedData) {
      console.error('[rag-upload-sign] Sign error:', signError);
      // Supprimer le document créé
      await serviceClient.from('rag_documents').delete().eq('id', documentId);

      return new Response(JSON.stringify({ error: 'Erreur génération URL signée' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[rag-upload-sign] Document ${documentId} created, upload URL generated`);

    const response: SignResponse = {
      documentId,
      storagePath,
      uploadUrl: signedData.signedUrl,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[rag-upload-sign] Error:', error);

    return new Response(JSON.stringify({
      error: error.message || 'Erreur interne',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(uploadSignHandler);
