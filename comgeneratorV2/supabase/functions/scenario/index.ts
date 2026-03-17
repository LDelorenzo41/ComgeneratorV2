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
  documentsContent?: string;
  documentNames?: string[];
  folderIds?: string[];
  aiModel?: string;
}

interface RagChunk {
  id: string;
  content: string;
  documentId: string;
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
  ragTopK: 8,
  ragSimilarityThreshold: 0.55,
};

// =====================================================
// CONFIGURATION DES MODÈLES IA
// =====================================================

function resolveAIConfig(aiModel: string | undefined, openaiKey: string, mistralKey: string | undefined) {
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
  console.warn(`[scenario] Modèle non reconnu: ${aiModel}, utilisation du modèle par défaut`);
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

// =====================================================
// NETTOYAGE DE LA SORTIE (notamment pour Mistral)
// =====================================================

function cleanScenarioOutput(text: string, isMistral: boolean): string {
  let cleaned = text;

  // 1. Supprimer les blocs code fence markdown (```markdown ... ``` ou ``` ... ```)
  cleaned = cleaned.replace(/^```(?:markdown)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  // Fences internes résiduelles
  cleaned = cleaned.replace(/^```(?:markdown)?\s*\n?/gim, '');
  cleaned = cleaned.replace(/\n?```\s*$/gim, '');

  // 2. Supprimer tout texte d'introduction AVANT le tableau
  //    Le tableau commence par une ligne qui débute par | et contient "séance"
  const lines = cleaned.split('\n');
  let tableStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('|') && /s[ée]ance/i.test(trimmed)) {
      tableStartIdx = i;
      break;
    }
  }
  if (tableStartIdx > 0) {
    // Supprimer les lignes avant le tableau (intro, commentaires, etc.)
    cleaned = lines.slice(tableStartIdx).join('\n');
  }

  // 3. Fusionner les lignes de tableau cassées (GPT-5 mini peut insérer des \n dans les cellules)
  //    Une ligne qui ne commence pas par | mais qu'on est dans le tableau → continuation de la ligne précédente
  {
    const tableLines = cleaned.split('\n');
    const merged: string[] = [];
    let inTableZone = false;

    for (let i = 0; i < tableLines.length; i++) {
      const trimmed = tableLines[i].trim();

      // Détection de la zone tableau (commence par | et contient "séance")
      if (!inTableZone && trimmed.startsWith('|') && /s[ée]ance/i.test(trimmed)) {
        inTableZone = true;
      }

      if (inTableZone && trimmed !== '') {
        // Ligne séparateur (|---|---|...) → garder telle quelle
        if (trimmed.match(/^\|[\s\-:|]+\|$/)) {
          merged.push(trimmed);
          continue;
        }

        // Ligne qui commence par | → nouvelle ligne de tableau
        if (trimmed.startsWith('|')) {
          merged.push(trimmed);
          continue;
        }

        // Ligne qui NE commence PAS par | mais on est dans le tableau
        // → c'est une continuation de la ligne précédente, on fusionne
        if (merged.length > 0 && merged[merged.length - 1].startsWith('|')) {
          // Ajouter un espace avant le texte de continuation
          merged[merged.length - 1] = merged[merged.length - 1] + ' ' + trimmed;
          continue;
        }
      }

      // Hors du tableau ou ligne vide → garder normalement
      merged.push(tableLines[i]);

      // Détecter la fin du tableau (ligne non-vide, hors tableau, après des lignes |)
      if (inTableZone && trimmed !== '' && !trimmed.startsWith('|') && !trimmed.startsWith('#')) {
        // On est sorti du tableau
        inTableZone = false;
      }
    }

    cleaned = merged.join('\n');
  }

  // 4. Normaliser les lignes du tableau
  cleaned = cleaned.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) return line;

    // S'assurer que la ligne finit par |
    let normalized = trimmed.endsWith('|') ? trimmed : trimmed + ' |';

    // Nettoyer le bold/italic markdown dans la première cellule (ex: **Séance 1** → Séance 1)
    normalized = normalized.replace(
      /^\|\s*\*{1,3}([^|*]+)\*{1,3}\s*/,
      '| $1 '
    );

    return normalized;
  }).join('\n');

  if (isMistral) {
    // 5. Supprimer les méta-commentaires après les Notes pédagogiques
    const metaKeywords = '(?:Notes? d\'adaptation|Remarques? contextuelles?|Notes? de rédaction|' +
      'Analyse du message|Commentaires?|Structure|Notes? de l\'IA|Chat context|PERSONALIZATION)';

    // Après un séparateur ---
    cleaned = cleaned.replace(
      new RegExp(`\\n---\\s*\\n\\s*${metaKeywords}[\\s\\S]*$`, 'i'),
      ''
    );
    // Sans séparateur
    cleaned = cleaned.replace(
      new RegExp(`\\n\\n\\s*${metaKeywords}[\\s\\S]*$`, 'i'),
      ''
    );

    // 6. Corriger le formatage markdown (espacement avant les headers)
    cleaned = cleaned.replace(/([^\n])\n(#{2,3}\s)/g, '$1\n\n$2');
  }

  // 7. Normaliser les sauts de ligne excessifs (3+ → 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// MAPPING NIVEAU → CYCLE
// ============================================================================

function getCycleFromNiveau(niveau: string): { cycle: string; cycleNum: number } {
  const niveauLower = niveau.toLowerCase().trim();
  
  if (niveauLower.includes('ps') || niveauLower.includes('ms') || niveauLower.includes('gs') ||
      niveauLower.includes('petite section') || niveauLower.includes('moyenne section') || 
      niveauLower.includes('grande section') || niveauLower.includes('maternelle')) {
    return { cycle: 'cycle 1', cycleNum: 1 };
  }
  
  if (niveauLower.includes('cp') || niveauLower.includes('ce1') || niveauLower.includes('ce2') ||
      niveauLower.includes('cours préparatoire') || niveauLower.includes('cours élémentaire')) {
    return { cycle: 'cycle 2', cycleNum: 2 };
  }
  
  if (niveauLower.includes('cm1') || niveauLower.includes('cm2') || niveauLower.includes('6') ||
      niveauLower.includes('sixième') || niveauLower.includes('cours moyen')) {
    return { cycle: 'cycle 3', cycleNum: 3 };
  }
  
  if (niveauLower.includes('5') || niveauLower.includes('4') || niveauLower.includes('3') ||
      niveauLower.includes('cinquième') || niveauLower.includes('quatrième') || 
      niveauLower.includes('troisième') || niveauLower.includes('collège')) {
    return { cycle: 'cycle 4', cycleNum: 4 };
  }
  
  if (niveauLower.includes('seconde') || niveauLower.includes('2nde') || 
      niveauLower.includes('première') || niveauLower.includes('1ère') ||
      niveauLower.includes('terminale') || niveauLower.includes('tle') ||
      niveauLower.includes('lycée')) {
    return { cycle: 'lycée', cycleNum: 5 };
  }
  
  return { cycle: 'non déterminé', cycleNum: 0 };
}

// ============================================================================
// PROMPT SYSTÈME EXPERT EN DIDACTIQUE (VERSION OPTIMISÉE)
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

**6. LOGIQUE DIDACTIQUE EXPLICITE (savoir → situation → institution → preuve)**
Pour chaque séance, la proposition doit rendre lisible :
- Le SAVOIR visé (concept, procédure, attitude à construire)
- La SITUATION qui permet de le construire (problème, tâche, milieu)
- Le rôle du MILIEU (matériel, contraintes, consignes qui permettent l'apprentissage)
- Le moment d'INSTITUTIONNALISATION par l'enseignant (ce qui est stabilisé)
- Ce qui constitue la PREUVE que l'apprentissage a eu lieu

⚠️ DISTINCTION CRUCIALE : Une activité réussie ≠ un apprentissage réalisé.
Tu dois expliciter POURQUOI chaque activité permet réellement l'apprentissage visé,
et anticiper les "fausses réussites" (réussite de la tâche sans compréhension).

**7. MÉMOIRE DIDACTIQUE ET CONTINUITÉ**
Un apprentissage durable nécessite :
- Réactivation explicite des acquis antérieurs à chaque séance
- Liens visibles entre les séances (ce qui est repris, transformé, approfondi)
- Traces écrites évolutives (qui s'enrichissent au fil de la séquence)
- Rituels de rappel et de consolidation
- Anticipation : que doit rester 3 semaines après la séquence ?

**8. STATUT DE L'ERREUR COMME LEVIER D'APPRENTISSAGE**
L'erreur n'est pas un échec mais un outil didactique :
- Erreurs ATTENDUES : celles que les élèves vont probablement commettre
- Erreurs FÉCONDES : celles qui révèlent un obstacle et permettent d'avancer
- EXPLOITATION DIDACTIQUE : comment l'enseignant utilise l'erreur pour faire progresser

═══════════════════════════════════════════════════════════════════════════════
                         FORMAT DE SORTIE OBLIGATOIRE
═══════════════════════════════════════════════════════════════════════════════

Tu dois produire un tableau markdown avec EXACTEMENT ces 5 colonnes :

| Séance | Phase et objectif opérationnel | Obstacles, erreurs et différenciation | Activités et dispositifs | Évaluation et critères de réussite |

**DÉFINITION DES COLONNES :**

• **Séance** : Numéro + titre évocateur de la séance

• **Phase et objectif opérationnel** : 
  - Indiquer la phase (Émergence/Construction/Structuration/Transfert)
  - Objectif avec verbe d'action : "Identifier...", "Comparer...", "Produire..."
  - Lien explicite avec l'attendu de fin de cycle visé
  - SAVOIR visé clairement identifié (concept, procédure ou attitude)
  - Lien avec la séance précédente (réactivation des acquis)

• **Obstacles, erreurs et différenciation** :
  - Obstacles didactiques anticipés (représentations erronées, conceptions initiales)
  - Erreurs typiques ATTENDUES et leur origine probable
  - Erreurs FÉCONDES à exploiter pour faire avancer la réflexion
  - Modalités d'EXPLOITATION PÉDAGOGIQUE de l'erreur (confrontation, explicitation)
  - Malentendus possibles sur la tâche ou le savoir
  - Adaptations pour élèves en difficulté (étayage, supports, aides)
  - Extensions pour élèves avancés (approfondissement, défis)

• **Activités et dispositifs** :
  - Description concrète et réaliste des activités
  - Explication de POURQUOI cette activité permet l'apprentissage visé
  - Modalités de travail (individuel/binôme/groupe/collectif)
  - Matériel et supports nécessaires (le MILIEU)
  - Durées indicatives des phases
  - POSTURE DE L'ENSEIGNANT à chaque moment :
    • Quand il observe sans intervenir (dévolution)
    • Quand il étaye par questionnement (relance)
    • Quand il régule les interactions (médiation)
    • Quand il institutionnalise le savoir (formalisation)
  - Trace écrite ou mémorielle construite (ce qui reste)

• **Évaluation et critères de réussite** :
  - Modalités d'évaluation formative pendant la séance
  - Critères de réussite explicites et observables
  - Indicateurs de progrès pour les élèves
  - Ce qui PROUVE que l'apprentissage a eu lieu (pas seulement la réussite de la tâche)
  - Distinction entre réussite de l'activité et compréhension du savoir

═══════════════════════════════════════════════════════════════════════════════
                           EXIGENCES DE QUALITÉ
═══════════════════════════════════════════════════════════════════════════════

1. **Cohérence curriculaire** : Chaque séance contribue explicitement aux attendus de fin de cycle
2. **Progression logique** : Complexification progressive, chaque séance s'appuie sur les acquis précédents
3. **Réalisme temporel** : Les activités sont réalisables dans la durée impartie
4. **Richesse pédagogique** : Variété des modalités, équilibre entre les phases d'apprentissage
5. **Praticité** : Descriptions suffisamment détaillées pour être directement applicables
6. **Professionnalisme** : Vocabulaire didactique précis, références aux programmes
7. **Continuité inter-séances** : Chaque séance réactive explicitement un acquis antérieur
8. **Exploitation de l'erreur** : Les erreurs sont anticipées et utilisées comme leviers

Après le tableau, ajoute une section "**Notes pédagogiques**" avec :
- Les attendus de fin de cycle visés (issus des programmes officiels)
- Les compétences du socle commun travaillées (si pertinent)
- Les points de vigilance pour l'enseignant
- Les liens possibles avec d'autres disciplines (interdisciplinarité)
- Ce qui doit RESTER chez les élèves 3 semaines après (mémoire didactique)
- Les rituels de réactivation recommandés

═══════════════════════════════════════════════════════════════════════════════
                      AUTO-CONTRÔLE QUALITÉ (à effectuer avant de répondre)
═══════════════════════════════════════════════════════════════════════════════

Avant de finaliser ta réponse, vérifie systématiquement que :
□ Aucune séance ne se limite à une simple activité sans apprentissage explicite
□ Les objectifs sont réellement évaluables (verbes d'action observables)
□ La progression est crédible pour des élèves réels du niveau indiqué
□ Le vocabulaire est institutionnel et professionnel
□ Chaque séance a un lien explicite avec la précédente (sauf la première)
□ Les erreurs anticipées sont réalistes et leur exploitation est prévue
□ Les postures enseignantes sont clairement indiquées
□ La distinction tâche/activité/apprentissage est respectée
□ Les traces écrites sont prévues et évolutives`;

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
      documentId: item.document_id || '',
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
    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');

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

    const data: ScenarioRequest = await req.json();
    const { documentsContent, documentNames, aiModel } = data;
    const { cycle, cycleNum } = getCycleFromNiveau(data.niveau);

    // Résoudre la configuration du modèle IA
    let aiConfig;
    try {
      aiConfig = resolveAIConfig(aiModel, OPENAI_API_KEY, MISTRAL_API_KEY);
    } catch (configError: any) {
      return new Response(JSON.stringify({ error: configError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[scenario] Modèle IA utilisé: ${aiConfig.model}`);
    console.log(`[scenario] Generating for: ${data.matiere} - ${data.niveau} (${cycle})`);
    console.log(`[scenario] useRag: ${data.useRag}`);
    console.log(`[scenario] Documents fournis: ${documentNames?.length || 0}`);

    // ========================================================================
    // SECTION RAG (optionnelle)
    // ========================================================================
    
    let ragContext = '';
    let ragSources: RagSource[] = [];
    
    if (data.useRag) {
      console.log('[scenario] RAG mode enabled, searching documents...');

      // Si un dossier est sélectionné, récupérer les document_ids autorisés
      let allowedDocIds: Set<string> | null = null;

      if (data.folderIds?.length) {
        const { data: folderDocs } = await serviceClient
          .from('rag_documents')
          .select('id')
          .eq('user_id', user.id)
          .in('folder_id', data.folderIds);

        if (folderDocs && folderDocs.length > 0) {
          allowedDocIds = new Set(folderDocs.map((d: any) => d.id));
          console.log(`[scenario] Folder filter: ${allowedDocIds.size} documents in selected folders`);
        } else {
          console.log('[scenario] No documents found in selected folders');
        }
      }

      const searchTerms = [
        data.theme,
        data.matiere,
        data.niveau,
        cycle,
      ].filter(Boolean).join(' ');

      console.log(`[scenario] RAG search query: ${searchTerms}`);

      const embedding = await createEmbedding(searchTerms, OPENAI_API_KEY);

      // Chercher plus de chunks quand un filtre dossier est actif
      const searchTopK = allowedDocIds ? CONFIG.ragTopK * 5 : CONFIG.ragTopK;

      let chunks = await searchRagChunks(
        serviceClient,
        user.id,
        embedding,
        searchTopK
      );

      // Filtrer par document_id si un dossier est sélectionné
      if (allowedDocIds && chunks.length > 0) {
        chunks = chunks.filter(c => allowedDocIds!.has(c.documentId));
        console.log(`[scenario] After folder filter: ${chunks.length} chunks from selected folders`);
        chunks = chunks.slice(0, CONFIG.ragTopK);
      }

      if (chunks.length > 0) {
        console.log(`[scenario] Found ${chunks.length} relevant chunks`);
        
        ragSources = chunks.map((chunk: RagChunk) => ({
          document_name: chunk.documentTitle || 'Document officiel',
          chunk_content: chunk.content,
          similarity: chunk.score,
        }));
        
        ragContext = `

═══════════════════════════════════════════════════════════════════════════════
   ⚠️ CORPUS DOCUMENTAIRE — UTILISATION OBLIGATOIRE ⚠️
═══════════════════════════════════════════════════════════════════════════════

Les extraits ci-dessous proviennent du corpus documentaire de l'enseignant.
Tu DOIS OBLIGATOIREMENT :
1. CITER explicitement au moins 3 éléments tirés de ces sources dans le scénario
2. REPRENDRE le vocabulaire exact et les formulations des documents
3. ALIGNER les objectifs de la séquence sur les attendus mentionnés dans ces sources
4. RÉFÉRENCER les sources par leur nom (ex: "[Source : nom_du_document]") dans les colonnes pertinentes du tableau
5. Dans la section "Notes pédagogiques", LISTER les sources utilisées avec les éléments repris

${chunks.map((chunk, i) => `
[SOURCE ${i + 1} — ${chunk.documentTitle} — Pertinence : ${(chunk.score * 100).toFixed(0)}%]
${chunk.content}
`).join('\n')}

⚠️ RAPPEL : Si tu ne cites pas explicitement ces sources dans ta réponse, le scénario sera considéré comme NON CONFORME.
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

4. **Cohérence avec les programmes** : ${ragContext ? 'Utilise OBLIGATOIREMENT les sources documentaires fournies ci-dessous. Cite-les explicitement par leur nom [Source : nom_du_document] dans les colonnes du tableau.' : 'Veille à la cohérence avec les programmes du ' + cycle}

5. **Format de sortie** : Tableau markdown avec les 5 colonnes définies, suivi des notes pédagogiques

6. **Continuité inter-séances obligatoire** :
   - Chaque séance (sauf la première) doit RÉACTIVER explicitement un acquis de la séance précédente
   - Indiquer ce qui est repris, transformé ou approfondi d'une séance à l'autre
   - Préciser les traces écrites ou mémorielles construites et comment elles évoluent
   - Anticiper ce qui doit RESTER chez les élèves après la séquence

7. **Traitement de l'erreur** :
   - Anticiper les erreurs typiques des élèves pour chaque séance
   - Identifier les erreurs "fécondes" qui permettent de faire avancer la réflexion
   - Prévoir comment l'enseignant exploitera ces erreurs (confrontation, explicitation)

8. **Postures enseignantes explicites** :
   - Pour chaque activité, indiquer quand l'enseignant observe, étaye, régule ou institutionnalise

${ragContext ? `9. **Citation des sources documentaires OBLIGATOIRE** :
   - Référencer chaque source utilisée par son nom entre crochets [Source : nom_du_document]
   - Dans les "Notes pédagogiques", ajouter une sous-section "Sources documentaires utilisées" listant chaque document et les éléments repris` : ''}
${ragContext ? `
═══════════════════════════════════════════════════════════════════════════════
  ⚠️ RAPPEL FINAL — UTILISE LES SOURCES DOCUMENTAIRES ⚠️
═══════════════════════════════════════════════════════════════════════════════

Les sources documentaires ont été fournies plus haut dans ce message.
Tu DOIS les citer explicitement avec [Source : nom_du_document].
La sous-section "Sources documentaires utilisées" dans les Notes pédagogiques est OBLIGATOIRE.

Génère maintenant le scénario pédagogique en t'appuyant OBLIGATOIREMENT sur ces sources :` : `
Génère maintenant le scénario pédagogique complet :`}`;

    // ========================================================================
    // APPEL API IA (GPT-4.1-mini / GPT-5 mini / Mistral Medium)
    // ========================================================================

    // Instructions strictes sur le format de sortie (pour modèles non-default)
    let formatInstruction = '';

    if (aiConfig.model === 'mistral-medium-latest') {
      formatInstruction = `\n\n⚠️ INSTRUCTIONS STRICTES POUR LA SORTIE :
1. N'enveloppe JAMAIS ta réponse dans des blocs de code (\`\`\`markdown ou \`\`\`). Écris directement le contenu markdown SANS balises de code.
2. Commence DIRECTEMENT par le tableau markdown des séances (première ligne = | Séance | Phase...).
3. Chaque ligne du tableau DOIT commencer ET finir par le caractère |
4. Chaque ligne du tableau DOIT contenir exactement 5 colonnes séparées par |
5. Chaque séance = UNE SEULE ligne du tableau (pas de retour à la ligne dans les cellules).
6. Après le tableau, ajoute UNIQUEMENT la section "**Notes pédagogiques**" avec les éléments demandés.
7. N'ajoute AUCUNE note, remarque, ou commentaire sur ta propre rédaction après les "Notes pédagogiques".
8. Ne génère AUCUNE section technique comme "# Chat context", "# PERSONALIZATION INSTRUCTIONS", ou similaire.
9. La section "Notes pédagogiques" NE doit PAS répéter le contenu du tableau. Elle doit contenir UNIQUEMENT :
   - Les attendus de fin de cycle visés
   - Les compétences du socle commun travaillées
   - Les points de vigilance pour l'enseignant
   - Les liens interdisciplinaires possibles
   - Ce qui doit rester chez les élèves après la séquence
   - Les rituels de réactivation recommandés`;
    } else if (aiConfig.isResponsesAPI) {
      formatInstruction = `\n\n⚠️ INSTRUCTIONS STRICTES POUR LE FORMAT DE SORTIE :
1. N'enveloppe JAMAIS ta réponse dans des blocs de code (\`\`\`markdown ou \`\`\`). Écris directement le contenu.
2. Commence DIRECTEMENT par le tableau markdown (première ligne = | Séance | Phase et objectif opérationnel | Obstacles, erreurs et différenciation | Activités et dispositifs | Évaluation et critères de réussite |).
3. La deuxième ligne DOIT être le séparateur : |--------|------|------|------|------|
4. Chaque ligne de données du tableau DOIT commencer ET finir par le caractère |
5. Chaque ligne DOIT contenir exactement 5 colonnes séparées par |
6. Chaque séance = UNE SEULE ligne du tableau (pas de retour à la ligne dans les cellules).
7. N'ajoute AUCUN texte d'introduction avant le tableau.
8. Après le tableau, ajoute la section "**Notes pédagogiques**".`;
    }

    // Enrichir le system prompt avec une instruction RAG si des sources sont disponibles
    const effectiveSystemPrompt = ragContext
      ? `${SYSTEM_PROMPT}\n\nRÈGLE FONDAMENTALE : Des sources documentaires sont fournies par l'enseignant. Tu DOIS les citer explicitement dans ta réponse. Chaque source pertinente doit être référencée par son nom entre crochets [Source : nom_du_document] dans les colonnes du tableau. La sous-section "Sources documentaires utilisées" dans les Notes pédagogiques est OBLIGATOIRE.`
      : SYSTEM_PROMPT;

    let requestBody: any;

    if (aiConfig.isResponsesAPI) {
      // GPT-5 mini : API Responses (format différent)
      const fullPrompt = `${effectiveSystemPrompt}\n\n---\n\n${userPrompt}${formatInstruction}`;
      requestBody = {
        model: aiConfig.model,
        input: fullPrompt,
        max_output_tokens: 8000,
        text: { format: { type: "text" } },
        reasoning: { effort: "medium" }
      };
    } else if (aiConfig.model === 'mistral-medium-latest') {
      // Mistral : pas de rôle system, tout dans un message user
      const combinedPrompt = `${effectiveSystemPrompt}\n\n---\n\n${userPrompt}${formatInstruction}`;
      requestBody = {
        model: aiConfig.model,
        messages: [{ role: 'user', content: combinedPrompt }],
        temperature: 0.7,
        max_tokens: 5500,
      };
    } else {
      // Default (gpt-4.1-mini) : séparation system/user pour meilleur suivi du contexte RAG
      requestBody = {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: effectiveSystemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 5500,
      };
    }

    const response = await fetch(aiConfig.endpoint, {
      method: 'POST',
      headers: aiConfig.headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`[scenario] ${aiConfig.model} API error:`, await response.text());
      return new Response(JSON.stringify({ error: `Erreur API ${aiConfig.model}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // PARSING DE LA RÉPONSE (format différent selon l'API)
    // ========================================================================

    const aiData = await response.json();
    let content: string | null = null;

    if (aiConfig.isResponsesAPI) {
      // GPT-5 mini : format Responses API
      if (aiData?.output && Array.isArray(aiData.output)) {
        const messageItem = aiData.output.find((item: any) => item.type === 'message');
        if (messageItem?.content && Array.isArray(messageItem.content)) {
          const outputText = messageItem.content.find((c: any) => c.type === 'output_text');
          if (outputText?.text) {
            content = outputText.text;
          }
        }
      }
      // Fallback pour format simplifié
      if (!content && aiData?.output_text) {
        content = aiData.output_text;
      }
    } else {
      // Chat Completions (OpenAI + Mistral)
      content = aiData.choices?.[0]?.message?.content;
      if (!content) {
        content = aiData.choices?.[0]?.text;
      }
    }

    if (!content) {
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Nettoyage de la sortie (suppression code fences, méta-commentaires Mistral)
    const isMistral = aiConfig.model === 'mistral-medium-latest';
    content = cleanScenarioOutput(content, isMistral);

    console.log(`[scenario] Generated ${content.length} chars with ${aiConfig.model}`);
    console.log(`[scenario] RAG sources returned: ${ragSources.length}`);

    return new Response(JSON.stringify({
      content,
      usage: aiData.usage,
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








