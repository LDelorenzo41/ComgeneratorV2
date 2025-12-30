// supabase/functions/scenario/index.ts
// Edge Function pour la génération de scénarios pédagogiques
// Avec support optionnel du RAG (Retrieval-Augmented Generation)
// et des documents supports uploadés

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

// ============================================================================
// TYPES
// ============================================================================

interface ScenarioRequest {
  matiere: string;
  niveau: string;
  theme: string;
  pointDepart: string;
  attendus: string;
  nombreSeances: number;
  dureeSeance: number;
  useRag: boolean;
  documentsContent?: string;      // Contenu extrait des documents uploadés
  documentNames?: string[];       // Noms des fichiers uploadés
}

interface RagChunk {
  id: string;
  content: string;
  documentTitle: string;
  score: number;
}

interface RagSource {
  document_name: string;
  chunk_content: string;
  similarity: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  chatModel: 'gpt-4.1-mini',
  embeddingModel: 'text-embedding-3-large',
  embeddingDimensions: 1536,
  ragTopK: 6,
  ragSimilarityThreshold: 0.35,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// PROMPT SYSTÈME PROFESSIONNEL
// ============================================================================

const SYSTEM_PROMPT = `Tu es un conseiller pédagogique expert en ingénierie de formation et en didactique. Tu conçois des scénarios pédagogiques de haute qualité selon les principes de la pédagogie active, de l'alignement constructif (Biggs) et de la différenciation pédagogique.

**PRINCIPES DE CONCEPTION :**

1. **Progression spiralaire** : Chaque séance reprend, consolide et approfondit les acquis précédents selon une complexification progressive
2. **Taxonomie de Bloom révisée** : Les objectifs suivent une progression cognitive claire (mémoriser → comprendre → appliquer → analyser → évaluer → créer)
3. **Différenciation** : Chaque séance intègre des pistes d'adaptation pour les élèves en difficulté (étayage, simplification) et en avance (approfondissement, défis)
4. **Évaluation formative intégrée** : Des points de vérification des acquis sont prévus dans chaque séance
5. **Engagement actif** : Privilégier les situations-problèmes, manipulations, travaux collaboratifs et productions

**STRUCTURE DE CHAQUE SÉANCE :**
Pour chaque séance, les exemples d'activités doivent être DÉTAILLÉS et inclure :
• Phase d'accroche/mise en situation (5-10 min) : situation déclenchante, rappel des acquis
• Phase de recherche/manipulation (durée variable) : activité principale, travail en groupe ou individuel
• Phase de structuration/institutionnalisation : trace écrite, synthèse collective
• Phase d'entraînement/application : exercices d'application
• Phase de bilan/métacognition : ce qu'on a appris, difficultés rencontrées

**EXIGENCES DE QUALITÉ :**
- Les objectifs doivent être opérationnels avec des verbes d'action observables et mesurables
- Les attendus doivent être des critères de réussite explicites et évaluables
- Les prérequis doivent être précis et vérifiables
- Les exemples d'activités doivent être concrets, réalistes et directement applicables en classe
- Intégrer les modalités de travail (individuel, binôme, groupe, collectif)
- Mentionner le matériel et les supports nécessaires

**FORMAT DE SORTIE :**
Tu dois OBLIGATOIREMENT produire un tableau markdown avec EXACTEMENT ces 5 colonnes :
| Séance | Objectifs | Attendus | Prérequis | Exemples d'activités |

Chaque ligne doit être substantielle et professionnelle. Ne fais PAS de réponses courtes ou superficielles.`;

// ============================================================================
// HELPERS - SUPABASE CLIENT
// ============================================================================

async function createServiceClient() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function createSupabaseClient(authHeader: string) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

// ============================================================================
// HELPERS - EMBEDDING
// ============================================================================

async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.embeddingModel,
      input: text,
      dimensions: CONFIG.embeddingDimensions,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erreur embedding: ${await response.text()}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ============================================================================
// HELPERS - RAG SEARCH
// ============================================================================

async function searchRagChunks(
  supabase: any,
  userId: string,
  embedding: number[],
  topK: number
): Promise<RagChunk[]> {
  try {
    const { data, error } = await supabase.rpc('match_rag_chunks', {
      p_query_embedding: `[${embedding.join(',')}]`,
      p_similarity_threshold: CONFIG.ragSimilarityThreshold,
      p_match_count: topK,
      p_user_id: userId,
      p_document_id: null,
    });

    if (error) {
      console.error('[scenario] RAG search error:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      content: item.content,
      documentTitle: item.document_title,
      score: item.similarity,
    }));
  } catch (err) {
    console.error('[scenario] RAG search exception:', err);
    return [];
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

const scenarioHandler = async (req: Request): Promise<Response> => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', { status: 500, headers: corsHeaders });
    }

    // Authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = await createSupabaseClient(authHeader);
    const serviceClient = await createServiceClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parsing de la requête
    const data: ScenarioRequest = await req.json();
    const { documentsContent, documentNames } = data;

    console.log(`[scenario] Generating for: ${data.matiere} - ${data.niveau}`);
    console.log(`[scenario] useRag: ${data.useRag}`);
    console.log(`[scenario] Documents fournis: ${documentNames?.length || 0}`);

    // ========================================================================
    // SECTION RAG (optionnelle)
    // ========================================================================
    
    let ragContext = '';
    let ragSources: RagSource[] = [];
    
    if (data.useRag) {
      console.log('[scenario] RAG mode enabled, searching documents...');
      
      // Construire une requête de recherche pertinente
      const searchQuery = `${data.matiere} ${data.niveau} ${data.theme} ${data.attendus} programmes officiels`;
      
      // Créer l'embedding
      const embedding = await createEmbedding(searchQuery, OPENAI_API_KEY);
      
      // Rechercher dans le RAG
      const chunks = await searchRagChunks(
        serviceClient,
        user.id,
        embedding,
        CONFIG.ragTopK
      );
      
      if (chunks.length > 0) {
        console.log(`[scenario] Found ${chunks.length} relevant chunks`);
        
        // Capturer les sources pour les retourner au client
        ragSources = chunks.map((chunk: RagChunk) => ({
          document_name: chunk.documentTitle || 'Document officiel',
          chunk_content: chunk.content,
          similarity: chunk.score,
        }));
        
        ragContext = `

📚 **CONTEXTE DOCUMENTAIRE (Ressources officielles)**

Les informations suivantes proviennent des textes officiels et ressources pédagogiques :

${chunks.map((chunk, i) => `
--- Source ${i + 1} : ${chunk.documentTitle} ---
${chunk.content}
`).join('\n')}

**Consigne importante :** Utilise ces ressources officielles pour :
- Aligner les objectifs avec les programmes en vigueur
- Utiliser le vocabulaire institutionnel approprié
- Respecter les attendus de fin de cycle mentionnés
- Intégrer les compétences du socle commun si pertinent
`;
      } else {
        console.log('[scenario] No relevant RAG chunks found');
      }
    }

    // ========================================================================
    // SECTION DOCUMENTS SUPPORTS (optionnelle)
    // ========================================================================
    
    let documentsContext = '';
    
    if (documentsContent && documentsContent.trim()) {
      console.log(`[scenario] Documents supports fournis: ${documentNames?.join(', ') || 'sans nom'}`);
      
      documentsContext = `

📎 **DOCUMENTS SUPPORTS FOURNIS PAR L'ENSEIGNANT**

Ces documents doivent être INTÉGRÉS dans le scénario pédagogique (textes à étudier, exercices à utiliser, ressources à exploiter) :

${documentsContent}

${documentNames && documentNames.length > 0 ? `Fichiers fournis : ${documentNames.join(', ')}` : ''}

**Consigne importante :** Utilise ces documents comme supports concrets dans les exemples de situations. Référence-les explicitement dans le tableau lorsque c'est pertinent.
`;
    }

    // ========================================================================
    // CONSTRUCTION DU PROMPT UTILISATEUR
    // ========================================================================

    const userPrompt = `**DEMANDE DE SCÉNARIO PÉDAGOGIQUE**

**Matière :** ${data.matiere}
**Niveau :** ${data.niveau}
**Thème / Titre de la séquence :** ${data.theme}
**Nombre de séances :** ${data.nombreSeances}
**Durée par séance :** ${data.dureeSeance} minutes

**Point de départ / Situation initiale :**
${data.pointDepart || 'Non précisé - à définir selon le niveau habituel des élèves'}

**Attendus de fin de séquence :**
${data.attendus}
${ragContext}
${documentsContext}

**CONSIGNES SPÉCIFIQUES :**
1. Crée un tableau de ${data.nombreSeances} séances cohérentes et progressives
2. Chaque séance de ${data.dureeSeance} minutes doit être réaliste en termes de timing
3. Les activités doivent être variées (individuel, groupe, collectif)
4. Intègre systématiquement les phases d'une séance efficace (accroche, recherche, structuration, entraînement, bilan)
5. ${documentsContent ? 'IMPORTANT : Intègre les documents supports fournis dans les activités proposées' : 'Propose des supports et ressources adaptés'}
6. ${data.useRag ? 'Appuie-toi sur les ressources institutionnelles fournies pour garantir la conformité aux programmes' : 'Veille à la cohérence avec les programmes en vigueur'}

Génère maintenant le tableau complet du scénario pédagogique :`;

    // ========================================================================
    // APPEL OPENAI AVEC SYSTEM PROMPT
    // ========================================================================

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.chatModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      console.error('[scenario] OpenAI API error:', await response.text());
      return new Response('OpenAI API Error', { status: response.status, headers: corsHeaders });
    }

    const openAIData = await response.json();
    const content = openAIData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API OpenAI'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[scenario] Generated ${content.length} chars`);
    console.log(`[scenario] RAG sources returned: ${ragSources.length}`);

    return new Response(JSON.stringify({
      content,
      usage: openAIData.usage,
      sources: ragSources.length > 0 ? ragSources : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[scenario] Error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
};

Deno.serve(scenarioHandler);

