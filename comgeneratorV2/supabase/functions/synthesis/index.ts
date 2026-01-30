// supabase/functions/synthesis/index.ts
// VERSION AVEC CHOIX DE MODÈLE IA (GPT-4o-mini, GPT-5 mini, Mistral Medium)

// =====================================================
// CONFIGURATION DES MODÈLES IA
// =====================================================

function resolveAIConfig(aiModel, openaiKey, mistralKey) {
  // Modèle par défaut : gpt-4o-mini (comportement actuel inchangé)
  if (!aiModel || aiModel === 'default') {
    return {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      model: 'gpt-4o-mini',
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
    model: 'gpt-4o-mini',
    tokenParamName: 'max_tokens',
    supportsTemperature: true,
    isResponsesAPI: false
  };
}

/**
 * Nettoie le texte de sortie (supprime markdown, etc.)
 */
function cleanOutputText(text) {
  if (!text) return text;
  
  let cleaned = text.trim();
  
  // Supprimer les balises markdown
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/^#{1,6}\s*/gm, '');
  cleaned = cleaned.replace(/`{1,3}/g, '');
  
  // Supprimer les mentions de nombre de caractères
  cleaned = cleaned.replace(/\s*\(?\[?\d+\s*(?:caractères?|car\.?|chars?|mots?|words?)\]?\)?\.?\s*/gi, '');
  
  // Supprimer les lignes de comptage
  cleaned = cleaned.replace(/^.*(?:total|compte|longueur|length|respect).*:\s*\d+.*$/gmi, '');
  
  // Supprimer les lignes vides multiples
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  cleaned = cleaned.trim();
  
  // Supprimer ponctuation orpheline au début
  cleaned = cleaned.replace(/^[\s:\-\*]+/, '');
  
  return cleaned;
}

/**
 * Renforce l'instruction de limite de caractères pour Mistral
 */
function buildPromptWithCharLimit(basePrompt, maxChars, model) {
  if (model === 'mistral-medium-latest') {
    const reinforcement = `⚠️ CONTRAINTE CRITIQUE DE LONGUEUR ⚠️
Ta réponse doit faire MAXIMUM ${maxChars} caractères (espaces compris).
Cette limite est ABSOLUE et NON-NÉGOCIABLE. 
Compte tes caractères AVANT de finaliser. Sois concis et va à l'essentiel.
Si tu dépasses, ta réponse sera inutilisable.

`;
    return reinforcement + basePrompt;
  }
  
  return basePrompt;
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

const synthesisHandler = async (req) => {
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

    const params = await req.json();
    const { 
      extractedText, 
      maxChars,
      tone = 'neutre',
      outputType = 'complet',
      aiModel
    } = params;

    if (!extractedText) {
      return new Response(JSON.stringify({
        error: 'Aucun texte détecté dans votre capture d\'écran.'
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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

    console.log(`[synthesis] Modèle IA utilisé: ${aiConfig.model}`);

    // Construire le prompt de base
    const toneInstructions = getToneInstructions(tone);
    const basePrompt = outputType === 'essentiel' 
      ? buildEssentialPrompt(extractedText, maxChars, toneInstructions)
      : buildCompletePrompt(extractedText, maxChars, toneInstructions);

    // Adapter le prompt selon le modèle (renforcement pour Mistral)
    const prompt = buildPromptWithCharLimit(basePrompt, maxChars, aiConfig.model);

    // ✅ Token limit adapté selon le modèle ET la demande utilisateur
    let tokenLimit;
    if (aiConfig.model === 'gpt-5-mini') {
      tokenLimit = 4000; // Contrainte API Responses
    } else if (aiConfig.model === 'mistral-medium-latest') {
      // Mistral est bavard : on réduit la marge pour forcer le respect de maxChars
      tokenLimit = Math.ceil(maxChars * 1.3);
    } else {
      tokenLimit = Math.ceil(maxChars * 2);
    }

    // ✅ Construction du body selon le type d'API
    let requestBody;

    if (aiConfig.isResponsesAPI) {
      // API Responses (GPT-5 mini) - format différent
      requestBody = {
        model: aiConfig.model,
        input: prompt,
        [aiConfig.tokenParamName]: tokenLimit,
        // ✅ OBLIGATOIRE pour GPT-5 mini
        text: {
          format: { type: "text" }
        },
        reasoning: {
          effort: "low"
        }
      };
    } else {
      // API Chat Completions (GPT-4, Mistral) - format standard
      requestBody = {
        model: aiConfig.model,
        messages: [{ role: 'user', content: prompt }],
        ...(aiConfig.supportsTemperature && { temperature: 0.7 }),
        [aiConfig.tokenParamName]: tokenLimit
      };
    }

    // Appel API
    const response = await fetch(aiConfig.endpoint, {
      method: 'POST',
      headers: aiConfig.headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[synthesis] ${aiConfig.model} API error:`, errorText);
      return new Response(JSON.stringify({
        error: 'Erreur lors de la génération de la synthèse'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const aiData = await response.json();
    
    // ✅ Log pour debug
    console.log('[synthesis] Réponse API brute:', JSON.stringify(aiData, null, 2));

    // ✅ Extraire le contenu selon le type d'API
    let content = null;
    
    if (aiConfig.isResponsesAPI) {
      // API Responses (GPT-5 mini) - format avec tableau output
      if (aiData?.output && Array.isArray(aiData.output)) {
        const messageItem = aiData.output.find(item => item.type === 'message');
        if (messageItem?.content && Array.isArray(messageItem.content)) {
          const outputText = messageItem.content.find(c => c.type === 'output_text');
          if (outputText?.text) {
            content = outputText.text;
          }
        }
      }
      // Fallback
      if (!content && aiData?.output_text) {
        content = aiData.output_text;
      }
    } else {
      // API Chat Completions (GPT-4, Mistral) - format standard
      if (aiData?.choices?.[0]?.message?.content) {
        content = aiData.choices[0].message.content;
      } else if (aiData?.choices?.[0]?.text) {
        content = aiData.choices[0].text;
      }
    }
    
    if (!content) {
      console.error('[synthesis] Format de réponse non reconnu:', JSON.stringify(aiData, null, 2));
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API. Veuillez réessayer.'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ✅ Nettoyer le contenu
    content = cleanOutputText(content);

    // Log de la longueur finale
    console.log(`[synthesis] Longueur finale: ${content.length}/${maxChars} caractères (modèle: ${aiConfig.model})`);
        // ============================================
    // LOGGING POUR DASHBOARD ADMIN (ajout non-bloquant)
    // ============================================
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        // Récupérer user_id depuis le token d'auth si présent
        let userId = null;
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
          try {
            const token = authHeader.replace('Bearer ', '');
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.sub;
          } catch {}
        }
        
        // Log non-bloquant
        fetch(`${SUPABASE_URL}/rest/v1/edge_function_logs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            function_name: 'synthesis',
            user_id: userId,
            metadata: { 
              model: aiConfig.model,
              output_length: content?.length || 0,
              max_chars: maxChars,
              tone,
              output_type: outputType
            },
            tokens_used: aiData.usage?.total_tokens || 0,
            success: true
          })
        }).catch(() => {}); // Ignorer les erreurs de logging
      }
    } catch {}
    // FIN LOGGING


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
    console.error('[synthesis] Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Une erreur est survenue. Veuillez réessayer.'
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

// =====================================================
// FONCTIONS HELPER - INSTRUCTIONS DE TON
// =====================================================

function getToneInstructions(tone) {
  switch (tone) {
    case 'encourageant':
      return `**TON ENCOURAGEANT :**
   - Mets en avant les points positifs et les réussites de l'élève
   - Valorise les efforts et les progrès, même modestes
   - Présente les axes d'amélioration comme des opportunités de développement
   - Utilise un vocabulaire stimulant et motivant
   - Termine sur une note positive et constructive`;

    case 'analytique':
      return `**TON ANALYTIQUE :**
   - Adopte une approche détaillée et approfondie
   - Établis des liens de causalité entre les observations
   - Identifie les patterns et tendances dans les commentaires
   - Propose une analyse nuancée des forces et faiblesses
   - Fournis des explications sur les difficultés rencontrées
   - Suggère des pistes concrètes d'amélioration avec justifications`;

    case 'neutre':
    default:
      return `**TON NEUTRE :**
   - Adopte un ton factuel et objectif
   - Présente les observations de manière équilibrée
   - Évite les jugements de valeur excessifs
   - Reste professionnel et respectueux`;
  }
}

// =====================================================
// FONCTIONS HELPER - PROMPTS
// =====================================================

function buildCompletePrompt(extractedText, maxChars, toneInstructions) {
  return `Tu es un expert en pédagogie et en évaluation scolaire, spécialisé dans la rédaction d'appréciations générales de bulletin.

**CONTEXTE ET MISSION :**
Tu dois analyser les commentaires de plusieurs professeurs extraits d'un bulletin scolaire et rédiger une appréciation générale cohérente et professionnelle qui sera placée en pied de bulletin.

**COMMENTAIRES À ANALYSER :**
"""
${extractedText}
"""

**INSTRUCTIONS D'ANALYSE :**

1. **Identification des tendances pédagogiques :**
   - Repère les points forts récurrents dans les différentes matières
   - Identifie les difficultés ou axes d'amélioration mentionnés
   - Détecte les compétences transversales (autonomie, participation, méthode, etc.)
   - Évalue l'évolution ou la progression de l'élève si mentionnée

2. **Analyse des domaines de compétences :**
   - **Savoirs disciplinaires :** Connaissances et compétences spécifiques aux matières
   - **Savoir-faire méthodologiques :** Organisation, rigueur, présentation des travaux
   - **Savoir-être comportementaux :** Participation, attitude, relations avec autrui
   - **Compétences transversales :** Raisonnement, créativité, esprit critique

3. **Cohérence pédagogique :**
   - Identifie les convergences entre les appréciations des différents professeurs
   - Repère les spécificités selon les types de matières (littéraires, scientifiques, artistiques)
   - Détecte les compétences qui se confirment ou s'infirment selon les disciplines

**INSTRUCTIONS DE RÉDACTION :**

4. **Structure de l'appréciation générale :**
   - **Bilan global :** Vue d'ensemble du trimestre/semestre
   - **Points forts :** Compétences confirmées et réussites significatives
   - **Axes d'amélioration :** Difficultés identifiées et besoins repérés
   - **Recommandations :** Conseils concrets et encouragements

5. **Style et forme :**
   - Langage professionnel adapté à un bulletin officiel
   - Phrases construites et fluides
   - Vocabulaire précis et pédagogique
   - Évite les généralités vagues
   - Reste concret et factuel

6. ${toneInstructions}

7. **Contraintes impératives :**
   - Longueur maximale STRICTE : ${maxChars} caractères
   - Rédige une appréciation cohérente qui synthétise l'ensemble des commentaires
   - Ne mentionne JAMAIS les noms des professeurs
   - Reste dans un cadre pédagogique bienveillant même si les commentaires sont négatifs
   - Assure-toi que ton texte soit directement utilisable dans un bulletin officiel

**ACTION REQUISE :**
Rédige maintenant l'appréciation générale en respectant SCRUPULEUSEMENT ces instructions, notamment la limite de ${maxChars} caractères.`;
}

function buildEssentialPrompt(extractedText, maxChars, toneInstructions) {
  return `Tu es un expert en pédagogie et en évaluation scolaire, spécialisé dans la rédaction d'appréciations générales de bulletin.

**CONTEXTE ET MISSION :**
Tu dois analyser les commentaires de plusieurs professeurs extraits d'un bulletin scolaire et identifier LA TENDANCE GLOBALE DOMINANTE qui caractérise le bilan de l'élève, puis rédiger une synthèse concise centrée sur cette vision d'ensemble.

**COMMENTAIRES À ANALYSER :**
"""
${extractedText}
"""

**INSTRUCTIONS D'ANALYSE CRITIQUE :**

1. **Identification de la tendance GLOBALE dominante :**
   
   ⚠️ **ATTENTION PRIORITAIRE :** Évalue d'abord la VISION D'ENSEMBLE :
   - Combien de matières/commentaires sont POSITIFS vs NÉGATIFS ?
   - Quelle est la TONALITÉ GÉNÉRALE du bulletin ?
   - Y a-t-il des mentions explicites (félicitations, encouragements, mises en garde) ?
   
   **Hiérarchie d'importance :**
   1. **Si > 70% des commentaires sont positifs** → La tendance dominante est LA RÉUSSITE GLOBALE
   2. **Si > 70% des commentaires sont négatifs** → La tendance dominante est LES DIFFICULTÉS GÉNÉRALISÉES
   3. **Si équilibré (40-60%)** → Identifier LE POINT TRANSVERSAL le plus significatif
   
   ⚠️ **NE PAS se focaliser sur 2-3 points mineurs négatifs si l'ensemble est excellent**
   ⚠️ **NE PAS se focaliser sur 2-3 points mineurs positifs si l'ensemble est faible**

2. **Exemples de tendances dominantes correctes :**
   - **Bulletin très positif** : "Trimestre excellent avec félicitations" / "Résultats très satisfaisants"
   - **Bulletin positif** : "Bon trimestre avec réussites marquées"
   - **Bulletin mitigé** : "Résultats contrastés nécessitant régularité" / "Lacunes méthodologiques transversales"
   - **Bulletin faible** : "Difficultés généralisées nécessitant soutien" / "Manque de travail et d'investissement"

3. **Construction de la synthèse essentielle :**
   - **Point principal :** Énonce la tendance GLOBALE dominante
   - **Constat :** Illustre avec 1-2 éléments concrets
   - **Perspective :** Encouragement ou conseil adapté au niveau global

4. ${toneInstructions}

**CONTRAINTES IMPÉRATIVES :**
- Longueur maximale STRICTE : ${maxChars} caractères
- Focus sur la VISION D'ENSEMBLE, pas sur des détails isolés
- Si le bulletin est globalement positif, la synthèse DOIT être positive
- Si le bulletin est globalement négatif, la synthèse DOIT être constructive mais lucide
- Reste professionnel et utilisable dans un bulletin officiel

**STRUCTURE ATTENDUE :**
[Bilan global en une phrase] + [Illustration concrète] + [Perspective/Conseil]

**ACTION REQUISE :**
Rédige maintenant cette synthèse essentielle en respectant SCRUPULEUSEMENT la limite de ${maxChars} caractères.`;
}

Deno.serve(synthesisHandler);