// supabase/functions/generate/index.ts

// =====================================================
// CONFIGURATION DES MODÈLES IA
// =====================================================

/**
 * Résout la configuration API en fonction du choix de modèle
 */
function resolveAIConfig(aiModel, openaiKey, mistralKey) {
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
 * Parse la réponse de l'IA pour extraire les versions détaillée et synthétique
 */
function parseAIResponse(content) {
  if (!content) return null;

  let parts = content.split(/[\s\*\#\-_]*Version\s+synthétique[\s\*\#\-_:]*/i);

  if (parts.length < 2) {
    parts = content.split(/[\s\*\#\-_]*(?:Synthétique|Résumé|Summary)[\s\*\#\-_:]+/i);
  }

  if (parts.length < 2) {
    parts = content.split(/\n[\s\*\-]{3,}\n/);
  }

  if (parts.length >= 2) {
    let detailed = parts[0];
    let summary = parts[parts.length - 1];

    detailed = detailed.replace(/^[\s\*\#\-_]*(?:Version\s+|Partie\s+)?(?:détaillée|detailed)[\s\*\#\-_:]*/gi, '').trim();

    return { detailed, summary };
  }

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length >= 2) {
    const midPoint = Math.floor(lines.length * 0.7);
    const detailed = lines.slice(0, midPoint).join('\n').trim();
    const summary = lines.slice(midPoint).join('\n').trim();
    return { detailed, summary };
  }

  return null;
}


/**
 * Nettoie le texte de sortie (supprime markdown, compteurs de caractères, labels, etc.)
 */
function cleanOutputText(text) {
  if (!text) return text;

  let cleaned = text.trim();

  cleaned = cleaned.replace(/^[\s\*\#\-_]*(?:Version\s+|Partie\s+)?(?:détaillée|detailed)[\s\*\#\-_:]*/gmi, '');
  cleaned = cleaned.replace(/^[\s\*\#\-_]*(?:Version\s+|Partie\s+)?(?:synthétique|résumé|summary)[\s\*\#\-_:]*/gmi, '');

  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/^#{1,6}\s*/gm, '');
  cleaned = cleaned.replace(/`{1,3}/g, '');

  cleaned = cleaned.replace(/\s*\(?\[?\d+\s*(?:caractères?|car\.?|chars?|mots?|words?)\]?\)?\.?\s*/gi, '');

  cleaned = cleaned.replace(/^.*(?:total|compte|longueur|length|respect).*:\s*\d+.*$/gmi, '');

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  cleaned = cleaned.trim();

  cleaned = cleaned.replace(/^[\s:\-\*]+/, '');

  return cleaned;
}


// =====================================================
// CONSTRUCTION DES PROMPTS OPTIMISÉS
// =====================================================

/**
 * Construit le system prompt compact
 */
function buildSystemPrompt(addressMode, hasPersonalNotes) {
  const addressRules = {
    tutoiement: 'Utilise UNIQUEMENT le TUTOIEMENT (tu/te/ton/ta/tes). "vous", "l\'élève", "il/elle" sont INTERDITS.',
    vouvoiement: 'Utilise UNIQUEMENT le VOUVOIEMENT (vous/votre/vos). "tu", "te", "l\'élève", "il/elle" sont INTERDITS.',
    impersonnel: 'Utilise UNIQUEMENT la FORMULATION IMPERSONNELLE (l\'élève/il/elle/son/sa/ses/prénom). "tu", "vous" sont INTERDITS.'
  };

  let system = `Tu es un professeur expérimenté rédigeant des appréciations de bulletins scolaires.

RÈGLES ABSOLUES :

1. MODE D'ADRESSE : ${addressRules[addressMode] || addressRules.tutoiement}

2. ANTI-HALLUCINATION : Ne mentionne JAMAIS de causes, critères ou compétences absents de la liste évaluée. Liens causaux uniquement avec les critères effectivement fournis. Si aucun critère actionnable n'explique un résultat faible, reste factuel sans inventer.

3. GRAMMAIRE DES NIVEAUX : Transforme toujours les niveaux en adjectifs corrects avant le nom.
Bien→"bon(ne)", Assez bien→"assez bon(ne)", Très bien→"très bon(ne)", Excellent→"excellent(e)".
INTERDIT : "attitude bien", "niveau assez bien", "participation très bien".

4. VOCABULAIRE ADAPTÉ AU TYPE DE COMPÉTENCE :
- Disciplinaire (connaissances, techniques) → "acquis", "maîtrisé", "à consolider", "en voie de maîtrise"
- Comportemental (attitude, écoute, participation) → "satisfaisant", "correct", "à améliorer", "exemplaire" (JAMAIS "en cours d'acquisition" pour du comportement)
- Méthodologique (organisation, rigueur, autonomie) → "efficace", "rigoureux", "structuré", "méthodique"

5. CRITÈRES NON ÉVALUÉS : Ignore totalement tout critère marqué "Non évalué".`;

  if (hasPersonalNotes) {
    system += `

6. NOTES PERSONNELLES DU PROFESSEUR : Les observations personnelles sont PRIORITAIRES. Elles reflètent le vécu réel en classe et DOIVENT transparaître clairement dans les deux versions de l'appréciation. Elles priment sur la simple lecture des critères chiffrés.`;
  }

  return system;
}


/**
 * Construit le user prompt compact
 */
function buildUserPrompt(params) {
  const criteriaText = formatCriteriaForPrompt(params.criteria);
  const summaryMin = Math.floor(params.maxLength * 0.35);
  const summaryMax = Math.floor(params.maxLength * 0.45);

  const toneDescriptions = {
    bienveillant: 'bienveillant et encourageant (valorise les réussites, présente les difficultés comme des leviers de progrès)',
    normal: 'neutre et professionnel (équilibre entre constats factuels et encouragements)',
    severe: 'exigeant et constructif (direct sur les manques, standards élevés, fermeté bienveillante)'
  };

  const addressDescriptions = {
    tutoiement: 'TUTOIEMENT (tu/te/ton/ta/tes)',
    vouvoiement: 'VOUVOIEMENT (vous/votre/vos)',
    impersonnel: 'IMPERSONNEL (l\'élève/il/elle/prénom)'
  };

  // Section notes personnelles — renforcée si elles existent
  let personalNotesSection;
  if (params.personalNotes && params.personalNotes.trim()) {
    personalNotesSection = `
**⚠️ OBSERVATIONS PERSONNELLES DU PROFESSEUR (PRIORITAIRES) :**
${params.personalNotes.trim()}
→ Ces observations reflètent le vécu en classe et DOIVENT être intégrées visiblement dans l'appréciation. Elles apportent un éclairage que les critères seuls ne capturent pas. Assure-toi qu'elles se retrouvent dans la version détaillée ET dans la version synthétique.`;
  } else {
    personalNotesSection = '';
  }

  return `**CONTEXTE :**
Matière : ${params.subject} | Élève : ${params.studentName}
Ton : ${toneDescriptions[params.tone] || toneDescriptions.normal}
Mode d'adresse : ${addressDescriptions[params.addressMode] || addressDescriptions.tutoiement}

**CRITÈRES ÉVALUÉS :**
${criteriaText}
${personalNotesSection}

**CONSIGNES DE RÉDACTION :**
- Personnalise en utilisant le prénom ${params.studentName}
- Critères d'importance "Crucial" = prioritaires dans l'analyse ; "Important" = développés ; "Normal" = mentionnés
- Les critères de RÉSULTATS (notes, performances, moyenne) sont des CONSÉQUENCES : établis le lien causal uniquement avec les critères actionnables évalués (attitude, méthode, etc.). N'invente JAMAIS de cause absente des critères
- Structure version détaillée : bilan positif → points forts → axes d'amélioration → conseils concrets → encouragements
- Structure version synthétique : bilan condensé en 2-3 phrases avec l'essentiel des points forts et axes d'amélioration

**LONGUEURS (caractères espaces compris, NON-NÉGOCIABLE) :**
- Version détaillée : ${params.minLength}-${params.maxLength} caractères
- Version synthétique : ${summaryMin}-${summaryMax} caractères

**FORMAT DE RÉPONSE :**

Version détaillée :
[texte détaillé ici]

Version synthétique :
[texte synthétique ici]`;
}


// =====================================================
// HANDLER PRINCIPAL
// =====================================================

const generateHandler = async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
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
  // SÉCURITÉ : Vérification de l'authentification JWT
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
  console.log(`[generate] Utilisateur authentifié: ${authUser.id}`);

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

    const aiModel = params.aiModel;

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

    console.log(`Modèle IA utilisé: ${aiConfig.model}`);

    // Validation
    const evaluatedCriteriaCount = params.criteria.filter((c) => c.value > 0).length;
    if (evaluatedCriteriaCount === 0) {
      return new Response(JSON.stringify({
        error: 'Veuillez évaluer au moins un critère avant de générer une appréciation.'
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // =====================================================
    // PROMPTS OPTIMISÉS
    // =====================================================
    const hasPersonalNotes = !!(params.personalNotes && params.personalNotes.trim());
    const systemPrompt = buildSystemPrompt(params.addressMode, hasPersonalNotes);
    const prompt = buildUserPrompt(params);

    // Calculer le nombre de tokens de sortie
    let tokenLimit;
    if (aiConfig.model === 'gpt-5-mini') {
      tokenLimit = 4000;
    } else {
      tokenLimit = Math.floor(params.maxLength * 2.5);
    }

    // Construction du body selon le type d'API
    let requestBody;

    if (aiConfig.isResponsesAPI) {
      const fullPrompt = `${systemPrompt}\n\n---\n\n${prompt}`;

      requestBody = {
        model: aiConfig.model,
        input: fullPrompt,
        [aiConfig.tokenParamName]: tokenLimit,
        text: {
          format: { type: "text" }
        },
        reasoning: {
          effort: "low"
        }
      };
    } else {
      requestBody = {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        ...(aiConfig.supportsTemperature && { temperature: 0.2 }),
        [aiConfig.tokenParamName]: tokenLimit
      };
    }

    // Appel API
    const response = await fetch(aiConfig.endpoint, {
      method: "POST",
      headers: aiConfig.headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`${aiConfig.model} API Error:`, error);
      return new Response(`${aiConfig.model} API Error`, {
        status: response.status,
        headers: corsHeaders
      });
    }

    const aiData = await response.json();

    console.log('Réponse API brute:', JSON.stringify(aiData, null, 2));

    // Extraire le contenu selon le type d'API
    let content = null;

    if (aiConfig.isResponsesAPI) {
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
      if (aiData?.choices?.[0]?.message?.content) {
        content = aiData.choices[0].message.content;
      } else if (aiData?.choices?.[0]?.text) {
        content = aiData.choices[0].text;
      }
    }

    if (!content) {
      console.error('Format de réponse non reconnu:', JSON.stringify(aiData, null, 2));
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API. Veuillez réessayer.'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Parser la réponse
    const parsed = parseAIResponse(content);

    if (!parsed) {
      console.error('Format de réponse non reconnu:', content.substring(0, 500));
      return new Response(JSON.stringify({
        error: 'Format de réponse invalide. Veuillez réessayer.'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let { detailed, summary } = parsed;

    // Nettoyer les sorties
    detailed = cleanOutputText(detailed);
    summary = cleanOutputText(summary);

    // VALIDATION ET CORRECTION AUTOMATIQUE DES LONGUEURS
    const detailedLength = detailed.length;
    const summaryLength = summary.length;
    const expectedSummaryMin = Math.floor(params.maxLength * 0.35);
    const expectedSummaryMax = Math.floor(params.maxLength * 0.45);

    if (detailedLength > params.maxLength) {
      console.warn(`Version détaillée trop longue (${detailedLength}/${params.maxLength}), coupe douce`);
      let cut = detailed.substring(0, params.maxLength);
      const lastDot = cut.lastIndexOf('.');
      const lastSemi = cut.lastIndexOf(';');
      const lastExcl = cut.lastIndexOf('!');
      const lastQuest = cut.lastIndexOf('?');
      const cutPoints = [lastDot, lastSemi, lastExcl, lastQuest];
      const bestCut = Math.max(...cutPoints);
      if (bestCut > params.maxLength * 0.6) {
        detailed = cut.substring(0, bestCut + 1).trim();
      } else {
        const lastSpace = cut.lastIndexOf(' ');
        detailed = cut.substring(0, lastSpace).trim();
      }
    }

    if (summaryLength > expectedSummaryMax) {
      console.warn(`Version synthétique trop longue (${summaryLength}/${expectedSummaryMax}), coupe douce finale`);
      let cut = summary.substring(0, expectedSummaryMax).trim();
      const punctuations = ['.', '!', '?', ';'];
      let bestCutIndex = -1;
      punctuations.forEach((p) => {
        const idx = cut.lastIndexOf(p);
        if (idx > bestCutIndex) bestCutIndex = idx;
      });
      if (bestCutIndex !== -1 && bestCutIndex > expectedSummaryMax * 0.5) {
        summary = cut.substring(0, bestCutIndex + 1).trim();
      } else {
        const lastSpace = cut.lastIndexOf(' ');
        const shorter = cut.substring(0, lastSpace).trim();
        let finalCutIndex = -1;
        punctuations.forEach((p) => {
          const idx = shorter.lastIndexOf(p);
          if (idx > finalCutIndex) finalCutIndex = idx;
        });
        if (finalCutIndex !== -1) {
          summary = shorter.substring(0, finalCutIndex + 1).trim();
        } else {
          summary = shorter;
        }
      }
    }

    const usedTokens = aiData.usage?.total_tokens ?? 0;

    console.log('Longueurs finales des appréciations:', {
      model: aiConfig.model,
      detailed: detailed.length,
      summary: summary.length,
      limitesDetaillees: `${params.minLength}-${params.maxLength}`,
      limitesSynthetique: `${expectedSummaryMin}-${expectedSummaryMax}`,
      addressMode: params.addressMode
    });

    return new Response(JSON.stringify({
      detailed,
      summary,
      usedTokens
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Erreur lors de la génération de l\'appréciation:', error);

    if (error.response?.status === 401) {
      return new Response(JSON.stringify({
        error: 'Erreur d\'authentification avec l\'API. Votre clé API semble invalide.'
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (error.response?.status === 429) {
      return new Response(JSON.stringify({
        error: 'Limite de requêtes atteinte. Veuillez réessayer dans quelques minutes.'
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (error.response?.status === 500) {
      return new Response(JSON.stringify({
        error: 'Erreur serveur. Veuillez réessayer plus tard.'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      error: error.message || 'Une erreur est survenue lors de la génération de l\'appréciation. Veuillez réessayer.'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

// =====================================================
// FONCTIONS HELPER
// =====================================================

function formatCriteriaForPrompt(criteria) {
  const evaluatedCriteria = criteria.filter((c) => c.value > 0);
  if (evaluatedCriteria.length === 0) {
    throw new Error('Aucun critère n\'a été évalué. Veuillez évaluer au moins un critère.');
  }
  return evaluatedCriteria.map((c) => `- ${c.name} : ${valueToLabel(c.value)} (Importance: ${importanceToLabel(c.importance)})`).join('\n');
}

function valueToLabel(value) {
  switch (value) {
    case 0: return "Non évalué";
    case 1: return "Très insuffisant";
    case 2: return "Insuffisant";
    case 3: return "Moyen";
    case 4: return "Assez bien";
    case 5: return "Bien";
    case 6: return "Très bien";
    case 7: return "Excellent";
    default: return "Non évalué";
  }
}

function importanceToLabel(importance) {
  switch (importance) {
    case 1: return "Normal";
    case 2: return "Important";
    case 3: return "Crucial";
    default: return "Normal";
  }
}

Deno.serve(generateHandler);
