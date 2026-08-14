// supabase/functions/_shared/http.ts
// Helpers HTTP communs aux Edge Functions : CORS et réponses JSON.

/**
 * Construit les en-têtes CORS.
 *
 * Comportement par défaut (variable ALLOWED_ORIGINS absente) : identique à
 * l'historique, c'est-à-dire Access-Control-Allow-Origin: '*'.
 *
 * Pour restreindre, définir le secret ALLOWED_ORIGINS sur le projet Supabase,
 * liste d'origines séparées par des virgules, ex. :
 *   ALLOWED_ORIGINS="https://www.profassist.fr,http://localhost:5173"
 */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (configured.length === 0) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
  }

  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': configured.includes(origin) ? origin : configured[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

/** Réponse JSON avec les en-têtes CORS fournis. */
export function jsonResponse(
  corsHeaders: Record<string, string>,
  status: number,
  body: Record<string, unknown>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
