// supabase/functions/communication/index.ts
// VERSION AVEC CHOIX DE MODÈLE IA (GPT-4.1-mini par défaut, GPT-5 mini, Mistral Medium)

// =====================================================
// CONFIGURATION DES MODÈLES IA
// =====================================================

function resolveAIConfig(aiModel, openaiKey, mistralKey) {
  // Modèle par défaut : gpt-4.1-mini (comportement actuel inchangé)
  if (!aiModel || aiModel === 'default') {
    return {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      model: 'gpt-4.1-mini',
      tokenParamName: 'max_tokens',
      supportsTemperature: true,
      isResponsesAPI: false
    };
  }

  // GPT-5 mini (OpenAI) - utilise l'API Responses, pas Chat Completions
  if (aiModel === 'gpt-5-mini') {
    return {
      endpoint: 'https://api.openai.com/v1/responses',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      model: 'gpt-5-mini',
      tokenParamName: 'max_output_tokens',
      supportsTemperature: false,
      isResponsesAPI: true
    };
  }

  // Mistral Medium
  if (aiModel === 'mistral-medium') {
    if (!mistralKey) {
      throw new Error('MISTRAL_API_KEY non configurée');
    }
    return {
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${mistralKey}`,
        'Content-Type': 'application/json'
      },
      model: 'mistral-medium-latest',
      tokenParamName: 'max_tokens',
      supportsTemperature: true,
      isResponsesAPI: false
    };
  }

  // Fallback : modèle par défaut si choix non reconnu
  console.warn(`Modèle non reconnu: ${aiModel}, utilisation du modèle par défaut`);
  return {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    model: 'gpt-4.1-mini',
    tokenParamName: 'max_tokens',
    supportsTemperature: true,
    isResponsesAPI: false
  };
}

/**
 * Nettoie le texte de sortie (supprime markdown résiduel si nécessaire)
 */
function cleanOutputText(text) {
  if (!text) return text;
  
  let cleaned = text.trim();
  
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

/**
 * Appelle l'API IA et retourne le contenu
 */
async function callAI(aiConfig, prompt, tokenLimit = 2000) {
  let requestBody;

  if (aiConfig.isResponsesAPI) {
    // API Responses (GPT-5 mini)
    requestBody = {
      model: aiConfig.model,
      input: prompt,
      [aiConfig.tokenParamName]: tokenLimit,
      text: {
        format: { type: "text" }
      },
      reasoning: {
        effort: "low"
      }
    };
  } else {
    // API Chat Completions (GPT-4.1-mini, Mistral)
    requestBody = {
      model: aiConfig.model,
      messages: [{ role: 'user', content: prompt }],
      ...(aiConfig.supportsTemperature && { temperature: 0.7 }),
      [aiConfig.tokenParamName]: tokenLimit
    };
  }

  const response = await fetch(aiConfig.endpoint, {
    method: 'POST',
    headers: aiConfig.headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[communication] ${aiConfig.model} API error:`, errorText);
    throw new Error(`API Error: ${response.status}`);
  }

  const aiData = await response.json();

  // Extraire le contenu selon le type d'API
  let content = null;

  if (aiConfig.isResponsesAPI) {
    // API Responses (GPT-5 mini)
    if (aiData?.output && Array.isArray(aiData.output)) {
      const messageItem = aiData.output.find(item => item.type === 'message');
      if (messageItem?.content && Array.isArray(messageItem.content)) {
        const outputText = messageItem.content.find(c => c.type === 'output_text');
        if (outputText?.text) {
          content = outputText.text;
        }
      }
    }
    if (!content && aiData?.output_text) {
      content = aiData.output_text;
    }
  } else {
    // API Chat Completions
    if (aiData?.choices?.[0]?.message?.content) {
      content = aiData.choices[0].message.content;
    } else if (aiData?.choices?.[0]?.text) {
      content = aiData.choices[0].text;
    }
  }

  return { content, usage: aiData.usage };
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
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const body: CommunicationParams = await req.json();
    const { destinataire, ton, contenu, signature, aiModel } = body;

    // Résoudre la configuration API
    let aiConfig;
    try {
      aiConfig = resolveAIConfig(aiModel, OPENAI_API_KEY, MISTRAL_API_KEY);
    } catch (configError) {
      return new Response(JSON.stringify({
        error: configError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[communication] Modèle IA utilisé: ${aiConfig.model}`);

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

      try {
        // Token limit plus élevé pour les bilans de commission (documents longs)
        const tokenLimit = aiConfig.model === 'gpt-5-mini' ? 4000 : 3000;
        const { content, usage } = await callAI(aiConfig, promptCommission, tokenLimit);

        if (!content) {
          return new Response(JSON.stringify({
            error: 'Réponse invalide de l\'API. Veuillez réessayer.'
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const cleanedContent = cleanOutputText(content);

        return new Response(JSON.stringify({ 
          content: cleanedContent,
          usage 
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      } catch (error) {
        console.error('[communication] Commission API error:', error);
        return new Response('API Error', { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // =====================================================
    // CAS STANDARD : Tous les autres destinataires
    // =====================================================

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

    try {
      const tokenLimit = aiConfig.model === 'gpt-5-mini' ? 4000 : 2000;
      const { content, usage } = await callAI(aiConfig, prompt, tokenLimit);

      if (!content) {
        return new Response(JSON.stringify({
          error: 'Réponse invalide de l\'API. Veuillez réessayer.'
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const cleanedContent = cleanOutputText(content);

      return new Response(JSON.stringify({ 
        content: cleanedContent,
        usage 
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } catch (error) {
      console.error('[communication] Standard API error:', error);
      return new Response('API Error', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

  } catch (error) {
    console.error('[communication] Error:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
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
