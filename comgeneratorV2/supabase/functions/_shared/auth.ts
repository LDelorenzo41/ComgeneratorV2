// supabase/functions/_shared/auth.ts
// Vérification du JWT utilisateur — même logique que les handlers historiques
// (appel à /auth/v1/user avec la clé service), factorisée.

import { jsonResponse } from './http.ts';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export type AuthResult =
  | { user: AuthenticatedUser; errorResponse: null }
  | { user: null; errorResponse: Response };

/**
 * Vérifie l'en-tête Authorization et résout l'utilisateur.
 * Retourne soit l'utilisateur, soit une Response d'erreur prête à renvoyer.
 */
export async function requireUser(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, errorResponse: jsonResponse(corsHeaders, 401, { error: 'Non autorisé' }) };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      user: null,
      errorResponse: jsonResponse(corsHeaders, 500, { error: 'Configuration serveur manquante' }),
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseServiceKey,
    },
  });

  if (!userResponse.ok) {
    return {
      user: null,
      errorResponse: jsonResponse(corsHeaders, 401, { error: 'Token invalide ou expiré' }),
    };
  }

  const authUser = await userResponse.json();
  return { user: { id: authUser.id, email: authUser.email }, errorResponse: null };
}
