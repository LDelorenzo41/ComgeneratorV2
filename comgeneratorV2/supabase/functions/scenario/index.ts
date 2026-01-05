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
  ragTopK: 8,                    // Augmenté pour plus de contexte
  ragSimilarityThreshold: 0.40,  // Seuil relevé pour plus de pertinence
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// MAPPING NIVEAU → CYCLE (pour recherche RAG optimisée)
// ============================================================================

function getCycleFromNiveau(niveau: string): { cycle: string; cycleNum: number } {
  const niveauLower = niveau.toLowerCase().trim();
  
  // Cycle 1 : Maternelle
  if (niveauLower.includes('ps') || niveauLower.includes('ms') || niveauLower.includes('gs') ||
      niveauLower.includes('petite section') || niveauLower.includes('moyenne section') || 
      niveauLower.includes('grande section') || niveauLower.includes('maternelle')) {
    return { cycle: 'cycle 1', cycleNum: 1 };
  }
  
  // Cycle 2 : CP, CE1, CE2
  if (niveauLower.includes('cp') || niveauLower.includes('ce1') || niveauLower.includes('ce2') ||
      niveauLower.includes('cours préparatoire') || niveauLower.includes('cours élémentaire')) {
    return { cycle: 'cycle 2', cycleNum: 2 };
  }
  
  // Cycle 3 : CM1, CM2, 6ème
  if (niveauLower.includes('cm1') || niveauLower.includes('cm2') || niveauLower.includes('6') ||
      niveauLower.includes('sixième') || niveauLower.includes('cours moyen')) {
    return { cycle: 'cycle 3', cycleNum: 3 };
  }
  
  // Cycle 4 : 5ème, 4ème, 3ème
  if (niveauLower.includes('5') || niveauLower.includes('4') || niveauLower.includes('3') ||
      niveauLower.includes('cinquième') || niveauLower.includes('quatrième') || 
      niveauLower.includes('troisième') || niveauLower.includes('collège')) {
    return { cycle: 'cycle 4', cycleNum: 4 };
  }
  
  // Lycée
  if (niveauLower.includes('seconde') || niveauLower.includes('2nde') || 
      niveauLower.includes('première') || niveauLower.includes('1ère') ||
      niveauLower.includes('terminale') || niveauLower.includes('tle') ||
      niveauLower.includes('lycée')) {
    return { cycle: 'lycée', cycleNum: 5 };
  }
  
  return { cycle: 'non déterminé', cycleNum: 0 };
}

// ============================================================================
// PROMPT SYSTÈME EXPERT EN DIDACTIQUE
// ============================================================================

const SYSTEM_PROMPT = `Tu es un conseiller pédagogique expert en ingénierie de formation, en didactique des disciplines et en sciences de l'éducation. Tu maîtrises les travaux de référence (Brousseau, Astolfi, Meirieu, Develay, Perrenoud) et les programmes officiels de l'Éducation nationale française.

═══════════════════════════════════════════════════════════════════════════════
                     CADRE DIDACTIQUE DE CONCEPTION
═══════════════════════════════════════════════════════════════════════════════

**1. ALIGNEMENT CURRICULAIRE (principe fondamental)**
Chaque séance doit explicitement contribuer aux attendus de fin de cycle définis dans les programmes officiels. Les objectifs opérationnels sont des étapes vers ces attendus, pas des objectifs isolés.

**2. PROGRESSION DIDACTIQUE AUTHENTIQUE**
La séquence doit respecter les phases d'apprentissage :

   PHASE 1 - ÉMERGENCE (1-2 séances)
   → Situation de départ / évaluation diagnostique
   → Faire émerger les représentations initiales des élèves
   → Identifier les obstacles didactiques à travailler
   → Créer le besoin d'apprentissage (dévolution du problème)

   PHASE 2 - CONSTRUCTION (séances centrales)
   → Situations-problèmes adaptées à la ZPD (Zone Proximale de Développement)
   → Progression du simple au complexe, du concret à l'abstrait
   → Alternance action/réflexion, manipulation/verbalisation
   → Confrontation des procédures (conflit socio-cognitif)
   → Institutionnalisation progressive des savoirs

   PHASE 3 - STRUCTURATION (1-2 séances)
   → Formalisation et synthèse des apprentissages
   → Construction de traces écrites structurées
   → Mise en réseau avec les savoirs antérieurs
   → Explicitation des critères de réussite

   PHASE 4 - ENTRAÎNEMENT ET TRANSFERT (séances finales)
   → Exercices d'application variés et gradués
   → Situations de transfert (contextes nouveaux)
   → Différenciation selon les besoins identifiés
   → Évaluation sommative alignée sur les attendus

**3. OPÉRATIONNALISATION DES OBJECTIFS**
Chaque objectif doit être :
- Formulé avec un verbe d'action observable (cf. taxonomie de Bloom révisée)
- Mesurable par des critères de réussite explicites
- Atteignable dans le temps imparti
- Aligné sur les attendus du programme

**4. DIFFÉRENCIATION PÉDAGOGIQUE INTÉGRÉE**
Pour chaque séance, prévoir :
- Étayage pour les élèves en difficulté (aides, simplifications, outils)
- Approfondissement pour les élèves experts (défis, extensions)
- Modalités variées (individuel, binômes, groupes hétérogènes/homogènes)

**5. ÉVALUATION FORMATIVE CONTINUE**
- Points de vérification intégrés dans chaque séance
- Critères de réussite explicites et partagés avec les élèves
- Feedback formatif permettant l'autorégulation

═══════════════════════════════════════════════════════════════════════════════
                         FORMAT DE SORTIE OBLIGATOIRE
═══════════════════════════════════════════════════════════════════════════════

Tu dois produire un tableau markdown avec EXACTEMENT ces 5 colonnes :

| Séance | Phase et objectif opérationnel | Obstacles et différenciation | Activités et dispositifs | Évaluation et critères de réussite |

**DÉFINITION DES COLONNES :**

• **Séance** : Numéro + titre évocateur de la séance

• **Phase et objectif opérationnel** : 
  - Indiquer la phase (Émergence/Construction/Structuration/Transfert)
  - Objectif avec verbe d'action : "Identifier...", "Comparer...", "Produire..."
  - Lien explicite avec l'attendu de fin de cycle visé

• **Obstacles et différenciation** :
  - Obstacles didactiques anticipés (représentations erronées, difficultés prévisibles)
  - Adaptations pour élèves en difficulté (étayage, supports, aides)
  - Extensions pour élèves avancés (approfondissement, défis)

• **Activités et dispositifs** :
  - Description concrète et réaliste des activités
  - Modalités de travail (individuel/binôme/groupe/collectif)
  - Matériel et supports nécessaires
  - Durées indicatives des phases
  - Rôle de l'enseignant (consigne, étayage, relance, institutionnalisation)

• **Évaluation et critères de réussite** :
  - Modalités d'évaluation formative pendant la séance
  - Critères de réussite explicites et observables
  - Indicateurs de progrès pour les élèves

═══════════════════════════════════════════════════════════════════════════════
                           EXIGENCES DE QUALITÉ
═══════════════════════════════════════════════════════════════════════════════

1. **Cohérence curriculaire** : Chaque séance contribue explicitement aux attendus de fin de cycle
2. **Progression logique** : Complexification progressive, chaque séance s'appuie sur les acquis précédents
3. **Réalisme temporel** : Les activités sont réalisables dans la durée impartie
4. **Richesse pédagogique** : Variété des modalités, équilibre entre les phases d'apprentissage
5. **Praticité** : Descriptions suffisamment détaillées pour être directement applicables
6. **Professionnalisme** : Vocabulaire didactique précis, références aux programmes

Après le tableau, ajoute une section "**Notes pédagogiques**" avec :
- Les attendus de fin de cycle visés (issus des programmes officiels)
- Les compétences du socle commun travaillées (si pertinent)
- Les points de vigilance pour l'enseignant
- Les liens possibles avec d'autres disciplines (interdisciplinarité)`;

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

    // Déterminer le cycle
    const { cycle, cycleNum } = getCycleFromNiveau(data.niveau);

    console.log(`[scenario] Generating for: ${data.matiere} - ${data.niveau} (${cycle})`);
    console.log(`[scenario] useRag: ${data.useRag}`);
    console.log(`[scenario] Documents fournis: ${documentNames?.length || 0}`);

    // ========================================================================
    // SECTION RAG (optionnelle) - REQUÊTE OPTIMISÉE
    // ========================================================================
    
    let ragContext = '';
    let ragSources: RagSource[] = [];
    
    if (data.useRag) {
      console.log('[scenario] RAG mode enabled, searching documents...');
      
      // Construire une requête de recherche OPTIMISÉE et CIBLÉE
      const searchTerms = [
        data.matiere,
        data.niveau,
        cycle,
        data.theme,
        'attendus de fin de cycle',
        'repères de progressivité',
        'programmes officiels',
        'compétences',
        cycleNum >= 2 && cycleNum <= 4 ? 'socle commun' : '',
      ].filter(Boolean).join(' ');
      
      console.log(`[scenario] RAG search query: ${searchTerms}`);
      
      // Créer l'embedding
      const embedding = await createEmbedding(searchTerms, OPENAI_API_KEY);
      
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

═══════════════════════════════════════════════════════════════════════════════
              RESSOURCES OFFICIELLES (PROGRAMMES ET ACCOMPAGNEMENTS)
═══════════════════════════════════════════════════════════════════════════════

Les extraits suivants proviennent des textes officiels de l'Éducation nationale.
Tu DOIS t'appuyer sur ces ressources pour :
- Formuler des objectifs alignés sur les attendus de fin de cycle
- Utiliser le vocabulaire institutionnel exact
- Respecter les repères de progressivité mentionnés
- Référencer les compétences du socle commun (cycles 2-4)

${chunks.map((chunk, i) => `
┌─────────────────────────────────────────────────────────────────────────────┐
│ SOURCE ${i + 1} : ${chunk.documentTitle}
│ Pertinence : ${(chunk.score * 100).toFixed(0)}%
└─────────────────────────────────────────────────────────────────────────────┘
${chunk.content}
`).join('\n')}

⚠️ CONSIGNE IMPÉRATIVE : Les objectifs et attendus de ta séquence doivent être 
DIRECTEMENT ISSUS ou ALIGNÉS sur ces textes officiels. Cite explicitement les 
attendus de fin de cycle dans la section "Notes pédagogiques".
`;
      } else {
        console.log('[scenario] No relevant RAG chunks found');
        ragContext = `

⚠️ Aucune ressource officielle trouvée dans la base documentaire pour cette requête.
Veille néanmoins à proposer des objectifs cohérents avec les programmes en vigueur
pour le ${cycle} en ${data.matiere}.
`;
      }
    }

    // ========================================================================
    // SECTION DOCUMENTS SUPPORTS (optionnelle)
    // ========================================================================
    
    let documentsContext = '';
    
    if (documentsContent && documentsContent.trim()) {
      console.log(`[scenario] Documents supports fournis: ${documentNames?.join(', ') || 'sans nom'}`);
      
      documentsContext = `

═══════════════════════════════════════════════════════════════════════════════
                    DOCUMENTS SUPPORTS FOURNIS PAR L'ENSEIGNANT
═══════════════════════════════════════════════════════════════════════════════

Ces documents doivent être INTÉGRÉS dans le scénario pédagogique comme supports 
d'activité (textes à étudier, exercices à utiliser, ressources à exploiter) :

${documentsContent}

${documentNames && documentNames.length > 0 ? `📎 Fichiers fournis : ${documentNames.join(', ')}` : ''}

⚠️ CONSIGNE : Intègre ces documents dans les activités proposées. Référence-les 
explicitement dans la colonne "Activités et dispositifs" quand c'est pertinent.
`;
    }

    // ========================================================================
    // CONSTRUCTION DU PROMPT UTILISATEUR ENRICHI
    // ========================================================================

    const userPrompt = `═══════════════════════════════════════════════════════════════════════════════
                         DEMANDE DE SCÉNARIO PÉDAGOGIQUE
═══════════════════════════════════════════════════════════════════════════════

**CONTEXTE INSTITUTIONNEL**
• Matière : ${data.matiere}
• Niveau : ${data.niveau}
• Cycle : ${cycle}
• Durée de la séquence : ${data.nombreSeances} séances de ${data.dureeSeance} minutes

**THÈME / TITRE DE LA SÉQUENCE**
${data.theme}

**POINT DE DÉPART / DIAGNOSTIC INITIAL**
${data.pointDepart || 'Non précisé - considérer un niveau hétérogène avec des acquis partiels sur les prérequis'}

**ATTENDUS DE FIN DE SÉQUENCE (objectifs terminaux)**
${data.attendus}
${ragContext}
${documentsContext}

═══════════════════════════════════════════════════════════════════════════════
                              CONSIGNES DE GÉNÉRATION
═══════════════════════════════════════════════════════════════════════════════

1. **Structure progressive obligatoire** :
   - Séance(s) 1-2 : Phase d'émergence (diagnostic, représentations, dévolution)
   - Séances centrales : Phase de construction (situations-problèmes, institutionnalisation progressive)
   - Avant-dernière(s) séance(s) : Phase de structuration (synthèse, trace écrite)
   - Dernière(s) séance(s) : Phase de transfert (réinvestissement, évaluation)

2. **Réalisme temporel** : Chaque séance de ${data.dureeSeance} minutes doit être réaliste
   - Prévoir le temps d'installation, de passation des consignes, de rangement
   - Ne pas surcharger : mieux vaut un objectif bien traité que plusieurs survolés

3. **Différenciation systématique** : Pour chaque séance, préciser les adaptations

4. **Cohérence avec les programmes** : ${data.useRag ? 'Utilise les ressources officielles fournies ci-dessus pour aligner les objectifs' : 'Veille à la cohérence avec les programmes du ' + cycle}

5. **Format de sortie** : Tableau markdown avec les 5 colonnes définies, suivi des notes pédagogiques

Génère maintenant le scénario pédagogique complet :`;

    // ========================================================================
    // APPEL OPENAI AVEC SYSTEM PROMPT EXPERT
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
        temperature: 0.6,  // Légèrement réduit pour plus de cohérence
        max_tokens: 5000,  // Augmenté pour contenu plus riche
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

