// supabase/functions/communication/index.ts

interface CommunicationParams {
  destinataire: string;
  ton: string;
  contenu: string;
  signature?: string | null;
}

const communicationHandler = async (req: Request): Promise<Response> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const body: CommunicationParams = await req.json();
    const { destinataire, ton, contenu, signature } = body;

    // ⚠️ CAS SPÉCIAL : Commission disciplinaire (prompt complètement différent)
    if (destinataire.toLowerCase() === "commission disciplinaire") {
      const promptCommission = `Tu es un assistant spécialisé dans l'analyse et la rédaction de bilans disciplinaires en milieu scolaire.

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

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: promptCommission }],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        return new Response('OpenAI API Error', { 
          status: response.status, 
          headers: corsHeaders 
        });
      }

      const openAIData = await response.json();
      const result = openAIData.choices?.[0]?.message?.content ?? '';

      return new Response(JSON.stringify({ 
        content: result,
        usage: openAIData.usage 
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    // Pour tous les autres destinataires, on utilise le prompt standard
    const prompt = `Tu es un enseignant expérimenté qui rédige une communication professionnelle dans le milieu éducatif.

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
   - **Objet/Titre :** Concis et informatif (si pertinent)
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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      return new Response('OpenAI API Error', { 
        status: response.status, 
        headers: corsHeaders 
      });
    }

    const openAIData = await response.json();
    const result = openAIData.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ 
      content: result,
      usage: openAIData.usage 
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error('Communication function error:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
};

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

  // Commission disciplinaire - PROMPT SPÉCIAL
  if (dest === "commission disciplinaire") {
    return `**ATTENTION : Cette communication nécessite un traitement spécial car c'est une présentation de cas pour commission.**

Tu es un assistant expert en bilans éducatifs / disciplinaires scolaires.

Tu reçois un **texte libre** issu des professeurs, vie scolaire, notes diverses, témoignages, etc., relatif à un élève (comportement, travail, événements déclencheurs possibles). Le texte est désordonné, fragmentaire, incomplet.

Ta tâche : produire une **présentation de cas** claire et professionnelle, utilisable devant une commission. Le bilan doit être structuré, argumenté et pragmatique.

**Étapes à respecter :**

1. **Extraction / structuration**  
   - Repère les faits disciplinaires : date, heure, lieu, description, témoins  
   - Détecte un événement déclencheur éventuel  
   - Relève les comportements récurrents (en cours / hors cours)  
   - Recueille les données scolaires : notes, retards, absences, remarques d'enseignants  
   - Recueille les incidents de vie scolaire (cours communs, récréation, couloirs, surveillants)  
   - Relève les éléments de contexte (familial, personnel, changements récents)  
   - Relève les témoignages pertinents  
   - Signale les informations manquantes ou contradictoires  

2. **Présentation structurée pour commission**  
   **I. Contexte & motif du dossier**  
   — Classe, niveau, raison de l'ouverture du dossier  
   **II. Faits & incidents**  
   — Incident(s) déclencheur(s)  
   — Autres comportements disciplinaires / antécédents  
   — Fréquence / chronologie  
   **III. Scolarité & comportement en cours**  
   — Évolution des résultats  
   — Assiduité, retards, participation  
   — Relations avec les enseignants, perturbations  
   **IV. Vie scolaire / incidents hors cours**  
   — Incidents dans les lieux communs  
   — Relations avec pairs / surveillants  
   **V. Analyse raisonnée & hypothèses**  
   — Déclencheurs possibles, moments sensibles  
   — Hypothèses explicatives (stress, conflit, difficulté scolaire)  
   — Limites de l'analyse  
   **VI. Pistes d'action & suggestions**  
   — Actions immédiates (entretien, médiation…)  
   — Accompagnements possibles  
   — Tests / expérimentations (contrat de comportement, suivi périodique)  
   — Indicateurs de suivi + calendrier de réévaluation  
   **VII. Conclusion synthétique**  
   — Points essentiels à retenir  
   — Recommandation pour la commission  

3. **Ton & précautions**  
   - Reste objectif, fondé sur les faits  
   - Formule les hypothèses comme telles, jamais de diagnostics médicaux  
   - Note les incertitudes  
   - Usage d'un style clair, adapté à une présentation devant des collègues`;
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