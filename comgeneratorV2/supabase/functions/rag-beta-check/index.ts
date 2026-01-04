// supabase/functions/rag-beta-check/index.ts
// Vérifie et réinitialise le quota mensuel d'import si nécessaire

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Récupérer le profil avec la date de reset
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('rag_beta_tokens_used, rag_beta_reset_date')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération du profil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const resetDate = profile?.rag_beta_reset_date ? new Date(profile.rag_beta_reset_date) : null;
    
    let wasReset = false;
    let newResetDate: string | null = null;

    // Vérifier si le reset est nécessaire
    // Reset si: pas de date de reset OU si la date de reset est dans le passé
    if (!resetDate || resetDate <= now) {
      // Calculer la prochaine date de reset (1er du mois prochain)
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      newResetDate = nextMonth.toISOString().split('T')[0]; // Format YYYY-MM-DD

      // Mettre à jour le profil: reset du compteur + nouvelle date
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          rag_beta_tokens_used: 0,
          rag_beta_reset_date: newResetDate,
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error resetting beta quota:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la réinitialisation du quota' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      wasReset = true;
      console.log(`🔄 Beta quota reset for user ${user.id}. New reset date: ${newResetDate}`);
    }

    return new Response(
      JSON.stringify({
        wasReset,
        newResetDate: wasReset ? newResetDate : (resetDate?.toISOString().split('T')[0] || null),
        previousTokensUsed: wasReset ? (profile?.rag_beta_tokens_used || 0) : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Beta check error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
