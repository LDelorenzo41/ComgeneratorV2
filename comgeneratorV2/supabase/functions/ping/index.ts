// supabase/functions/ping/index.ts
// =====================================================
// FONCTION "PING" / KEEP-ALIVE
// -----------------------------------------------------
// But : effectuer une requête minimale et sans effet de
// bord sur la base de données afin de générer une
// activité régulière et empêcher la mise en pause
// automatique du projet Supabase (plan gratuit).
//
// - Aucune écriture : on fait juste un COUNT en mode
//   "head" (ne ramène aucune ligne) sur une table stable.
// - Déclenchée par un cron externe (GitHub Actions).
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Headers CORS communs (alignés sur les autres fonctions du projet)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[ping] Configuration serveur manquante');
      return new Response(
        JSON.stringify({ success: false, error: 'Configuration serveur manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Requête en lecture seule, ultra-légère : un COUNT "head"
    // ne renvoie aucune ligne, juste de quoi solliciter la base.
    const { error, count } = await supabaseClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[ping] Erreur lors du keep-alive :', error.message);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timestamp = new Date().toISOString();
    console.log(`[ping] Keep-alive OK à ${timestamp} (profiles count: ${count ?? 'n/a'})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'pong',
        timestamp,
        profiles_count: count ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[ping] Exception :', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
