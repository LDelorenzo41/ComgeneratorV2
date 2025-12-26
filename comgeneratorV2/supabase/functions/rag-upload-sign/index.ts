// supabase/functions/rag-upload-sign/index.ts
// Avec support des documents globaux (admin)

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
};

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type DocumentScope = 'global' | 'user';

// Vérification admin (même logique que rag-ingest)
async function isAdminUser(
  supabase: SupabaseClient,
  userId: string,
  adminSecretHeader: string | null
): Promise<boolean> {
  // Méthode 1: Secret admin
  const adminSecret = Deno.env.get('ADMIN_SECRET');
  if (adminSecret && adminSecretHeader === adminSecret) {
    return true;
  }

  // Méthode 2: Liste des admin user IDs
  const adminUserIds = Deno.env.get('ADMIN_USER_IDS');
  if (adminUserIds) {
    const adminList = adminUserIds.split(',').map(id => id.trim());
    if (adminList.includes(userId)) {
      return true;
    }
  }

  // Méthode 3: Colonne is_admin dans profiles
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();
    
    if (profile?.is_admin === true) {
      return true;
    }
  } catch {
    // Colonne n'existe peut-être pas
  }

  return false;
}

Deno.serve(async (req: Request): Promise<Response> => {
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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

    const adminSecretHeader = req.headers.get('x-admin-secret');

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileName, mimeType, fileSize, scope: requestedScope } = await req.json();

    if (!fileName || !mimeType) {
      return new Response(
        JSON.stringify({ error: 'fileName et mimeType sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return new Response(
        JSON.stringify({ error: 'Type de fichier non autorisé. Formats acceptés: PDF, DOCX, TXT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Fichier trop volumineux. Taille max: 10 MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Déterminer le scope
    let scope: DocumentScope = 'user';
    
    if (requestedScope === 'global') {
      const isAdmin = await isAdminUser(supabaseAdmin, user.id, adminSecretHeader);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Accès refusé: droits administrateur requis pour les documents globaux' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      scope = 'global';
      console.log(`📚 Global document upload by admin ${user.id}`);
    } else {
      console.log(`📄 User document upload by ${user.id}`);
    }

    const documentId = crypto.randomUUID();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
    
    // Chemin différent selon le scope
    const storagePath = scope === 'global'
      ? `global/${documentId}/${sanitizedFileName}`
      : `${user.id}/${documentId}/${sanitizedFileName}`;

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
        scope: scope,  // AJOUT du scope
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création du document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: signedData, error: signError } = await supabaseAdmin
      .storage
      .from('rag-documents')
      .createSignedUploadUrl(storagePath);

    if (signError) {
      await supabaseAdmin.from('rag_documents').delete().eq('id', documentId);
      console.error('Sign error:', signError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la génération de l\'URL d\'upload' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        documentId,
        storagePath,
        uploadUrl: signedData.signedUrl,
        scope,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Upload sign error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});