// supabase/functions/exercises/index.ts
// Edge function pour générer des supports pédagogiques (exercices, fiches, QCM...)

// =====================================================
// CONFIGURATION DES MODÈLES IA
// =====================================================

function resolveAIConfig(aiModel: string | undefined, openaiKey: string, mistralKey: string | undefined) {
  if (!aiModel || aiModel === 'default') {
    return {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      model: 'gpt-4.1-mini',
      isResponsesAPI: false,
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
      isResponsesAPI: true,
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
      isResponsesAPI: false,
    };
  }

  // Fallback
  return {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    model: 'gpt-4.1-mini',
    isResponsesAPI: false,
  };
}

// =====================================================
// HELPERS
// =====================================================

async function createServiceClient() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function deductTokens(
  serviceClient: any,
  userId: string,
  tokensUsed: number
): Promise<void> {
  if (tokensUsed <= 0) return;

  const { data } = await serviceClient
    .from('profiles')
    .select('tokens')
    .eq('user_id', userId)
    .single();

  if (data) {
    await serviceClient
      .from('profiles')
      .update({ tokens: Math.max(0, data.tokens - tokensUsed) })
      .eq('user_id', userId);
  }
}

function cleanOutputText(text: string): string {
  if (!text) return text;
  // Supprimer les blocs de code markdown englobants
  let cleaned = text.trim();
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

// =====================================================
// MAPPING DES TYPES DE SUPPORTS
// =====================================================

const SUPPORT_TYPE_INSTRUCTIONS: Record<string, string> = {
  auto: "Choisis le type de support le plus adapté à cette phase et génère-le.",
  texte_a_trous: "Crée un texte à trous avec les mots manquants remplacés par '________'. Fournis la correction (liste des mots) à la fin.",
  vocabulaire: "Crée une liste de vocabulaire ou mots-clés avec des définitions adaptées au niveau des élèves.",
  qcm: "Crée un QCM ou exercice Vrai/Faux avec au moins 8 questions. Fournis la correction à la fin.",
  exercices: "Crée des exercices d'application variés avec des énoncés clairs et une correction détaillée à la fin.",
  dictee: "Crée une dictée préparée avec : le texte de la dictée, les mots difficiles à préparer en amont, et les points de vigilance orthographique.",
  grille: "Crée une grille d'évaluation ou d'observation sous forme de tableau avec des critères précis et des niveaux de maîtrise.",
  fiche_eleve: "Crée une fiche élève synthétique prête à imprimer avec l'essentiel à retenir, des exemples et éventuellement un petit exercice d'application.",
};

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

interface ExerciseRequest {
  phaseContent: string;
  supportType: string;
  subject: string;
  level: string;
  fullLessonContext: string;
  aiModel?: string;
}

const exercisesHandler = async (req: Request): Promise<Response> => {
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
  console.log(`[exercises] Utilisateur authentifié: ${authUser.id}`);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', {
        status: 500,
        headers: corsHeaders
      });
    }

    const data: ExerciseRequest = await req.json();

    // Vérification du solde de tokens
    const serviceClient = await createServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('tokens')
      .eq('user_id', authUser.id)
      .single();

    if (!profile || profile.tokens < 1000) {
      return new Response(JSON.stringify({
        error: 'Tokens insuffisants. Il vous faut au moins 1 000 tokens pour générer un support.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Résoudre la configuration API
    let aiConfig;
    try {
      aiConfig = resolveAIConfig(data.aiModel, OPENAI_API_KEY, MISTRAL_API_KEY);
    } catch (configError) {
      return new Response(JSON.stringify({
        error: (configError as Error).message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[exercises] Modèle IA utilisé: ${aiConfig.model}, type: ${data.supportType}`);

    // Construction des prompts
    const supportInstruction = SUPPORT_TYPE_INSTRUCTIONS[data.supportType] || SUPPORT_TYPE_INSTRUCTIONS.auto;

    // Tronquer le contexte global si trop long
    const truncatedContext = data.fullLessonContext.length > 2000
      ? data.fullLessonContext.substring(0, 2000) + '\n\n[... contexte tronqué ...]'
      : data.fullLessonContext;

    const systemPrompt = `Tu es un expert en création de supports pédagogiques pour l'enseignement en France.
Tu crées des fiches, exercices et supports prêts à imprimer, adaptés au niveau des élèves.

RÈGLES STRICTES :
- Tout le contenu est en français
- Adapté au niveau scolaire indiqué
- Directement imprimable et utilisable en classe
- Mise en page claire avec des consignes explicites pour les élèves
- Format Markdown propre (titres, listes, tableaux si pertinent)
- Inclure un titre clair pour le support
- Ne pas générer de commentaires ou notes destinés à l'enseignant dans le support élève
- Fournir la correction/les réponses à la fin quand c'est pertinent`;

    const userPrompt = `Génère un support pédagogique pour la phase suivante d'une séance.

**Matière :** ${data.subject}
**Niveau :** ${data.level}

---

**Contenu de la phase :**
${data.phaseContent}

---

**Contexte de la séance complète (pour référence) :**
${truncatedContext}

---

**Type de support demandé :** ${supportInstruction}

Génère maintenant le support, prêt à être imprimé et distribué aux élèves.`;

    // Construction du body
    let requestBody;

    if (aiConfig.isResponsesAPI) {
      const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
      requestBody = {
        model: aiConfig.model,
        input: fullPrompt,
        max_output_tokens: 4000,
        text: {
          format: { type: "text" }
        },
        reasoning: {
          effort: "low"
        }
      };
    } else if (aiConfig.model === 'mistral-medium-latest') {
      const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
      requestBody = {
        model: aiConfig.model,
        messages: [{ role: 'user', content: fullPrompt }],
        temperature: 0.7,
        max_tokens: 4000
      };
    } else {
      requestBody = {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      };
    }

    const response = await fetch(aiConfig.endpoint, {
      method: 'POST',
      headers: aiConfig.headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[exercises] ${aiConfig.model} API error:`, errorText);
      return new Response(JSON.stringify({ error: 'Erreur de l\'API IA' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await response.json();

    let content = null;

    if (aiConfig.isResponsesAPI) {
      if (aiData?.output && Array.isArray(aiData.output)) {
        const messageItem = aiData.output.find((item: any) => item.type === 'message');
        if (messageItem?.content && Array.isArray(messageItem.content)) {
          const outputText = messageItem.content.find((c: any) => c.type === 'output_text');
          if (outputText?.text) {
            content = outputText.text;
          }
        }
      }
      if (!content && aiData?.output_text) {
        content = aiData.output_text;
      }
    } else {
      content = aiData.choices?.[0]?.message?.content;
    }

    if (!content) {
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API IA'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[exercises] Support généré (${content.length} caractères) avec ${aiConfig.model}`);

    const cleanedContent = cleanOutputText(content);

    // Déduction de 1000 tokens
    await deductTokens(serviceClient, authUser.id, 1000);

    return new Response(JSON.stringify({
      content: cleanedContent,
      usage: aiData.usage,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8"
      }
    });

  } catch (error) {
    console.error('[exercises] Error:', error);
    return new Response(JSON.stringify({ error: 'Erreur interne du serveur' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

Deno.serve(exercisesHandler);