// supabase/functions/reply/index.ts
// VERSION AVEC CHOIX DE MODÈLE IA (GPT-4.1-mini par défaut, GPT-5 mini, Mistral Medium)
// et DÉBIT DES CRÉDITS CÔTÉ SERVEUR (lot 1) :
//   - vérification du solde avant génération (402 si épuisé)
//   - plafond de requêtes par minute (429)
//   - débit du coût réel via consume_credits, tracé dans credit_ledger
//   - le nouveau solde est renvoyé dans `remainingTokens` ; en son absence
//     (échec du débit, migration non appliquée), le front conserve son
//     débit client historique — aucune génération gratuite possible.

import { buildCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import { resolveAIConfig, callAI, computeTokenCost, AIApiError } from '../_shared/ai.ts';
import { getBalance, consumeCredits, countRecentDebits } from '../_shared/credits.ts';

// Plafond de générations par utilisateur et par minute (toutes fonctions
// migrées confondues — compté sur credit_ledger)
const RATE_LIMIT_PER_MINUTE = 10;

/**
 * Nettoie le texte de sortie
 * - Supprime le markdown résiduel
 * - Supprime les méta-commentaires de Mistral (Notes d'adaptation, etc.)
 */
function cleanOutputText(text) {
  if (!text) return text;

  let cleaned = text.trim();

  // ✅ Supprimer les sections de méta-commentaires de Mistral
  // Ces sections commencent généralement par "---" suivi de "Notes", "Remarques", "Adaptation", etc.
  cleaned = cleaned.replace(/\n---\s*\n[\s\S]*?(?:Notes?|Remarques?|Adaptation|Contextuelle|Structure|Analyse|Commentaires?)[\s\S]*$/gi, '');

  // Supprimer aussi les variantes sans les tirets
  cleaned = cleaned.replace(/\n\n(?:Notes? d'adaptation|Remarques? contextuelles?|Notes? de rédaction|Analyse du message)[\s\S]*$/gi, '');

  // Supprimer les balises markdown de mise en forme excessive
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/`{1,3}/g, '');

  // Supprimer les lignes vides multiples
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  cleaned = cleaned.trim();

  // Supprimer ponctuation orpheline au début
  cleaned = cleaned.replace(/^[\s:\-\*]+/, '');

  return cleaned;
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

interface ReplyParams {
  message: string;
  ton: string;
  objectifs: string;
  signature?: string | null;
  aiModel?: string;
}

const replyHandler = async (req: Request): Promise<Response> => {
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
  console.log(`[reply] Utilisateur authentifié: ${user.id}`);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

    if (!OPENAI_API_KEY) {
      return jsonResponse(corsHeaders, 500, { error: 'Configuration serveur incomplète' });
    }

    const body: ReplyParams = await req.json();
    const { message, ton, objectifs, signature, aiModel } = body;

    // Validation minimale des entrées (évite un appel IA inutile sur message vide)
    if (!message || typeof message !== 'string' || !message.trim()) {
      return jsonResponse(corsHeaders, 400, {
        error: 'Paramètres manquants : le message reçu est requis.'
      });
    }

    // ✅ LOT 1 : Vérification du solde avant génération.
    // Dégradation douce : si le solde est illisible (indisponibilité), on ne
    // bloque pas la génération — le front garde alors son débit client.
    const balance = await getBalance(user.id);
    if (balance !== null && balance <= 0) {
      return jsonResponse(corsHeaders, 402, {
        error: 'Crédits insuffisants. Rechargez votre compte pour continuer.'
      });
    }

    // ✅ LOT 1 : Plafond de requêtes par minute
    const recentDebits = await countRecentDebits(user.id, 60);
    if (recentDebits !== null && recentDebits >= RATE_LIMIT_PER_MINUTE) {
      return jsonResponse(corsHeaders, 429, {
        error: 'Trop de requêtes. Veuillez patienter une minute avant de réessayer.'
      });
    }

    // Résoudre la configuration API
    let aiConfig;
    try {
      aiConfig = resolveAIConfig(aiModel, OPENAI_API_KEY, MISTRAL_API_KEY);
    } catch (configError) {
      return jsonResponse(corsHeaders, 500, { error: configError.message });
    }

    console.log(`[reply] Modèle IA utilisé: ${aiConfig.model}`);

    // ✅ Instruction anti-méta-commentaires pour Mistral
    const noMetaInstruction = aiConfig.model === 'mistral-medium-latest'
      ? `\n\n⚠️ IMPORTANT : Rédige UNIQUEMENT la réponse finale. N'ajoute AUCUNE note, remarque, analyse ou commentaire sur ta propre rédaction. Pas de section "Notes d'adaptation" ou similaire.`
      : '';

    const prompt = `Tu es un enseignant expérimenté qui rédige une réponse professionnelle et réfléchie à un message reçu.

**CONTEXTE DE LA RÉPONSE :**

**MESSAGE REÇU À ANALYSER :**
"""
${message}
"""

**TON SOUHAITÉ POUR LA RÉPONSE :** ${ton}
**OBJECTIFS ET ÉLÉMENTS À INTÉGRER :** ${objectifs}

**INSTRUCTIONS D'ANALYSE ET DE RÉDACTION :**

1. **Analyse du message reçu :**
   - Identifie le type d'expéditeur probable (parent, collègue, direction, élève)
   - Détermine le niveau de formalisme nécessaire
   - Repère les points clés qui nécessitent une réponse
   - Évalue le ton du message original (inquiet, neutre, satisfait, etc.)
   - Détecte les questions explicites et implicites

2. **Adaptation du ton de réponse :**
${getReplyToneInstructions(ton)}

3. **Structure de la réponse :**
   - **Accusé de réception :** Remercie pour le message et montre que tu as bien compris
   - **Réponse aux points soulevés :** Traite chaque élément important du message original
   - **Intégration des objectifs :** Intègre naturellement les éléments demandés
   - **Propositions/Solutions :** Si pertinent, propose des actions concrètes
   - **Ouverture au dialogue :** Invite à continuer l'échange si nécessaire

4. **Principes de communication :**
   - **Empathie :** Comprends et valide les préoccupations exprimées
   - **Clarté :** Réponds de manière précise et sans ambiguïté
   - **Proactivité :** Anticipe les questions non formulées
   - **Bienveillance :** Maintiens un ton positif même si le message original est critique
   - **Professionnalisme :** Reste dans le cadre de tes responsabilités d'enseignant

5. **Exigences qualité :**
   - Réponds à TOUS les points importants du message original
   - Évite les réponses évasives ou trop générales
   - Utilise un vocabulaire adapté à l'interlocuteur
   - Propose des solutions concrètes quand c'est possible
   - Maintiens un équilibre entre réactivité et réflexion

6. **Signature :**
${signature ?
  `   - Termine OBLIGATOIREMENT par cette signature exacte :\n   ${signature}\n   - N'ajoute aucune autre signature ou formule de clôture` :
  `   - Termine par une formule de clôture professionnelle adaptée au contexte`
}

**CONSIGNES SPÉCIFIQUES :**
- Adapte automatiquement le niveau de formalisme selon l'expéditeur détecté
- Si le message original exprime une inquiétude, rassure tout en étant factuel
- Si le message original est positif, partage cette satisfaction
- Si le message original contient une critique, réponds de manière constructive
- Intègre tous les objectifs demandés de manière naturelle et cohérente
- Évite les réponses trop longues : sois concis mais complet

**ATTENTION PARTICULIÈRE :**
- Si le message original semble urgent, commence par reconnaître cette urgence
- Si le message original contient des questions précises, réponds point par point
- Si le message original mentionne un problème, propose des solutions concrètes
- Si le message original demande un rendez-vous, donne des créneaux ou modalités
${noMetaInstruction}

Rédige maintenant cette réponse en respectant scrupuleusement ces instructions et en t'adaptant intelligemment au contexte du message reçu.`;

    // Token limit selon le modèle
    const tokenLimit = aiConfig.model === 'gpt-5-mini' ? 4000 : 2000;

    // Appel IA + débit
    try {
      const { content: rawContent, usage } = await callAI(aiConfig, prompt, tokenLimit, 'reply');

      if (!rawContent) {
        return jsonResponse(corsHeaders, 500, {
          error: 'Réponse invalide de l\'API. Veuillez réessayer.'
        });
      }

      // ✅ Nettoyer le contenu (supprime les méta-commentaires Mistral)
      const content = cleanOutputText(rawContent);

      console.log(`[reply] Réponse générée (${content.length} caractères) avec ${aiConfig.model}`);

      // ✅ LOT 1 : Débit du coût réel côté serveur.
      // `remainingTokens` n'est renvoyé que si le débit a réussi : sinon le
      // front applique son débit client historique (aucun débit perdu).
      const cost = computeTokenCost(usage, prompt, rawContent);
      const remainingTokens = await consumeCredits(user.id, cost, 'reply', aiConfig.model);

      return jsonResponse(corsHeaders, 200, {
        content,
        usage,
        ...(typeof remainingTokens === 'number' && { remainingTokens })
      });
    } catch (error) {
      console.error('[reply] API error:', error);
      // Comme historiquement : le statut amont de l'API IA est propagé
      const status = error instanceof AIApiError ? error.status : 500;
      return jsonResponse(corsHeaders, status, {
        error: 'Erreur lors de la génération de la réponse'
      });
    }

  } catch (error) {
    console.error('[reply] Error:', error);
    return jsonResponse(corsHeaders, 500, {
      error: error.message || 'Une erreur est survenue. Veuillez réessayer.'
    });
  }
};

// =====================================================
// FONCTIONS HELPER
// =====================================================

function getReplyToneInstructions(ton: string): string {
  switch (ton.toLowerCase()) {
    case "détendu":
      return `   - Adopte un ton chaleureux et accessible
   - Utilise des formulations naturelles et empathiques
   - Montre de la proximité tout en restant professionnel
   - Autorise quelques touches personnelles appropriées
   - Évite la rigidité excessive
   - Privilégie l'aspect humain de la relation éducative
   - Utilise des formulations rassurantes et encourageantes`;

    case "neutre":
      return `   - Maintiens un registre professionnel équilibré
   - Sois factuel et objectif dans tes réponses
   - Évite les effusions d'émotion mais reste bienveillant
   - Utilise un vocabulaire précis et approprié
   - Garde une distance professionnelle respectueuse
   - Privilégie la clarté et l'efficacité dans la communication
   - Reste courtois sans être trop chaleureux`;

    case "stricte":
      return `   - Adopte un registre soutenu et protocolaire
   - Utilise des formulations précises et sans ambiguïté
   - Maintiens une autorité bienveillante mais ferme
   - Évite les familiarités ou les effets de style
   - Structure très clairement tes arguments et réponses
   - Reste respectueux tout en marquant ton expertise
   - Privilégie le cadre institutionnel et les règles établies`;

    default:
      return `   - Adapte le ton au contexte en privilégiant le professionnalisme
   - Équilibre entre respect du cadre et proximité humaine
   - Maintiens la bienveillance caractéristique du milieu éducatif`;
  }
}

Deno.serve(replyHandler);
