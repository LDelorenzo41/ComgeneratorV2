// supabase/functions/communication-brief/index.ts
// Analyse le brouillon d'un enseignant (tapé, collé ou dicté au clavier) et
// pré-remplit le formulaire Communication : destinataire, ton, point de vue
// (rapport d'incident) et contenu restructuré en brief.
//
// Le brouillon n'est PAS transformé en message final : il est réorganisé en
// liste d'éléments à transmettre, tous les faits conservés — la génération
// reste une étape séparée, contrôlée par l'enseignant.
//
// Mêmes protections que les autres fonctions (JWT, solde, plafond/minute),
// débit du coût réel via consume_credits (kind 'communication_brief').

import { buildCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import { resolveAIConfig, callAI, computeTokenCost, AIApiError } from '../_shared/ai.ts';
import { getBalance, consumeCredits, countRecentDebits } from '../_shared/credits.ts';

const RATE_LIMIT_PER_MINUTE = 10;
const MAX_BROUILLON_LENGTH = 10000;

// Valeurs EXACTES des sélecteurs du front (CommunicationPage) — toute valeur
// hors liste est ramenée au défaut, jamais transmise telle quelle au front.
const DESTINATAIRES = [
  "Parent d'élève",
  "Parents d'élèves",
  'Élève',
  'Élèves',
  'Classe',
  'Collègue(s)',
  "Chef(fe) d'établissement / Chef(fe) adjoint",
  'Commission disciplinaire',
  "Rapport d'incident"
];
const DEFAULT_DESTINATAIRE = "Parents d'élèves";

// « Stricte » est la valeur historique attendue par les fonctions de
// génération (le front l'affiche « Strict »)
const TONS = ['Détendu', 'Neutre', 'Stricte'];
const DEFAULT_TON = 'Neutre';

/** Extrait le premier objet JSON d'une réponse IA (fences markdown tolérées) */
function parseAIJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

interface BriefParams {
  brouillon: string;
  /** Présent = mode « réponse » : analyse croisée avec le message reçu */
  messageRecu?: string;
  aiModel?: string;
}

const briefHandler = async (req: Request): Promise<Response> => {
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
  console.log(`[communication-brief] Utilisateur authentifié: ${user.id}`);

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');

    if (!OPENAI_API_KEY) {
      return jsonResponse(corsHeaders, 500, { error: 'Configuration serveur incomplète' });
    }

    const body: BriefParams = await req.json();
    const { brouillon, messageRecu, aiModel } = body;

    if (!brouillon || typeof brouillon !== 'string' || !brouillon.trim()) {
      return jsonResponse(corsHeaders, 400, {
        error: 'Le brouillon à analyser est vide.'
      });
    }

    if (brouillon.length > MAX_BROUILLON_LENGTH) {
      return jsonResponse(corsHeaders, 400, {
        error: `Le brouillon est trop long (maximum ${MAX_BROUILLON_LENGTH.toLocaleString('fr-FR')} caractères).`
      });
    }

    // Mode « réponse » : le message reçu accompagne le brouillon d'objectifs
    const isReplyMode = typeof messageRecu === 'string' && messageRecu.trim().length > 0;
    if (isReplyMode && (messageRecu as string).length > MAX_BROUILLON_LENGTH) {
      return jsonResponse(corsHeaders, 400, {
        error: `Le message reçu est trop long (maximum ${MAX_BROUILLON_LENGTH.toLocaleString('fr-FR')} caractères).`
      });
    }

    // Vérification du solde avant analyse
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

    console.log(`[communication-brief] Modèle IA utilisé: ${aiConfig.model} (mode ${isReplyMode ? 'réponse' : 'création'})`);

    // ========================================================================
    // MODE RÉPONSE : analyse croisée message reçu × objectifs de l'enseignant
    // ========================================================================
    const replyPrompt = `Tu es un assistant qui aide un enseignant à préparer sa RÉPONSE à un message reçu (parent d'élève, collègue, direction…). Tu analyses le message reçu et le brouillon d'objectifs de l'enseignant afin de pré-remplir un formulaire. Tu n'écris PAS la réponse finale.

**MESSAGE REÇU :**
"""
${messageRecu}
"""

**BROUILLON D'OBJECTIFS DE L'ENSEIGNANT (souvent dicté, en vrac) :**
"""
${brouillon}
"""

Réponds UNIQUEMENT avec un objet JSON valide, sans balise markdown, sans texte avant ou après, avec EXACTEMENT ces trois clés :

{
  "ton": "...",
  "contenu": "...",
  "manques": ["..."]
}

**RÈGLES :**

1. "ton" — une valeur EXACTE parmi : "Détendu" | "Neutre" | "Stricte"
   Choisis selon la teneur du message reçu ET l'intention de l'enseignant :
   - "Stricte" si l'enseignant veut recadrer, poser un cadre, répondre à une mise en cause.
   - "Détendu" pour une réponse chaleureuse à un message positif ou convivial.
   - Sinon "Neutre".

2. "contenu" — une CHAÎNE DE CARACTÈRES unique (jamais un tableau) : les objectifs de réponse réorganisés en liste claire, sous forme de tirets séparés par des retours à la ligne (\n) À L'INTÉRIEUR de la chaîne :
   - CONSERVE TOUS les faits du brouillon : décisions, dates, créneaux, conditions, points à rappeler.
   - N'invente RIEN : n'ajoute aucun objectif que l'enseignant n'a pas exprimé.
   - Supprime seulement les hésitations, répétitions et digressions.
   - Exemple de format attendu : "- Accepter le rendez-vous, proposer jeudi 17h\n- Rappeler le cadre : le carnet doit être signé\n- Rassurer sur la moyenne du trimestre"

3. "manques" — un tableau de 0 à 4 courtes phrases signalant :
   a) les questions ou demandes du MESSAGE REÇU auxquelles les objectifs de l'enseignant ne répondent pas (c'est le plus important : relève chaque point resté sans réponse) ;
   b) les informations pratiques absentes des objectifs (un rendez-vous accepté sans créneau proposé, un document promis sans échéance…).
   Règles : chaque entrée est une phrase courte et actionnable (ex. "Le parent demande si la sortie est maintenue — vos objectifs n'en parlent pas"). Si les objectifs couvrent tout, renvoie un tableau vide []. N'invente jamais de manque artificiel.`;

    // ========================================================================
    // MODE CRÉATION : analyse du brouillon seul
    // ========================================================================
    const createPrompt = `Tu es un assistant qui analyse le brouillon d'un enseignant afin de pré-remplir un formulaire de communication professionnelle. Tu n'écris PAS le message final.

**BROUILLON À ANALYSER :**
"""
${brouillon}
"""

Réponds UNIQUEMENT avec un objet JSON valide, sans balise markdown, sans texte avant ou après, avec EXACTEMENT ces cinq clés :

{
  "destinataire": "...",
  "ton": "...",
  "pointDeVue": "...",
  "contenu": "...",
  "manques": ["..."]
}

**RÈGLES :**

1. "destinataire" — une valeur EXACTE parmi :
   "Parent d'élève" | "Parents d'élèves" | "Élève" | "Élèves" | "Classe" | "Collègue(s)" | "Chef(fe) d'établissement / Chef(fe) adjoint" | "Commission disciplinaire" | "Rapport d'incident"
   - Les parents d'UN élève précis → "Parent d'élève" ; les parents de toute la classe → "Parents d'élèves".
   - Un incident à documenter factuellement, sans destinataire → "Rapport d'incident".
   - Un dossier pour conseil ou commission de discipline → "Commission disciplinaire".
   - Un message au principal, proviseur, directeur ou adjoint → "Chef(fe) d'établissement / Chef(fe) adjoint".
   - En cas de doute → "Parents d'élèves".

2. "ton" — une valeur EXACTE parmi : "Détendu" | "Neutre" | "Stricte"
   - "Stricte" pour un recadrage, un rappel à l'ordre, une situation grave.
   - "Détendu" pour un message positif, une félicitation, une information conviviale.
   - Sinon "Neutre".

3. "pointDeVue" — "premiere" ou "troisieme", UNIQUEMENT si destinataire = "Rapport d'incident" :
   - "premiere" si l'enseignant décrit ce qu'il a lui-même vu ou vécu (« j'ai constaté… »).
   - "troisieme" sinon. Pour tout autre destinataire, mets null.

4. "contenu" — une CHAÎNE DE CARACTÈRES unique (jamais un tableau) : le brouillon réorganisé en brief clair, sous forme de tirets séparés par des retours à la ligne (\n) À L'INTÉRIEUR de la chaîne :
   - CONSERVE TOUS les faits : noms, prénoms, classes, dates, heures, événements, demandes (rendez-vous, créneaux…).
   - N'invente RIEN, n'ajoute aucune formule de politesse.
   - Supprime seulement les hésitations, répétitions et digressions.
   - Ce n'est PAS le message final : c'est la liste des éléments que le message devra transmettre.
   - Exemple de format attendu : "- Lucas Martin, 4e B\n- Troisième retard cette semaine\n- Proposer un rendez-vous jeudi ou vendredi"

5. "manques" — un tableau de 0 à 5 courtes phrases signalant les informations CONCRÈTEMENT UTILES au message mais absentes du brouillon.
   Cas général (messages) :
   - un rendez-vous est proposé sans jour ni créneau précis ;
   - un élève est évoqué sans prénom ni classe ;
   - une demande est faite sans échéance.
   Cas particulier — si tu as déduit "Rapport d'incident", vérifie SPÉCIFIQUEMENT les rubriques exigées d'un rapport administratif :
   - date, heure et lieu précis de l'incident ;
   - personnes impliquées (élèves, adultes) et témoins éventuels ;
   - déroulé chronologique des faits ;
   - mesures immédiates prises ;
   - propos exacts tenus, si des paroles sont en cause.
   Cas particulier — si tu as déduit "Commission disciplinaire", vérifie SPÉCIFIQUEMENT les rubriques d'un bilan de présentation :
   - période concernée (depuis quand la situation dure) ;
   - faits marquants datés ;
   - sanctions et mesures déjà prises et leurs effets ;
   - évolution (aggravation, stagnation, amélioration) ;
   - impact sur la classe et les apprentissages.
   Règles : chaque entrée est une phrase courte et actionnable (ex. "Le créneau du rendez-vous n'est pas précisé"). Ne signale que les manques réellement gênants — si le brouillon est complet, renvoie un tableau vide []. N'invente jamais de manque artificiel.`;

    const prompt = isReplyMode ? replyPrompt : createPrompt;

    // Marges larges : une réponse tronquée casse le JSON (gpt-5-mini consomme
    // en plus des tokens de raisonnement sur ce plafond)
    const tokenLimit = aiConfig.model === 'gpt-5-mini' ? 4000 : 2500;

    try {
      // jsonObject : mode JSON natif (OpenAI et Mistral) — réponse garantie
      // syntaxiquement parseable, quel que soit le modèle choisi
      const { content, usage } = await callAI(aiConfig, prompt, tokenLimit, 'communication-brief', {
        temperature: 0.2,
        jsonObject: true
      });

      if (!content) {
        return jsonResponse(corsHeaders, 500, {
          error: "Réponse invalide de l'API. Veuillez réessayer."
        });
      }

      const parsed = parseAIJson(content);

      // contenu : chaîne attendue, tableau de lignes toléré — en mode JSON,
      // les modèles transforment volontiers « liste de tirets » en tableau,
      // ce qui est une réponse exploitable, pas un échec
      let contenu = '';
      if (parsed && typeof parsed.contenu === 'string') {
        contenu = parsed.contenu.trim();
      } else if (parsed && Array.isArray(parsed.contenu)) {
        contenu = (parsed.contenu as unknown[])
          .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
          .map((line) => {
            const t = line.trim();
            return t.startsWith('-') || t.startsWith('•') ? t : `- ${t}`;
          })
          .join('\n');
      }

      if (!parsed || !contenu) {
        // Le début de la réponse brute est journalisé pour diagnostic
        // (Dashboard → Edge Functions → communication-brief → Logs)
        console.error(`[communication-brief] JSON inexploitable (${aiConfig.model}):`, content.slice(0, 500));
        return jsonResponse(corsHeaders, 500, {
          error: "L'analyse du brouillon a échoué. Veuillez réessayer."
        });
      }

      // Validation stricte contre les listes du front — jamais de valeur libre.
      // En mode réponse, destinataire et point de vue ne s'appliquent pas.
      const destinataire = isReplyMode
        ? null
        : DESTINATAIRES.includes(parsed.destinataire as string)
          ? parsed.destinataire as string
          : DEFAULT_DESTINATAIRE;
      const ton = TONS.includes(parsed.ton as string)
        ? parsed.ton as string
        : DEFAULT_TON;
      const pointDeVue = !isReplyMode && destinataire === "Rapport d'incident" &&
        (parsed.pointDeVue === 'premiere' || parsed.pointDeVue === 'troisieme')
        ? parsed.pointDeVue
        : null;

      // Manques signalés : liste courte de chaînes, bornée (défense en
      // profondeur contre une réponse IA mal formée) ; une chaîne isolée
      // est tolérée et enveloppée en tableau
      const rawManques = Array.isArray(parsed.manques)
        ? parsed.manques as unknown[]
        : typeof parsed.manques === 'string' && parsed.manques.trim()
          ? [parsed.manques]
          : [];
      const manques = rawManques
        .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
        .slice(0, 5)
        .map((m) => m.trim().slice(0, 200));

      // Débit du coût réel (aucun débit si l'analyse a échoué plus haut)
      const cost = computeTokenCost(usage, prompt, content);
      const remainingTokens = await consumeCredits(
        user.id,
        cost,
        isReplyMode ? 'reply_brief' : 'communication_brief',
        aiConfig.model
      );

      console.log(`[communication-brief] Analyse OK (${contenu.length} caractères, ${manques.length} manque(s), ${cost} crédits)`);

      return jsonResponse(corsHeaders, 200, {
        destinataire,
        ton,
        pointDeVue,
        contenu,
        manques,
        usage,
        ...(typeof remainingTokens === 'number' && { remainingTokens })
      });
    } catch (error) {
      console.error('[communication-brief] API error:', error);
      const status = error instanceof AIApiError && error.status === 429 ? 429 : 500;
      return jsonResponse(corsHeaders, status, {
        error: "Erreur lors de l'analyse du brouillon. Veuillez réessayer."
      });
    }

  } catch (error) {
    console.error('[communication-brief] Error:', error);
    return jsonResponse(corsHeaders, 500, { error: 'Une erreur est survenue. Veuillez réessayer.' });
  }
};

Deno.serve(briefHandler);
