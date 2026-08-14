// supabase/functions/communication-revise/index.ts
// Retouches en un clic d'un message généré (page Communication) :
// « Plus court », « Plus chaleureux », « Plus ferme ».
//
// Le type de retouche est un CHOIX FERMÉ (whitelist serveur) : le client
// envoie une clé, jamais d'instruction libre — pas de surface d'injection.
// Mêmes protections que les autres fonctions (JWT, solde, plafond/minute),
// débit du coût réel via consume_credits (kind 'revision').

import { buildCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import { resolveAIConfig, callAI, computeTokenCost, AIApiError } from '../_shared/ai.ts';
import { getBalance, consumeCredits, countRecentDebits } from '../_shared/credits.ts';

const RATE_LIMIT_PER_MINUTE = 10;
const MAX_TEXT_LENGTH = 10000;

// Retouches disponibles — clés attendues du front, instructions associées
const REVISIONS: Record<string, string> = {
  shorter: "plus court : réduis la longueur d'un tiers à une moitié en conservant toutes les informations essentielles et la structure",
  warmer: "plus chaleureux : adoucis les formulations, ajoute de la proximité et de l'empathie, sans perdre le professionnalisme ni modifier les faits",
  firmer: "plus ferme : renforce le cadre et la clarté des attentes, formulations précises et sans ambiguïté, tout en restant respectueux et professionnel"
};

/** Nettoyage plain-text, identique au traitement des messages */
function cleanOutputText(text) {
  if (!text) return text;

  let cleaned = text.trim();

  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/`{1,3}/g, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/^[\s:\-\*]+/, '');

  return cleaned;
}

interface ReviseParams {
  texte: string;
  kind: string;
  aiModel?: string;
}

const reviseHandler = async (req: Request): Promise<Response> => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(corsHeaders, 405, { error: 'Méthode non autorisée' });
  }

  // ✅ SÉCURITÉ : Vérification de l'authentification JWT
  const { user, errorResponse } = await requireUser(req, corsHeaders);
  if (!user) {
    return errorResponse;
  }
  console.log(`[communication-revise] Utilisateur authentifié: ${user.id}`);

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');

    if (!OPENAI_API_KEY) {
      return jsonResponse(corsHeaders, 500, { error: 'Configuration serveur incomplète' });
    }

    const body: ReviseParams = await req.json();
    const { texte, kind, aiModel } = body;

    if (!texte || typeof texte !== 'string' || !texte.trim()) {
      return jsonResponse(corsHeaders, 400, { error: 'Le message à retoucher est vide.' });
    }

    if (texte.length > MAX_TEXT_LENGTH) {
      return jsonResponse(corsHeaders, 400, {
        error: `Le message est trop long (maximum ${MAX_TEXT_LENGTH.toLocaleString('fr-FR')} caractères).`
      });
    }

    const instruction = REVISIONS[kind];
    if (!instruction) {
      return jsonResponse(corsHeaders, 400, { error: 'Type de retouche non reconnu.' });
    }

    // Vérification du solde avant retouche
    const balance = await getBalance(user.id);
    if (balance !== null && balance <= 0) {
      return jsonResponse(corsHeaders, 402, {
        error: 'Crédits insuffisants. Rechargez votre compte pour continuer.'
      });
    }

    // Plafond de requêtes par minute
    const recentDebits = await countRecentDebits(user.id, 60);
    if (recentDebits !== null && recentDebits >= RATE_LIMIT_PER_MINUTE) {
      return jsonResponse(corsHeaders, 429, {
        error: 'Trop de requêtes. Veuillez patienter une minute avant de réessayer.'
      });
    }

    let aiConfig;
    try {
      aiConfig = resolveAIConfig(aiModel, OPENAI_API_KEY, MISTRAL_API_KEY);
    } catch (configError) {
      return jsonResponse(corsHeaders, 500, { error: configError.message });
    }

    console.log(`[communication-revise] ${kind} avec ${aiConfig.model}`);

    const prompt = `Tu es un enseignant expérimenté. Voici un message professionnel déjà rédigé :

"""
${texte}
"""

Réécris ce message en le rendant ${instruction}.

**RÈGLES IMPÉRATIVES :**
- Conserve TOUS les faits : noms, prénoms, classes, dates, heures, créneaux, demandes. N'ajoute ni ne retire aucune information.
- Si le message commence par une ligne « Objet : ... », conserve cette ligne (ajuste sa formulation seulement si la retouche le justifie).
- Si le message se termine par une signature (nom, fonction...), reproduis-la EXACTEMENT à l'identique.
- Reste dans le registre professionnel du milieu éducatif.
- Renvoie UNIQUEMENT le message réécrit, sans commentaire, sans explication, sans balise.`;

    const tokenLimit = aiConfig.model === 'gpt-5-mini' ? 4000 : 2000;

    try {
      const { content, usage } = await callAI(aiConfig, prompt, tokenLimit, 'communication-revise', {
        temperature: 0.5
      });

      if (!content) {
        return jsonResponse(corsHeaders, 500, {
          error: 'Réponse invalide de l\'API. Veuillez réessayer.'
        });
      }

      const cleanedContent = cleanOutputText(content);

      // Débit du coût réel — `remainingTokens` seulement si le débit a réussi
      const cost = computeTokenCost(usage, prompt, content);
      const remainingTokens = await consumeCredits(user.id, cost, 'revision', aiConfig.model);

      return jsonResponse(corsHeaders, 200, {
        content: cleanedContent,
        usage,
        ...(typeof remainingTokens === 'number' && { remainingTokens })
      });
    } catch (error) {
      console.error('[communication-revise] API error:', error);
      const status = error instanceof AIApiError && error.status === 429 ? 429 : 500;
      return jsonResponse(corsHeaders, status, {
        error: 'Erreur lors de la retouche. Veuillez réessayer.'
      });
    }

  } catch (error) {
    console.error('[communication-revise] Error:', error);
    return jsonResponse(corsHeaders, 500, { error: 'Une erreur est survenue. Veuillez réessayer.' });
  }
};

Deno.serve(reviseHandler);
