// supabase/functions/transcribe/index.ts
// Transcription audio via l'API Mistral (Voxtral) — service générique.
//
// Lot 3 v0.1 : utilisé par la dictée vocale de la page Communication ;
// conçu pour être réutilisable par d'autres fonctionnalités (synthèse,
// séances, chatbot…).
//
// Principes :
// - L'audio TRANSITE seulement : il est relayé vers Mistral puis oublié,
//   jamais écrit dans Storage (voix + noms d'élèves = données personnelles).
// - Débit côté serveur via consume_credits (kind 'transcription'),
//   au tarif CREDITS_PER_MINUTE par minute entamée, annoncé dans l'interface
//   avant l'enregistrement.
// - Mêmes protections que communication/reply : JWT, solde, plafond de
//   requêtes par minute, réponses d'erreur JSON en français.

import { buildCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import { getBalance, consumeCredits, countRecentDebits } from '../_shared/credits.ts';

// Tarif : crédits débités par minute entamée (décision produit du 14/08/2026 :
// proche du coût réel — la dictée est une commodité face au micro du clavier,
// pas une fonctionnalité premium)
const CREDITS_PER_MINUTE = 100;

// Durée maximale acceptée (le front limite déjà à 180 s ; marge serveur)
const MAX_DURATION_SECONDS = 300;

// Taille maximale du fichier audio (3 min d'opus ≈ 2-3 Mo ; marge large)
const MAX_FILE_BYTES = 15 * 1024 * 1024;

// Plafond de requêtes par utilisateur et par minute (compté sur credit_ledger)
const RATE_LIMIT_PER_MINUTE = 10;

const MISTRAL_TRANSCRIPTION_URL = 'https://api.mistral.ai/v1/audio/transcriptions';
const MISTRAL_MODEL = 'voxtral-mini-latest';

// Lexique Éducation nationale « soufflé » au modèle de transcription
// (context_bias Voxtral, 100 termes max) : sigles et vocabulaire que les
// claviers transcrivent mal. Complété par les matières de l'utilisateur.
const EDUCATION_LEXICON = [
  'PPRE', 'PAI', 'PAP', 'AESH', 'AED', 'ULIS', 'SEGPA', 'CPE', 'EDT',
  'ENT', 'LSU', 'DNB', 'EPS', 'SVT', 'EMC', 'Pronote', 'ÉduConnect',
  'vie scolaire', 'conseil de classe', 'conseil de discipline',
  'commission éducative', 'carnet de correspondance', 'salle de permanence',
  'professeur principal', 'professeure principale', 'chef d\'établissement',
  'principal adjoint', 'principale adjointe', 'brevet blanc', 'oral blanc',
  'retenue', 'exclusion de cours', 'rapport d\'incident', 'bulletin scolaire',
  'rendez-vous', 'sixième', 'cinquième', 'quatrième', 'troisième',
  'seconde', 'première', 'terminale', '6e', '5e', '4e', '3e'
];

/**
 * Construit la liste de termes pour context_bias : lexique fixe + matières
 * de l'utilisateur (table subjects). Best-effort : retourne le lexique seul
 * en cas d'indisponibilité.
 */
async function buildContextBias(userId: string): Promise<string> {
  const terms = new Set<string>(EDUCATION_LEXICON);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      const res = await fetch(
        `${url}/rest/v1/subjects?user_id=eq.${userId}&select=name`,
        { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } }
      );
      if (res.ok) {
        const rows = await res.json();
        for (const row of Array.isArray(rows) ? rows : []) {
          if (typeof row?.name === 'string' && row.name.trim()) {
            // Les virgules servent de séparateur dans context_bias
            terms.add(row.name.trim().replace(/,/g, ' '));
          }
        }
      }
    }
  } catch (error) {
    console.warn('[transcribe] buildContextBias: matières indisponibles', error);
  }

  return [...terms].slice(0, 100).join(',');
}

const transcribeHandler = async (req: Request): Promise<Response> => {
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
  console.log(`[transcribe] Utilisateur authentifié: ${user.id}`);

  try {
    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');
    if (!MISTRAL_API_KEY) {
      return jsonResponse(corsHeaders, 500, {
        error: "Le service de transcription n'est pas configuré."
      });
    }

    // Vérification du solde avant transcription
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

    // Lecture du multipart
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return jsonResponse(corsHeaders, 400, {
        error: 'Requête invalide : un envoi multipart/form-data est attendu.'
      });
    }

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return jsonResponse(corsHeaders, 400, {
        error: "Aucun enregistrement audio reçu. Veuillez réessayer."
      });
    }

    if (file.size > MAX_FILE_BYTES) {
      return jsonResponse(corsHeaders, 413, {
        error: 'Enregistrement trop volumineux. Limitez la dictée à 3 minutes.'
      });
    }

    // Durée déclarée par le client (le coût est plafonné par MAX_DURATION_SECONDS,
    // et au minimum une minute est facturée)
    const rawDuration = parseInt(String(formData.get('durationSeconds') ?? ''), 10);
    const durationSeconds = Number.isFinite(rawDuration)
      ? Math.min(Math.max(rawDuration, 1), MAX_DURATION_SECONDS)
      : 60;

    // Langue : code ISO à 2 lettres, français par défaut
    const rawLanguage = String(formData.get('language') ?? 'fr');
    const language = /^[a-z]{2}$/.test(rawLanguage) ? rawLanguage : 'fr';

    // Relais vers Mistral, avec le lexique métier (context_bias).
    // Si l'API refuse la requête avec le lexique (paramètre non reconnu,
    // format…), on retente une fois SANS lexique avant d'abandonner :
    // la transcription ne doit jamais échouer à cause d'une option de confort.
    const buildForm = (withBias: string | null): FormData => {
      const f = new FormData();
      f.append('file', file, file.name || 'dictee.webm');
      f.append('model', MISTRAL_MODEL);
      f.append('language', language);
      if (withBias) f.append('context_bias', withBias);
      return f;
    };

    const contextBias = await buildContextBias(user.id);

    let mistralResponse = await fetch(MISTRAL_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}` },
      body: buildForm(contextBias),
    });

    if (!mistralResponse.ok && (mistralResponse.status === 400 || mistralResponse.status === 422)) {
      console.warn(`[transcribe] ${mistralResponse.status} avec context_bias, nouvel essai sans lexique`);
      mistralResponse = await fetch(MISTRAL_TRANSCRIPTION_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}` },
        body: buildForm(null),
      });
    }

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text();
      console.error(`[transcribe] Mistral API error ${mistralResponse.status}:`, errorText);

      if (mistralResponse.status === 400 || mistralResponse.status === 415 || mistralResponse.status === 422) {
        return jsonResponse(corsHeaders, 400, {
          error: 'Format audio non pris en charge par le service de transcription. Réessayez avec une version récente de Chrome, Safari ou Firefox.'
        });
      }
      if (mistralResponse.status === 401 || mistralResponse.status === 403) {
        return jsonResponse(corsHeaders, 500, {
          error: 'Le service de transcription est mal configuré (clé API). Contactez le support.'
        });
      }
      if (mistralResponse.status === 429) {
        return jsonResponse(corsHeaders, 429, {
          error: 'Service de transcription momentanément saturé. Réessayez dans quelques instants.'
        });
      }
      return jsonResponse(corsHeaders, 500, {
        error: 'Erreur du service de transcription. Veuillez réessayer.'
      });
    }

    const mistralData = await mistralResponse.json();
    const text = typeof mistralData?.text === 'string' ? mistralData.text.trim() : '';

    if (!text) {
      // Audio muet ou inexploitable : pas de débit, message clair
      return jsonResponse(corsHeaders, 422, {
        error: "Aucune parole détectée dans l'enregistrement. Veuillez réessayer."
      });
    }

    // Débit : par minute entamée, minimum une minute.
    // `remainingTokens` n'est renvoyé que si le débit a réussi.
    const cost = Math.ceil(durationSeconds / 60) * CREDITS_PER_MINUTE;
    const remainingTokens = await consumeCredits(user.id, cost, 'transcription', MISTRAL_MODEL);

    console.log(`[transcribe] ${text.length} caractères transcrits (${durationSeconds}s, ${cost} crédits)`);

    return jsonResponse(corsHeaders, 200, {
      text,
      durationSeconds,
      cost,
      ...(typeof remainingTokens === 'number' && { remainingTokens })
    });

  } catch (error) {
    console.error('[transcribe] Error:', error);
    return jsonResponse(corsHeaders, 500, {
      error: 'Une erreur est survenue. Veuillez réessayer.'
    });
  }
};

Deno.serve(transcribeHandler);
