// supabase/functions/_shared/ai.ts
// Résolution du modèle IA et appel à l'API — logique identique aux copies
// historiques des handlers (communication, reply…), factorisée.

export interface AIConfig {
  endpoint: string;
  headers: Record<string, string>;
  model: string;
  tokenParamName: string;
  supportsTemperature: boolean;
  isResponsesAPI: boolean;
}

/** Erreur API IA, porteuse du statut HTTP amont. */
export class AIApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AIApiError';
    this.status = status;
  }
}

/**
 * Résout la configuration API selon le choix de modèle de l'utilisateur.
 * `defaultModel` permet de préserver le défaut propre à chaque fonction
 * (communication/reply : gpt-4.1-mini ; generate : gpt-4o-mini…).
 */
export function resolveAIConfig(
  aiModel: string | undefined,
  openaiKey: string,
  mistralKey: string | undefined,
  defaultModel = 'gpt-4.1-mini'
): AIConfig {
  const defaultConfig: AIConfig = {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    model: defaultModel,
    tokenParamName: 'max_tokens',
    supportsTemperature: true,
    isResponsesAPI: false
  };

  // Modèle par défaut : comportement actuel inchangé
  if (!aiModel || aiModel === 'default') {
    return defaultConfig;
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
  return defaultConfig;
}

export interface AIResult {
  content: string | null;
  usage: Record<string, unknown> | undefined;
}

/**
 * Appelle l'API IA et retourne le contenu + l'usage.
 * Lance une AIApiError (avec le statut HTTP amont) en cas d'échec.
 * opts.temperature : optionnelle, 0.7 par défaut (comportement historique) —
 * les tâches d'extraction structurée utilisent une valeur basse.
 */
export async function callAI(
  aiConfig: AIConfig,
  prompt: string,
  tokenLimit = 2000,
  logTag = 'ai',
  opts?: { temperature?: number }
): Promise<AIResult> {
  let requestBody: Record<string, unknown>;

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
      ...(aiConfig.supportsTemperature && { temperature: opts?.temperature ?? 0.7 }),
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
    console.error(`[${logTag}] ${aiConfig.model} API error:`, errorText);
    throw new AIApiError(response.status, `API Error: ${response.status}`);
  }

  const aiData = await response.json();

  // Extraire le contenu selon le type d'API
  let content: string | null = null;

  if (aiConfig.isResponsesAPI) {
    // API Responses (GPT-5 mini)
    if (aiData?.output && Array.isArray(aiData.output)) {
      const messageItem = aiData.output.find((item: { type: string }) => item.type === 'message');
      if (messageItem?.content && Array.isArray(messageItem.content)) {
        const outputText = messageItem.content.find((c: { type: string }) => c.type === 'output_text');
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

/**
 * Coût en tokens d'un appel : usage réel si disponible, sinon estimation
 * (~4 caractères par token, même règle que le guide utilisateur).
 */
export function computeTokenCost(
  usage: Record<string, unknown> | undefined,
  prompt: string,
  content: string
): number {
  const total = usage?.total_tokens;
  if (typeof total === 'number' && total > 0) {
    return total;
  }
  return Math.ceil((prompt.length + content.length) / 4);
}
