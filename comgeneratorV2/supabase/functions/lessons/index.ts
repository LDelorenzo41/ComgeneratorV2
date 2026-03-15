// supabase/functions/lessons/index.ts
// VERSION CORRIGÉE : SOLUTION FINALE (Nettoyage robuste + Prompt strict Mistral)

// =====================================================
// CONFIGURATION DES MODÈLES IA
// =====================================================

function resolveAIConfig(aiModel, openaiKey, mistralKey) {
  // Modèle par défaut : gpt-4.1-mini
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
      isResponsesAPI: false,
      isDefault: true
    };
  }

  // GPT-5 mini (OpenAI)
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
      isResponsesAPI: true,
      isDefault: false
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
      isResponsesAPI: false,
      isDefault: false
    };
  }

  // Fallback
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
    isResponsesAPI: false,
    isDefault: true
  };
}

/**
 * Nettoie et reformate le texte de sortie (Spécifique Mistral)
 */
function cleanOutputText(text: string, isMistral: boolean): string {
  if (!text) return text;
  if (!isMistral) return text.trim();

  let cleaned = text;

  const startMarker = "# 📚"; 
  const startIndex = cleaned.indexOf(startMarker);

  if (startIndex !== -1) {
    cleaned = cleaned.slice(startIndex);
  } else {
    cleaned = cleaned.replace(/^# .*\n+/gm, '');
  }

  const metaKeywords = "(?:Notes?|Remarques?|Adaptation|Contextuelle|Structure|Analyse|Commentaires?|Explications?|Note de l'IA|Chat context|PERSONALIZATION INSTRUCTIONS)";
  
  cleaned = cleaned.replace(new RegExp(`\\n---\\s*\\n\\s*${metaKeywords}[\\s\\S]*$`, 'gi'), '');
  cleaned = cleaned.replace(new RegExp(`\\n\\n\\s*${metaKeywords}[\\s\\S]*$`, 'gi'), '');

  cleaned = cleaned.replace(/([^\n])\s*(#{2,3})/g, '$1\n\n$2');
  cleaned = cleaned.replace(/([^\n])\s+-\s/g, '$1\n- ');
  cleaned = cleaned.replace(/(\|\n)(\S)/g, '$1\n$2');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

// =====================================================
// HELPERS - SUPABASE CLIENT (pour RAG)
// =====================================================

async function createServiceClient() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

interface LessonRequest {
  subject: string;
  topic: string;
  level: string;
  pedagogy_type: string;
  duration: string;
  documentContext?: string;
  aiModel?: string;
  useRag?: boolean;
  folderIds?: string[];
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

const RAG_CONFIG = {
  embeddingModel: 'text-embedding-3-large',
  embeddingDimensions: 1536,
  ragTopK: 8,
  ragSimilarityThreshold: 0.40,
};

async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: RAG_CONFIG.embeddingModel,
      input: text,
      dimensions: RAG_CONFIG.embeddingDimensions,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erreur embedding: ${await response.text()}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function searchRagChunks(
  supabase: any,
  userId: string,
  embedding: number[],
  topK: number
): Promise<RagChunk[]> {
  try {
    const { data, error } = await supabase.rpc('match_rag_chunks', {
      p_query_embedding: `[${embedding.join(',')}]`,
      p_similarity_threshold: RAG_CONFIG.ragSimilarityThreshold,
      p_match_count: topK,
      p_user_id: userId,
      p_document_id: null,
    });

    if (error) {
      console.error('[lessons] RAG search error:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      content: item.content,
      documentTitle: item.document_title,
      score: item.similarity,
    }));
  } catch (err) {
    console.error('[lessons] RAG search exception:', err);
    return [];
  }
}

const lessonsHandler = async (req: Request): Promise<Response> => {
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
  console.log(`[lessons] Utilisateur authentifié: ${authUser.id}`);
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

    const data: LessonRequest = await req.json();

    // Résoudre la configuration API
    let aiConfig;
    try {
      aiConfig = resolveAIConfig(data.aiModel, OPENAI_API_KEY, MISTRAL_API_KEY);
    } catch (configError) {
      return new Response(JSON.stringify({
        error: configError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[lessons] Modèle IA utilisé: ${aiConfig.model}`);

    // =====================================================
    // SECTION RAG (optionnelle)
    // =====================================================

    let ragContext = '';
    let ragSources: RagSource[] = [];

    if (data.useRag) {
      console.log(`[lessons] RAG mode enabled, searching documents...`);

      try {
        const serviceClient = await createServiceClient();

        const searchTerms = [
          data.subject,
          data.level,
          data.topic,
          'programmes officiels',
          'compétences',
        ].filter(Boolean).join(' ');

        console.log(`[lessons] RAG search query: ${searchTerms}`);

        const embedding = await createEmbedding(searchTerms, OPENAI_API_KEY);

        let chunks = await searchRagChunks(
          serviceClient,
          authUser.id,
          embedding,
          RAG_CONFIG.ragTopK
        );

        // Filtrer par dossier si folderIds est spécifié
        if (data.folderIds?.length && chunks.length > 0) {
          const { data: folderDocs } = await serviceClient
            .from('rag_documents')
            .select('title')
            .eq('user_id', authUser.id)
            .in('folder_id', data.folderIds);

          if (folderDocs) {
            const allowedTitles = new Set(folderDocs.map((d: any) => d.title));
            chunks = chunks.filter(c => allowedTitles.has(c.documentTitle));
            console.log(`[lessons] After folder filter: ${chunks.length} chunks`);
          }
        }

        if (chunks.length > 0) {
          console.log(`[lessons] Found ${chunks.length} relevant chunks`);

          ragSources = chunks.map((chunk: RagChunk) => ({
            document_name: chunk.documentTitle || 'Document',
            chunk_content: chunk.content,
            similarity: chunk.score,
          }));

          ragContext = `
═══════════════════════════════════════════════════════════════
            RESSOURCES DE VOTRE CORPUS DOCUMENTAIRE
═══════════════════════════════════════════════════════════════

Les extraits suivants proviennent du corpus documentaire personnel de l'enseignant.
Appuie-toi sur ces ressources pour enrichir et contextualiser la séance :
- Formuler des objectifs alignés sur les contenus fournis
- Utiliser le vocabulaire et les références des documents
- Intégrer les éléments pertinents dans les activités

${chunks.map((chunk, i) => `
┌─────────────────────────────────────────────────────────────┐
│ SOURCE ${i + 1} : ${chunk.documentTitle}
│ Pertinence : ${(chunk.score * 100).toFixed(0)}%
└─────────────────────────────────────────────────────────────┘
${chunk.content}
`).join('\n')}

⚠️ CONSIGNE : Intègre ces ressources dans la conception de la séance lorsqu'elles sont pertinentes.
`;
        } else {
          console.log('[lessons] No relevant RAG chunks found');
        }
      } catch (ragError) {
        console.error('[lessons] RAG error (non-blocking):', ragError);
        // RAG errors are non-blocking - lesson generation continues without RAG
      }
    }

    const pedagogies = [
      {
        value: 'traditionnelle',
        label: 'Pédagogie traditionnelle',
        description: "Méthode centrée sur la transmission directe des savoirs de l'enseignant vers les élèves (exposés, leçons magistrales, démonstration), favorisant la mémorisation et l'acquisition des bases."
      },
      {
        value: 'active',
        label: 'Pédagogie active',
        description: "L'élève est acteur de son apprentissage : il explore, manipule, agit. Favorise l'expérimentation, la résolution de problèmes concrets, seul ou en groupe."
      },
      {
        value: 'projet',
        label: 'Pédagogie de projet',
        description: "Le savoir est mobilisé autour d'un projet concret (exposé, création, enquête). Les élèves planifient, réalisent, évaluent, ce qui développe leur autonomie."
      },
      {
        value: 'cooperatif',
        label: 'Apprentissage coopératif',
        description: "Les élèves travaillent en groupes pour résoudre des tâches ou projets, développant entraide, communication et responsabilisation."
      },
      {
        value: 'differenciee',
        label: 'Pédagogie différenciée',
        description: "Enseignement adapté aux besoins, rythmes et niveaux des élèves, avec des tâches variées et un accompagnement personnalisé."
      },
      {
        value: 'objectifs',
        label: 'Pédagogie par objectifs',
        description: "L'apprentissage est organisé autour d'objectifs clairs (compétences à atteindre, comportements observables). Permet un suivi précis de la progression."
      },
      {
        value: 'problemes',
        label: 'Apprentissage par problèmes (ABP)',
        description: "Les élèves doivent résoudre un problème complexe ou répondre à une question de recherche en mobilisant différentes connaissances."
      },
      {
        value: 'inverse',
        label: 'Enseignement inversé',
        description: "La théorie est étudiée à la maison (vidéos, docs), et la classe sert à pratiquer, échanger, approfondir."
      },
      {
        value: 'jeu',
        label: 'Apprentissage par le jeu',
        description: "Utilisation de jeux éducatifs, simulations ou jeux de rôle pour faciliter l'acquisition de compétences scolaires et sociales."
      }
    ];

    const pedagogyDescription = pedagogies.find(p => p.value === data.pedagogy_type)?.description ?? data.pedagogy_type;
    const isEPS = data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') || data.subject.toLowerCase().includes('éducation physique');

    // Instruction renforcée pour Mistral
    const noMetaInstruction = aiConfig.model === 'mistral-medium-latest'
      ? `\n\n⚠️ INSTRUCTIONS STRICTES POUR LA SORTIE :
    1. **Ne génère AUCUNE section technique** comme "# Chat context", "# PERSONALIZATION INSTRUCTIONS", ou similaire.
    2. **Commence directement par le titre de la séance** (ex: "# 📚 [Titre...]").
    3. **Ne termine pas par des notes ou remarques**.
    4. **Utilise UNIQUEMENT du Markdown standard** (pas de HTML, pas de balises custom).
    5. **Respecte EXACTEMENT la structure demandée** sans ajout ni modification.
    6. **Ne génère AUCUN contenu en dehors de la structure Markdown fournie**.`
      : '';

    const prompt = `Tu es un expert en ingénierie pédagogique et en didactique de haut niveau. Tu conçois des séances d'enseignement conformes aux attendus institutionnels français, directement exploitables par un enseignant sans interprétation supplémentaire.

═══════════════════════════════════════════════════════════════
                    CONTEXTE DE LA SÉANCE
═══════════════════════════════════════════════════════════════

**Matière :** ${data.subject}
**Thème/Notion :** ${data.topic}
**Niveau :** ${data.level}
**Durée :** ${data.duration} minutes
**Approche pédagogique :** ${pedagogyDescription}

${data.documentContext ? `
═══════════════════════════════════════════════════════════════
            📎 DOCUMENT DE RÉFÉRENCE FOURNI
═══════════════════════════════════════════════════════════════

L'enseignant a fourni ce document de contexte. UTILISE-LE IMPÉRATIVEMENT pour :
- Aligner la séance avec les programmes officiels mentionnés
- Intégrer les compétences et objectifs spécifiques indiqués
- Respecter le niveau de difficulté et les prérequis décrits
- T'inspirer des exemples d'exercices ou d'activités fournis

CONTENU DU DOCUMENT :
---
${data.documentContext}
---
` : ''}
${ragContext}
═══════════════════════════════════════════════════════════════
        EXIGENCES PÉDAGOGIQUES NON NÉGOCIABLES
═══════════════════════════════════════════════════════════════

### 🎯 PRINCIPE 1 : CONSIGNES DOUBLEMENT STRUCTURÉES

Chaque activité DOIT comporter DEUX types de consignes distinctes :

**A) CONSIGNES ORGANISATIONNELLES (Comment s'organiser)**
- Organisation de l'espace (disposition des tables/élèves/matériel)
- Modalités de travail (individuel, binôme, groupe de X, collectif)
- Rôle précis de chaque acteur (enseignant, élèves, pairs/tuteurs)
- Gestion du temps (durées, rotations, transitions, signaux)
- Distribution et récupération du matériel

**B) CONSIGNES DE RÉUSSITE (Comment réussir la tâche)**
- Ce que l'élève doit FAIRE CONCRÈTEMENT pour réussir
- Ce qui est ATTENDU dans l'action ou la production
- Les CRITÈRES OBSERVABLES de réussite (ce qu'on doit voir/entendre/constater)
- Les ERREURS FRÉQUENTES à éviter (points de vigilance explicites)
- Les INDICATEURS DE RÉUSSITE pour l'auto-évaluation

⚠️ INTERDICTION : Aucune consigne ne doit rester générale, vague ou implicite.

---

### 🎯 PRINCIPE 2 : SITUATIONS D'APPRENTISSAGE OPÉRATIONNELLES

Chaque situation proposée DOIT être directement exploitable en classe avec :

**DÉROULEMENT PRÉCIS :**
- Étapes chronologiques numérotées
- Actions concrètes et observables
- Transitions entre les étapes

**ACTIONS ATTENDUES DES ÉLÈVES :**
- Verbes d'action précis (pas "comprendre" mais "identifier", "formuler", "justifier")
- Productions ou comportements attendus
- Traces écrites ou orales à produire

**INTERVENTIONS DE L'ENSEIGNANT :**
- Relances pour les élèves bloqués (formulations exactes)
- Régulations possibles en cours d'activité
- Aides méthodologiques et cognitives différenciées
- Questions de guidage graduées (du plus étayant au moins étayant)

**PROGRESSION LOGIQUE :**
- Entrée dans l'activité (mise en confiance, appropriation)
- Stabilisation (pratique guidée, entraînement)
- Complexification (transfert, autonomie)

---

### 🎯 PRINCIPE 3 : LIENS EXPLICITES AVEC LES PROGRAMMES

**OBLIGATOIRE pour chaque séance :**
- Citer les ATTENDUS DE FIN DE CYCLE précis (avec références BO)
- Formuler les compétences de manière OPÉRATIONNELLE (verbes d'action observables)
- Expliciter le lien avec le SOCLE COMMUN (domaines concernés)
- Justifier POURQUOI cette séance répond à ces attendus (pas juste les citer)

${isEPS ? `
═══════════════════════════════════════════════════════════════
          🏃 SPÉCIFICITÉS EPS - INSTRUCTIONS PRIORITAIRES
═══════════════════════════════════════════════════════════════

**IMPÉRATIFS DISCIPLINAIRES EPS :**

1. **75% MINIMUM D'ACTIVITÉ MOTRICE**
   - La séance doit être majoritairement composée d'exercices pratiques
   - Limiter les temps d'explication verbale (max 2-3 min consécutives)
   - Privilégier la démonstration et la pratique immédiate

2. **SITUATIONS MOTRICES CONTEXTUALISÉES**
   - Chaque situation doit avoir un BUT clair pour l'élève
   - Les exercices doivent être SIGNIFIANTS (pas de gestes isolés sans contexte)
   - Intégrer des situations de référence proches de la pratique sociale

3. **ORGANISATION MATÉRIELLE ET SPATIALE CENTRALE**
   - Schéma ou description précise de la disposition des ateliers
   - Circulation des élèves (sens, rotations, regroupements)
   - Gestion des rôles sociaux (observateur, juge, chronométreur, coach, pareur)

4. **CONSIGNES EPS SPÉCIFIQUES**
   - **Ce qu'il faut faire CORPORELLEMENT pour réussir** (placement, trajectoire, timing)
   - **Critères de RÉALISATION MOTRICE** (comment faire techniquement)
   - **Critères de RÉUSSITE MESURABLES** (score, temps, distance, précision)

5. **SÉCURITÉ ACTIVE ET PASSIVE**
   - Échauffement spécifique à l'APSA (articulaire + cardio + spécifique)
   - Consignes de sécurité intégrées à chaque situation
   - Parade et entraide entre élèves si nécessaire

6. **COMPÉTENCES MÉTHODOLOGIQUES ET SOCIALES**
   - Rôles sociaux explicites (arbitre, observateur, coach)
   - Outils d'observation fournis (fiches, grilles simples)
   - Temps de verbalisation des sensations et stratégies

**STRUCTURE TEMPORELLE EPS (${data.duration} min) :**
- Échauffement : 12-15 min (obligatoire et spécifique)
- Corps de séance (apprentissage moteur) : ${Math.floor(parseInt(data.duration) * 0.55)} min
- Situation complexe/jeu : ${Math.floor(parseInt(data.duration) * 0.2)} min  
- Retour au calme + bilan : 8-10 min
` : `
═══════════════════════════════════════════════════════════════
          📚 SPÉCIFICITÉS DISCIPLINAIRES - ${data.subject.toUpperCase()}
═══════════════════════════════════════════════════════════════

**IMPÉRATIFS POUR CETTE DISCIPLINE :**

1. **RIGUEUR DIDACTIQUE**
   - Vocabulaire disciplinaire précis et approprié au niveau ${data.level}
   - Progression du simple au complexe, du concret à l'abstrait
   - Articulation entre manipulation/observation et conceptualisation

2. **TRACES ÉCRITES STRUCTURÉES**
   - Préciser le moment et le contenu de l'institutionnalisation
   - Distinguer trace collective et trace individuelle
   - Indiquer les éléments à retenir explicitement

3. **ACTIVITÉ COGNITIVE DES ÉLÈVES**
   - Tâches qui engagent réellement la réflexion
   - Temps de recherche individuelle avant mise en commun
   - Confrontation des procédures et justification des réponses
`}

═══════════════════════════════════════════════════════════════
              STRUCTURE DE SORTIE OBLIGATOIRE
═══════════════════════════════════════════════════════════════

Génère la séance en respectant EXACTEMENT cette structure Markdown :

# 📚 [Titre accrocheur et explicite de la séance]
**Niveau :** ${data.level} | **Durée :** ${data.duration} min | **Matière :** ${data.subject}

---

## 🎯 Objectifs et ancrage institutionnel

### Objectif d'apprentissage principal
> [Formulation précise : "À l'issue de cette séance, l'élève sera capable de..." avec verbe d'action observable]

### Objectifs secondaires
- [Objectif 2 - verbe d'action + contenu + contexte]
- [Objectif 3 - verbe d'action + contenu + contexte]

### Ancrage dans les programmes officiels
| Référence | Attendu / Compétence |
|-----------|---------------------|
| Programme ${data.level} | [Attendu de fin de cycle précis] |
| Socle commun | [Domaine X : compétence visée] |
${isEPS ? '| Champ d\'apprentissage | [CA1/CA2/CA3/CA4 avec précision] |' : '| Compétence disciplinaire | [Référence programme] |'}

### Prérequis nécessaires
- [Ce que l'élève doit déjà savoir/savoir-faire - liste précise]

---

## 🛠️ Matériel et préparation

### Pour l'enseignant
- [Liste détaillée avec quantités]
- [Documents à préparer/photocopier]

### Pour les élèves
- [Matériel individuel]
- [Matériel collectif par groupe]

${isEPS ? `### Aménagement de l'espace
\`\`\`
[Schéma textuel de la disposition : terrain, ateliers, zones, circulation]
\`\`\`
- **Sécurité :** [Consignes spécifiques, zones interdites, parade]
- **Matériel sportif :** [Liste exhaustive avec quantités]` : `### Organisation spatiale
- [Configuration des tables/espaces selon la pédagogie ${data.pedagogy_type}]
- [Affichages nécessaires]`}

---

## ⏰ Déroulé détaillé de la séance

${isEPS ? `
### 🔥 **Phase 1 : Échauffement** — 12-15 min
> **Modalité :** Collectif puis vagues/binômes

#### Consignes organisationnelles
- **Espace :** [Disposition précise des élèves]
- **Signal de départ/arrêt :** [Coup de sifflet, musique, signal visuel]
- **Rotations :** [Sens de circulation, regroupements]

#### Déroulement
| Temps | Exercice | Consignes de réalisation | Critères de réussite |
|-------|----------|--------------------------|---------------------|
| 3 min | [Activation cardio] | [Consigne motrice précise] | [Observable] |
| 4 min | [Mobilisation articulaire] | [Consigne motrice précise] | [Observable] |
| 5 min | [Échauffement spécifique APSA] | [Consigne motrice précise] | [Observable] |

#### Interventions enseignant
- **Relance si passivité :** "[Formulation exacte]"
- **Correction posturale :** "[Formulation exacte]"

---

### 💪 **Phase 2 : Apprentissage moteur** — ${Math.floor(parseInt(data.duration) * 0.55)} min
> **Modalité :** [Ateliers/Vagues/Opposition]

#### Situation d'apprentissage 1 : [Nom explicite]
**But pour l'élève :** [Ce qu'il doit réussir à faire]

**Consignes organisationnelles :**
- Groupes de [X] élèves
- Disposition : [description précise]
- Rotation toutes les [X] min au signal [préciser]
- Rôles : [joueur/observateur/coach...]

**Consignes de réussite :**
- **Pour réussir, tu dois :** [action motrice précise]
- **Critère technique :** [placement, trajectoire, timing]
- **Tu as réussi si :** [observable mesurable]
- **Erreur fréquente à éviter :** [description et correction]

**Variables didactiques :**
| Pour simplifier | Pour complexifier |
|-----------------|-------------------|
| [Adaptation 1] | [Adaptation 1] |
| [Adaptation 2] | [Adaptation 2] |

**Interventions enseignant :**
- Si blocage : "[Question ou aide précise]"
- Pour les experts : "[Défi supplémentaire]"

#### Situation d'apprentissage 2 : [Nom explicite]
[Même structure détaillée]

---

### 🎯 **Phase 3 : Situation complexe / Match** — ${Math.floor(parseInt(data.duration) * 0.2)} min
> **Modalité :** [Opposition/Coopération]

**But :** [Application des apprentissages en situation de référence]

**Organisation :**
- [Équipes, terrains, rotations]
- **Rôles sociaux :** [Arbitre : règles à faire respecter] [Observateur : critère à observer]

**Consignes de réussite :**
- [Critère collectif de réussite]
- [Critère individuel de réussite]

**Fiche d'observation fournie :**
| Joueur | Critère 1 | Critère 2 | Remarques |
|--------|-----------|-----------|-----------|
| ... | ✓ / ✗ | ✓ / ✗ | ... |

---

### 🧘 **Phase 4 : Retour au calme et bilan** — 8-10 min
> **Modalité :** Collectif assis

**Récupération (5 min) :**
- [Étirements spécifiques avec consignes précises]
- [Exercices respiratoires]

**Bilan collectif (5 min) :**
- **Question 1 :** "Qu'avez-vous appris à faire aujourd'hui ?" → [Réponse attendue]
- **Question 2 :** "Qu'est-ce qui vous a aidé à réussir ?" → [Réponse attendue]
- **Question 3 :** "Quelle difficulté reste à travailler ?" → [Piste pour prochaine séance]

` : `
### 🚀 **Phase 1 : Entrée dans l'activité** — [X] min
> **Modalité :** [Individuel/Collectif]

#### Consignes organisationnelles
- **Disposition :** [Configuration précise de la classe]
- **Matériel distribué :** [Quoi, quand, comment]
- **Signal de début/fin :** [Préciser]

#### Situation déclenchante
**Accroche :** [Question, défi, problème, document surprenant - formulation exacte]

**Ce que font les élèves :**
1. [Action 1 - verbe précis]
2. [Action 2 - verbe précis]
3. [Production attendue]

**Consignes de réussite données aux élèves :**
> "[Formulation exacte de la consigne telle que dite aux élèves]"
- Tu as réussi si : [critère observable]
- Attention à : [erreur fréquente à éviter]

**Interventions enseignant :**
- Relance si blocage : "[Formulation exacte]"
- Validation intermédiaire : "[Ce qu'on valide, comment]"

---

### 🔍 **Phase 2 : Recherche / Investigation** — [X] min
> **Modalité :** [Individuel puis binômes/groupes]

#### Consignes organisationnelles
- **Temps individuel :** [X] min de recherche silencieuse
- **Mise en binôme/groupe :** [Comment, signal, placement]
- **Trace écrite :** [Support, contenu attendu]

#### Tâche proposée
**Énoncé exact :** "[Formulation précise de la consigne]"

**Ce que fait l'élève - étapes :**
1. [Étape 1 - action précise]
2. [Étape 2 - action précise]  
3. [Étape 3 - production]

**Consignes de réussite :**
- **Pour réussir, tu dois :** [action cognitive précise]
- **Ta réponse est correcte si :** [critères de validité]
- **Erreur fréquente :** [description] → **Correction :** [comment l'éviter]

**Aides graduées (différenciation) :**
| Niveau d'aide | Formulation |
|---------------|-------------|
| Aide 1 (légère) | "[Question de relance]" |
| Aide 2 (moyenne) | "[Indice méthodologique]" |
| Aide 3 (forte) | "[Étayage direct]" |

**Interventions enseignant :**
- Circule et observe : [Ce qu'on observe, erreurs typiques]
- Relance productive : "[Formulation]"
- Valorisation : "[Ce qu'on valorise explicitement]"

---

### 🏗️ **Phase 3 : Mise en commun / Structuration** — [X] min
> **Modalité :** Collectif

#### Consignes organisationnelles
- **Retour en configuration collective :** [Comment]
- **Supports de mise en commun :** [Tableau, affiche, vidéoprojecteur]

#### Déroulement
**Étape 1 - Recueil des propositions :**
- Sollicitation : "[Question exacte posée]"
- Réponses attendues : [Types de réponses, procédures]
- Notation au tableau : [Comment on organise]

**Étape 2 - Confrontation et validation :**
- "[Question de comparaison/justification]"
- Critères de validation explicités aux élèves

**Étape 3 - Institutionnalisation :**
> **Trace écrite collective :**
> [Contenu exact de ce qui est noté/dicté - formulation précise]

**Questions types pour guider :**
1. "[Question pour faire émerger la règle/notion]"
2. "[Question pour vérifier la compréhension]"
3. "[Question pour faire le lien avec les connaissances antérieures]"

---

### 📝 **Phase 4 : Entraînement / Application** — [X] min
> **Modalité :** Individuel

#### Consignes organisationnelles
- **Distribution :** [Exercices, support]
- **Temps imparti :** [Durée, signal de fin]
- **Attendu :** [Nombre d'exercices, qualité attendue]

#### Exercices proposés
**Exercice 1 (application directe) :**
[Énoncé complet]
- Critère de réussite : [Observable]

**Exercice 2 (transfert) :**
[Énoncé complet]
- Critère de réussite : [Observable]

**Exercice 3 (défi/approfondissement) :**
[Énoncé complet]
- Pour les élèves ayant terminé

**Correction :**
- [Modalité : auto-correction, correction collective, par les pairs]
- [Éléments de correction fournis]

---

### ✅ **Phase 5 : Bilan et clôture** — [X] min
> **Modalité :** Collectif

**Questions bilan :**
1. "Qu'avons-nous appris aujourd'hui ?" → [Réponse attendue]
2. "À quoi cela va-t-il nous servir ?" → [Lien avec la suite]
3. "Qu'est-ce qui était difficile ?" → [Identifier les obstacles]

**Annonce de la suite :**
- [Lien avec la prochaine séance]
`}

---

## 🎨 Différenciation pédagogique

### 🟢 Pour les élèves en difficulté
| Obstacle identifié | Adaptation proposée | Aide concrète |
|-------------------|---------------------|---------------|
| [Obstacle 1] | [Adaptation] | "[Formulation de l'aide]" |
| [Obstacle 2] | [Adaptation] | "[Formulation de l'aide]" |
| [Obstacle 3] | [Adaptation] | "[Formulation de l'aide]" |

### 🔵 Pour les élèves experts
| Enrichissement | Description | Consigne |
|----------------|-------------|----------|
| [Défi 1] | [Description] | "[Consigne exacte]" |
| [Défi 2] | [Description] | "[Consigne exacte]" |

### ♿ Adaptations inclusives
- **Troubles DYS :** [Adaptations spécifiques]
- **Troubles attentionnels :** [Adaptations spécifiques]
${isEPS ? '- **Handicap moteur :** [Adaptations motrices spécifiques]' : '- **Élèves allophones :** [Adaptations linguistiques]'}

---

## 📊 Évaluation

### Critères de réussite observables
| Critère | Indicateur observable | Niveau atteint |
|---------|----------------------|----------------|
| [Critère 1] | [Ce qu'on voit/entend] | 🔴 Non acquis / 🟡 En cours / 🟢 Acquis |
| [Critère 2] | [Ce qu'on voit/entend] | 🔴 / 🟡 / 🟢 |
| [Critère 3] | [Ce qu'on voit/entend] | 🔴 / 🟡 / 🟢 |

### Modalité d'évaluation
- **Type :** [Diagnostique/Formative/Sommative]
- **Outil :** [Grille d'observation / Auto-évaluation / Production]
${isEPS ? '- **Observation motrice :** [Critères techniques à observer]' : '- **Trace écrite analysée :** [Critères de correction]'}

---

## 💡 Anticipation et gestion de classe

### ⚠️ Difficultés prévisibles et remédiations
| Difficulté anticipée | Solution préparée |
|---------------------|-------------------|
| [Difficulté 1] | [Remédiation immédiate] |
| [Difficulté 2] | [Remédiation immédiate] |
| [Difficulté 3] | [Remédiation immédiate] |

### 🗣️ Formulations clés à utiliser
- **Pour lancer l'activité :** "[Formulation exacte]"
- **Pour relancer un élève :** "[Formulation exacte]"
- **Pour valider une réponse :** "[Formulation exacte]"
- **Pour institutionnaliser :** "[Formulation exacte]"

### ⏱️ Gestion du temps - Plan B
- Si retard : [Ce qu'on raccourcit/supprime]
- Si avance : [Ce qu'on ajoute]

---

## 📈 Prolongements

### Séance suivante
- [Objectif et lien de continuité]

### Interdisciplinarité
- [Liens concrets avec autres disciplines]

### Travail autonome possible
- [Activité réalisable en autonomie ou à la maison]

---

> **📚 Ressources complémentaires :** [Sites institutionnels, manuels, outils TICE]

═══════════════════════════════════════════════════════════════
              EXIGENCES QUALITÉ FINALES
═══════════════════════════════════════════════════════════════

✅ Chaque timing doit être précis et totaliser ${data.duration} minutes
✅ TOUTES les consignes sont doublement structurées (organisationnelles + réussite)
✅ Les situations sont OPÉRATIONNELLES (directement utilisables)
✅ Les liens avec les programmes sont EXPLICITES et JUSTIFIÉS
✅ La pédagogie ${data.pedagogy_type} transparaît dans TOUTES les modalités
✅ Les interventions enseignant sont FORMULÉES EXACTEMENT
✅ La différenciation est CONCRÈTE (pas de formules vagues)
${isEPS ? '✅ 75% minimum de temps en activité motrice effective' : '✅ Alternance judicieuse des modalités de travail'}
✅ Document exploitable IMMÉDIATEMENT sans interprétation
${noMetaInstruction}

Génère maintenant cette séance avec le niveau d'expertise attendu.`;

    // Construction du body
    let requestBody;

    if (aiConfig.isResponsesAPI) {
      requestBody = {
        model: aiConfig.model,
        input: prompt,
        max_output_tokens: 8000,
        text: {
          format: { type: "text" }
        },
        reasoning: {
          effort: "low"
        }
      };
    } else if (aiConfig.model === 'mistral-medium-latest') {
      requestBody = {
        model: aiConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 10000
      };
    } else {
      // Modèle par défaut
      requestBody = {
        model: aiConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      };
    }

    const response = await fetch(aiConfig.endpoint, {
      method: 'POST',
      headers: aiConfig.headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[lessons] ${aiConfig.model} API error:`, errorText);
      return new Response('OpenAI API Error', { 
        status: response.status, 
        headers: corsHeaders 
      });
    }

    const aiData = await response.json();

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
      content = aiData.choices?.[0]?.message?.content;
    }
    
    if (!content) {
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API OpenAI'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[lessons] Séance générée (${content.length} caractères) avec ${aiConfig.model}`);

    // Détermination explicite du contexte Mistral pour le nettoyage
    const isMistral = aiConfig.model === 'mistral-medium-latest';
    const cleanedContent = cleanOutputText(content, isMistral);

    return new Response(JSON.stringify({
      content: cleanedContent,
      usage: aiData.usage,
      ...(ragSources.length > 0 && { sources: ragSources }),
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8"
      }
    });

  } catch (error) {
    console.error('[lessons] Error:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
};

Deno.serve(lessonsHandler);



