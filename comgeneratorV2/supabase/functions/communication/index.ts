// supabase/functions/communication/index.ts
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
 * Nettoie le texte de sortie.
 * keepMarkdown : pour les DOCUMENTS structurés (rapport d'incident, bilan de
 * commission), le markdown (titres, gras) est conservé — le front l'affiche
 * avec un rendu propre. Pour les messages, il est retiré comme historiquement.
 */
function cleanOutputText(text, keepMarkdown = false) {
  if (!text) return text;

  let cleaned = text.trim();

  if (!keepMarkdown) {
    // Supprimer les balises markdown de mise en forme excessive
    cleaned = cleaned.replace(/\*\*/g, '');
    cleaned = cleaned.replace(/\*/g, '');
    cleaned = cleaned.replace(/`{1,3}/g, '');
  }

  // Supprimer les lignes vides multiples
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  cleaned = cleaned.trim();

  if (!keepMarkdown) {
    // Supprimer ponctuation orpheline au début
    cleaned = cleaned.replace(/^[\s:\-\*]+/, '');
  }

  return cleaned;
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

interface CommunicationParams {
  destinataire: string;
  ton: string;
  contenu: string;
  signature?: string | null;
  aiModel?: string;
}

const communicationHandler = async (req: Request): Promise<Response> => {
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
  console.log(`[communication] Utilisateur authentifié: ${user.id}`);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

    if (!OPENAI_API_KEY) {
      return jsonResponse(corsHeaders, 500, { error: 'Configuration serveur incomplète' });
    }

    const body: CommunicationParams = await req.json();
    const { destinataire, ton, contenu, signature, aiModel } = body;

    // Validation minimale des entrées (évite un appel IA inutile et un crash
    // sur destinataire.toLowerCase() si le champ est absent)
    if (!destinataire || typeof destinataire !== 'string' || !contenu || !contenu.trim()) {
      return jsonResponse(corsHeaders, 400, {
        error: 'Paramètres manquants : destinataire et contenu sont requis.'
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

    console.log(`[communication] Modèle IA utilisé: ${aiConfig.model}`);

    // ⚠️ CAS SPÉCIAL : Commission disciplinaire (prompt complètement différent)
    const isCommission = destinataire.toLowerCase() === "commission disciplinaire";

    // Documents structurés : le markdown est conservé (rendu propre côté front)
    const isDocument = isCommission || destinataire.toLowerCase() === "rapport d'incident";

    let prompt: string;
    let tokenLimit: number;
    let apiErrorMessage: string;

    if (isCommission) {
      prompt = `Tu es un assistant spécialisé dans l'analyse et la rédaction de bilans disciplinaires en milieu scolaire.

**⚠️ ATTENTION CRITIQUE :**
- Tu NE dois PAS rédiger une lettre formelle avec "Madame, Monsieur" ou formule de politesse
- Tu NE dois PAS simplement reformuler ou lister les informations
- Tu dois produire un BILAN ANALYTIQUE structuré avec des HYPOTHÈSES et des PROPOSITIONS

**CONTENU BRUT À ANALYSER :**
"""
${contenu}
"""

**TA MISSION :**
Analyse ce texte désordonné et produis un bilan complet pour présentation en commission. Le document doit être structuré, analytique et orienté vers l'action.

**STRUCTURE OBLIGATOIRE À RESPECTER :**

# I. CONTEXTE GÉNÉRAL
[Présente : classe, niveau, motif de présentation, évolution générale de la situation]

# II. FAITS MARQUANTS
[Synthèse organisée des comportements en cours et hors cours]
- Incidents notables
- Fréquence et gravité
- Chronologie si pertinente

# III. ANALYSE RAISONNÉE DU COMPORTEMENT
[C'est LA partie la plus importante - tu dois ANALYSER, pas juste décrire]
- Quels sont les déclencheurs possibles ou facteurs aggravants ?
- Formule des HYPOTHÈSES explicatives (sans diagnostic médical) :
  * Difficultés scolaires qui génèrent du décrochage ?
  * Recherche d'attention du groupe ?
  * Opposition systématique à l'autorité ?
  * Facteurs environnementaux (famille, contexte personnel) ?
- Évolution dans le temps : aggravation, stagnation ou amélioration ?

# IV. IMPACT SUR LA SCOLARITÉ ET LE CLIMAT SCOLAIRE
- Conséquences sur les apprentissages de l'élève
- Conséquences sur les autres élèves et les adultes
- Impact sur le climat de classe

# V. PROPOSITIONS DE MESURES ET DE SUIVIS
[C'est aussi une partie CRITIQUE - tu dois être CONCRET et ACTIONNABLE]
**Mesures immédiates à envisager :**
- [Ex : entretien individuel, contrat de comportement, médiation, etc.]

**Mesures à moyen terme :**
- [Ex : tutorat, accompagnement psychopédagogique, travail sur compétences socio-émotionnelles, etc.]

**Propositions de tests/expérimentations :**
- [Ex : suivi hebdomadaire, fiche de suivi quotidienne, évaluation du climat de classe, etc.]

**Indicateurs de suivi et calendrier de réévaluation :**
- [Quels indicateurs observer ? Quand faire le point ?]

# VI. CONCLUSION SYNTHÉTIQUE POUR LA COMMISSION
- Points essentiels à retenir
- Recommandations pour la décision de la commission

**CONSIGNES IMPÉRATIVES :**
- Si des informations manquent, indique "Informations manquantes : [précise quoi]"
- Reste objectif et factuel
- Formule les hypothèses comme des hypothèses, JAMAIS de diagnostics médicaux
- Ton professionnel mais pas formel (pas de "Madame, Monsieur")
- Focus sur l'ANALYSE et les PROPOSITIONS, pas juste la description

${signature ?
  `\n**SIGNATURE :**\nTermine par cette signature :\n${signature}` :
  ''
}

Rédige maintenant le bilan complet en respectant SCRUPULEUSEMENT cette structure et en ANALYSANT vraiment la situation.`;

      // Token limit plus élevé pour les bilans de commission (documents longs)
      tokenLimit = aiConfig.model === 'gpt-5-mini' ? 4000 : 3000;
      apiErrorMessage = 'Erreur lors de la génération du bilan. Veuillez réessayer.';
    } else {
      // =====================================================
      // CAS STANDARD : Tous les autres destinataires
      // =====================================================

      prompt = `Tu es un enseignant expérimenté qui rédige une communication professionnelle dans le milieu éducatif.

**CONTEXTE DE LA COMMUNICATION :**
- **Destinataire :** ${destinataire}
- **Ton souhaité :** ${ton}
- **Contenu à transmettre :** ${contenu}

**INSTRUCTIONS DE RÉDACTION :**

1. **Adaptation au destinataire :**
${getDestinataireInstructions(destinataire)}

2. **Adaptation du ton :**
${getTonInstructions(ton)}

3. **Structure à respecter :**
   - **Objet/Titre :** ${isDocument
     ? 'Concis et informatif (si pertinent)'
     : `Commence OBLIGATOIREMENT ta réponse par une première ligne « Objet : ... » (concise et informative), suivie d'une ligne vide, puis le message`}
   - **Salutation :** Appropriée au destinataire et au contexte
   - **Introduction :** Contexte bref et raison du message
   - **Corps du message :** Développement clair et structuré des éléments
   - **Conclusion :** Synthèse ou appel à l'action si nécessaire
   - **Formule de clôture :** Professionnelle et adaptée

4. **Exigences qualité :**
   - Langage clair, précis et professionnel
   - Phrases courtes et bien construites
   - Éviter le jargon technique sauf si nécessaire
   - Ton respectueux et bienveillant en toutes circonstances
   - Longueur adaptée : ni trop concis ni trop verbeux

5. **Signature :**
${signature ?
  `- Termine OBLIGATOIREMENT par cette signature exacte :\n${signature}\n- N'ajoute aucune autre signature ou formule de clôture` :
  `- Termine par une formule de clôture professionnelle standard adaptée au destinataire`
}

**CONSIGNES SPÉCIFIQUES :**
- Intègre naturellement tous les éléments du contenu fourni
- Assure-toi que le message soit actionnable si nécessaire
- Maintiens un équilibre entre professionnalisme et proximité humaine
- Évite les formulations trop complexes ou ambiguës

Rédige maintenant cette communication en respectant scrupuleusement ces instructions.`;

      tokenLimit = aiConfig.model === 'gpt-5-mini' ? 4000 : 2000;
      apiErrorMessage = 'Erreur lors de la génération de la communication. Veuillez réessayer.';
    }

    // Appel IA + débit
    try {
      const { content, usage } = await callAI(aiConfig, prompt, tokenLimit, 'communication');

      if (!content) {
        return jsonResponse(corsHeaders, 500, {
          error: 'Réponse invalide de l\'API. Veuillez réessayer.'
        });
      }

      const cleanedContent = cleanOutputText(content, isDocument);

      // ✅ LOT 1 : Débit du coût réel côté serveur.
      // `remainingTokens` n'est renvoyé que si le débit a réussi : sinon le
      // front applique son débit client historique (aucun débit perdu).
      const cost = computeTokenCost(usage, prompt, content);
      const remainingTokens = await consumeCredits(user.id, cost, 'communication', aiConfig.model);

      return jsonResponse(corsHeaders, 200, {
        content: cleanedContent,
        usage,
        ...(typeof remainingTokens === 'number' && { remainingTokens })
      });
    } catch (error) {
      console.error('[communication] API error:', error);
      // Un 429 amont (quota du fournisseur IA) est propagé tel quel :
      // le front affiche déjà un message dédié pour ce statut.
      const status = error instanceof AIApiError && error.status === 429 ? 429 : 500;
      return jsonResponse(corsHeaders, status, { error: apiErrorMessage });
    }

  } catch (error) {
    console.error('[communication] Error:', error);
    return jsonResponse(corsHeaders, 500, { error: 'Une erreur est survenue. Veuillez réessayer.' });
  }
};

// =====================================================
// FONCTIONS HELPER - INSTRUCTIONS DESTINATAIRE
// =====================================================

function getDestinataireInstructions(destinataire: string): string {
  const dest = destinataire.toLowerCase();

  // Parent au singulier
  if (dest === "parent d'élève") {
    return `- Utilise un registre professionnel mais accessible
- Évite le jargon pédagogique complexe
- Sois bienveillant et rassurant
- Privilégie "Madame" ou "Monsieur" (selon le contexte)
- Contextualise les informations de manière compréhensible
- Propose des solutions ou pistes d'accompagnement si pertinent
- **IMPORTANT :** Utilise le singulier dans tout le message (votre enfant, vous êtes, etc.)`;
  }

  // Parents au pluriel
  if (dest === "parents d'élèves") {
    return `- Utilise un registre professionnel mais accessible
- Évite le jargon pédagogique complexe
- Sois bienveillant et rassurant
- Privilégie "Madame, Monsieur" ou "Chers parents"
- Contextualise les informations pour qu'elles soient compréhensibles
- Propose des solutions ou des pistes d'accompagnement si pertinent
- **IMPORTANT :** Utilise le pluriel dans tout le message (vos enfants, vous êtes, etc.)`;
  }

  // Élève au singulier
  if (dest === "élève") {
    return `- Adopte un ton direct mais respectueux
- Utilise un vocabulaire adapté à l'âge de l'élève
- Sois encourageant tout en étant clair sur les attentes
- Privilégie "Bonjour [Prénom]" si le nom est mentionné, sinon utilise un ton général
- Évite les formulations culpabilisantes
- Propose des axes d'amélioration constructifs
- **IMPORTANT :** Tutoie l'élève et utilise le singulier (tu, ton, ta, etc.)`;
  }

  // Élèves au pluriel
  if (dest === "élèves") {
    return `- Adopte un ton direct mais respectueux
- Utilise un vocabulaire adapté à l'âge des élèves
- Sois encourageant tout en étant clair sur les attentes
- Privilégie "Chers élèves" ou "Bonjour à tous"
- Évite les formulations culpabilisantes
- Propose des axes d'amélioration constructifs
- **IMPORTANT :** Tutoie les élèves au pluriel (vous, vos, etc.)`;
  }

  // Classe (similaire à élèves pluriel mais plus collectif)
  if (dest === "classe") {
    return `- S'adresse à l'ensemble du groupe
- Utilise "Chers élèves" ou "Bonjour à tous"
- Ton fédérateur et motivant
- Messages clairs et concis
- Évite les références individuelles
- Privilégie l'esprit de groupe et la cohésion
- **IMPORTANT :** Tutoie au pluriel avec un accent sur le collectif`;
  }

  // Collègue(s)
  if (dest === "collègue(s)") {
    return `- Registre professionnel entre pairs
- Peux utiliser un ton plus direct et technique
- Privilégie "Bonjour [Prénom]" ou "Chers collègues" selon le contexte
- Références pédagogiques acceptées
- Sois concis et efficace
- Propose collaboration si pertinent
- Utilise le vouvoiement ou tutoiement selon votre relation habituelle`;
  }

  // Direction
  if (dest === "chef(fe) d'établissement / chef(fe) adjoint") {
    return `- Registre soutenu et protocolaire
- Utilise "Madame/Monsieur [Fonction]" ou "Madame la Directrice/Monsieur le Principal"
- Ton respectueux et professionnel
- Structure très claire avec contexte précis
- Argumente les demandes ou constats
- Propose des solutions concrètes
- Vouvoiement obligatoire`;
  }

  // Commission disciplinaire - PROMPT SPÉCIAL (géré séparément)
  if (dest === "commission disciplinaire") {
    return `**ATTENTION : Cette communication nécessite un traitement spécial car c'est une présentation de cas pour commission.**`;
  }

  // Rapport d'incident - Descriptif factuel sans destinataire
  if (dest === "rapport d'incident") {
    return `- Registre administratif formel et précis
- **PAS DE DESTINATAIRE** : c'est un document factuel
- Utilise "Rapport d'incident du [date]" comme titre
- Structure obligatoire :
  * **Date, heure et lieu précis**
  * **Personnes impliquées** (élèves, personnels)
  * **Description factuelle et chronologique des événements**
  * **Témoignages éventuels**
  * **Mesures immédiates prises**
  * **Conséquences observées**
  * **Suites envisagées**
- Ton neutre et objectif, sans interprétation personnelle
- Vocabulaire précis et sans ambiguïté
- **Évite les jugements de valeur**
- Reste factuel : décris ce qui s'est passé, pas ce que tu penses
- Mentionne tous les éléments observables (paroles, gestes, attitudes)
- Utilise la troisième personne ou le passif pour plus d'objectivité
- Le rapport doit pouvoir être versé au dossier administratif`;
  }

  // Défaut - cas inconnu (sécurité)
  return `- Adapte le registre au contexte professionnel éducatif
- Maintiens un ton respectueux et bienveillant
- Structure claire et professionnelle`;
}

// =====================================================
// FONCTIONS HELPER - INSTRUCTIONS TON
// =====================================================

function getTonInstructions(ton: string): string {
  switch (ton.toLowerCase()) {
    case "détendu":
      return `- Utilise un langage naturel et fluide
- Autorise quelques tournures moins formelles (tout en restant professionnel)
- Montre de la proximité et de l'empathie
- Utilise des formulations chaleureuses
- Évite la rigidité excessive
- Privilégie un style conversationnel adapté`;

    case "neutre":
      return `- Adopte un registre professionnel standard
- Équilibre entre formalisme et accessibilité
- Ton objectif et factuel
- Évite les effets de style ou l'excès d'émotion
- Reste courtois sans être trop chaleureux
- Privilégie la clarté et l'efficacité`;

    case "stricte":
      return `- Utilise un registre soutenu et protocolaire
- Formulations précises et sans ambiguïté
- Ton ferme mais toujours respectueux
- Évite les familiarités
- Structure très claire avec arguments solides
- Maintiens l'autorité tout en restant bienveillant`;

    default:
      return `- Adapte le ton au contexte en privilégiant le professionnalisme
- Maintiens un équilibre entre respect et proximité humaine`;
  }
}

Deno.serve(communicationHandler);
