// supabase/functions/reply/index.ts
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

  // =====================================================
  // ✅ SÉCURITÉ : Vérification de l'authentification JWT
  // =====================================================
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Configuration serveur manquante' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseServiceKey
    }
  });

  if (!userResponse.ok) {
    return new Response(JSON.stringify({ error: 'Token invalide ou expiré' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authUser = await userResponse.json();
  console.log(`[reply] Utilisateur authentifié: ${authUser.id}`);
  // =====================================================
  // FIN VÉRIFICATION JWT
  // =====================================================

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const body: ReplyParams = await req.json();
    const { message, ton, objectifs, signature, aiModel } = body;

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

    // Construction du body selon le type d'API
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
      console.error(`[reply] ${aiConfig.model} API error:`, errorText);
      return new Response(JSON.stringify({
        error: 'Erreur lors de la génération de la réponse'
      }), { 
        status: response.status, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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

    if (!content) {
      console.error('[reply] Format de réponse non reconnu:', JSON.stringify(aiData, null, 2));
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API. Veuillez réessayer.'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ✅ Nettoyer le contenu (supprime les méta-commentaires Mistral)
    content = cleanOutputText(content);

    console.log(`[reply] Réponse générée (${content.length} caractères) avec ${aiConfig.model}`);

    return new Response(JSON.stringify({ 
      content,
      usage: aiData.usage 
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error('[reply] Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Une erreur est survenue. Veuillez réessayer.'
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
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
