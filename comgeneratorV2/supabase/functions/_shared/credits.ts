// supabase/functions/_shared/credits.ts
// Solde et débit des crédits côté serveur, via la clé service.
//
// Principe de dégradation douce : chaque helper retourne `null` en cas
// d'indisponibilité (migration non appliquée, réseau…). L'appelant décide —
// et le front conserve son débit client historique tant que la réponse ne
// contient pas `remainingTokens`, donc un échec ici ne bloque jamais une
// génération et ne rend jamais une génération gratuite.

function serviceConfig(): { url: string; key: string } | null {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return { url, key };
}

function serviceHeaders(key: string): Record<string, string> {
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

/** Solde actuel de l'utilisateur, ou null si indisponible. */
export async function getBalance(userId: string): Promise<number | null> {
  const cfg = serviceConfig();
  if (!cfg) return null;

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/profiles?user_id=eq.${userId}&select=tokens`,
      { headers: serviceHeaders(cfg.key) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return typeof rows[0].tokens === 'number' ? rows[0].tokens : 0;
  } catch (error) {
    console.error('[credits] getBalance failed:', error);
    return null;
  }
}

/**
 * Débite `amount` crédits (atomique, plafonné à 0, tracé dans credit_ledger)
 * via la RPC consume_credits. Retourne le nouveau solde, ou null si le débit
 * n'a pas pu être effectué.
 */
export async function consumeCredits(
  userId: string,
  amount: number,
  kind: string,
  model?: string
): Promise<number | null> {
  const cfg = serviceConfig();
  if (!cfg) return null;

  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/consume_credits`, {
      method: 'POST',
      headers: serviceHeaders(cfg.key),
      body: JSON.stringify({
        p_user_id: userId,
        p_amount: Math.max(0, Math.round(amount)),
        p_kind: kind,
        p_model: model ?? null,
      }),
    });
    if (!res.ok) {
      console.error('[credits] consumeCredits failed:', res.status, await res.text());
      return null;
    }
    const balance = await res.json();
    return typeof balance === 'number' ? balance : null;
  } catch (error) {
    console.error('[credits] consumeCredits failed:', error);
    return null;
  }
}

/**
 * Nombre de débits de l'utilisateur sur les `seconds` dernières secondes
 * (toutes fonctions confondues), ou null si indisponible.
 */
export async function countRecentDebits(userId: string, seconds: number): Promise<number | null> {
  const cfg = serviceConfig();
  if (!cfg) return null;

  try {
    const since = new Date(Date.now() - seconds * 1000).toISOString();
    const res = await fetch(
      `${cfg.url}/rest/v1/credit_ledger?user_id=eq.${userId}&created_at=gte.${since}&select=id&limit=1`,
      { headers: { ...serviceHeaders(cfg.key), 'Prefer': 'count=exact' } }
    );
    if (!res.ok) return null;
    const contentRange = res.headers.get('content-range');
    const total = contentRange?.split('/')[1];
    if (!total || total === '*') return null;
    return parseInt(total, 10);
  } catch (error) {
    console.error('[credits] countRecentDebits failed:', error);
    return null;
  }
}
