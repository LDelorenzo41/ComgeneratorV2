// supabase/functions/newsletter-audience/index.ts
// Edge Function pour compter les destinataires potentiels d'une newsletter

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AudienceRequest {
  audienceType: 'ALL' | 'LOW_TOKENS' | 'HIGH_TOKENS';
  tokenThreshold?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    const adminEmails = Deno.env.get('ADMIN_EMAILS')?.split(',').map(e => e.trim()) || [];
    const isAdmin = profile?.is_admin === true || (user.email && adminEmails.includes(user.email));

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Accès réservé aux administrateurs' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parser la requête
    const body: AudienceRequest = await req.json();
    const { audienceType, tokenThreshold } = body;

    // Construire la requête de comptage
    let query = supabase
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('newsletter_subscription', true);

    if (audienceType === 'LOW_TOKENS' && tokenThreshold !== undefined) {
      query = query.lt('tokens', tokenThreshold);
    } else if (audienceType === 'HIGH_TOKENS' && tokenThreshold !== undefined) {
      query = query.gt('tokens', tokenThreshold);
    }

    const { count, error: countError } = await query;

    if (countError) {
      throw new Error('Erreur lors du comptage');
    }

    return new Response(JSON.stringify({
      count: count || 0,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Audience count error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
