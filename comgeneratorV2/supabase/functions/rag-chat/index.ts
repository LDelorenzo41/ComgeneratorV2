// supabase/functions/rag-chat/index.ts
// VERSION V6.2 "ADAPTIVE RECALL - DISCIPLINE ROUTING"
// Ajouts V6.2:
// - Routing multi-RAG par discipline (détection déterministe)
// - Filtrage conditionnel sur métadonnées discipline
// - Fallback automatique vers RAG global
// - Observabilité du routing

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Retrieval - valeurs de base
  vectorTopK: 50,
  ftsTopK: 50,
  rerankTopK: 12,
  
  // Seuils adaptatifs
  similarityThresholds: {
    strict: 0.35,
    normal: 0.25,
    relaxed: 0.18,
    minimal: 0.12,
  },
  
  // Objectifs de recall
  minDesiredChunks: 8,
  
  // Models
  embeddingModel: 'text-embedding-3-large',
  embeddingDimensions: 1536,
  chatModel: 'gpt-4o-mini',
  hydeModel: 'gpt-4o-mini',
  
  // Cohere
  cohereRerankModel: 'rerank-v3.5',
  
  // HyDE adaptatif
  hyde: {
    maxQueryLength: 100,
    conceptualPatterns: [
      'comment', 'pourquoi', 'expliquer', 'définir', 'différence',
      'quel est', 'quelle est', 'quels sont', 'quelles sont',
      'principe', 'objectif', 'but', 'rôle', 'fonction',
      'méthode', 'stratégie', 'approche', 'processus',
      'propose', 'donne', 'décris', 'présente',
    ],
    minConceptScore: 0.25,
  },
  
  // RRF Fusion
  rrf: {
    k: 60,
    vectorWeight: 1.0,
    ftsWeight: 0.9,
    dualSourceBonus: 1.25,
  },
  
  // Context assembly
  context: {
    maxChunksPerDocument: 5,
    redundancyThreshold: 0.80,
    excerptLength: 800,
  },
  
  // Limits
  maxHistoryMessages: 6,
  
  // Discipline Routing (NEW V6.2)
  disciplineRouting: {
    minConfidence: 0.6,
    minChunksForFiltered: 5, // Fallback si moins de chunks après filtrage
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPES
// ============================================================================

type ChatMode = 'corpus_only' | 'corpus_plus_ai';

interface ChatRequest {
  message: string;
  mode?: ChatMode;
  conversationId?: string;
  documentId?: string;
  usePersonalCorpus?: boolean;
  useProfAssistCorpus?: boolean;
  useAI?: boolean;
  levels?: string[];
  subjects?: string[];
  folderIds?: string[];
  debug?: boolean;
}

interface DocumentInfo {
  id: string;
  title: string;
  scope: string;
}

interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
  normalizedScore?: number;
  source: 'vector' | 'fts' | 'both';
}

interface RerankResult {
  chunk: RetrievedChunk;
  relevanceScore: number;
}

interface RetrievalMetrics {
  queryLength: number;
  hydeUsed: boolean;
  hydeReason?: string;
  similarityThreshold: number;
  vectorResultsRaw: number;
  vectorResultsFiltered: number;
  ftsResultsCount: number;
  fusedResultsCount: number;
  rerankResultsCount: number;
  filtersRelaxed: boolean;
  filterRelaxationLevel?: number;
  documentsSearched: number;
  totalDurationMs: number;
  retrievalPasses: number;
  // NEW V6.2
  disciplineDetected?: string | null;
  disciplineConfidence?: number;
  disciplineMode?: 'filtered' | 'global' | 'fallback';
}

// NEW V6.2: Type pour le résultat de détection de discipline
interface DisciplineDetection {
  discipline: string | null;
  confidence: number;
}

// ============================================================================
// CLIENTS
// ============================================================================

function createSupabaseClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// ============================================================================
// NEW V6.2: DISCIPLINE DETECTION (PURE FUNCTION - NO LLM)
// ============================================================================

/**
 * Dictionnaire des disciplines avec leurs patterns de détection
 * Chaque discipline a des mots-clés explicites et des patterns regex
 */
const DISCIPLINE_PATTERNS: Record<string, {
  explicit: string[];      // Mots-clés explicites (haute confiance)
  contextual: string[];    // Termes contextuels (confiance moyenne)
  regex?: RegExp[];        // Patterns regex optionnels
}> = {
  'EPS': {
    explicit: [
      'en eps', 'l\'eps', 'cours d\'eps', 'séance eps', 'programme eps',
      'éducation physique', 'sport scolaire', 'activité physique'
    ],
    contextual: [
      'motricité', 'échauffement', 'match', 'équipe sportive', 'course',
      'natation', 'gymnastique', 'athlétisme', 'jeux collectifs', 
      'handball', 'basketball', 'volleyball', 'football', 'rugby',
      'badminton', 'tennis de table', 'danse', 'escalade', 'combat',
      'performance motrice', 'savoir-nager', 'aisance aquatique',
      'champ d\'apprentissage', 'ca1', 'ca2', 'ca3', 'ca4', 'ca5',
      'compétence motrice', 'effort', 'entraînement'
    ],
    regex: [/\beps\b/i, /\bca[1-5]\b/i]
  },
  'Mathématiques': {
    explicit: [
      'en mathématiques', 'en maths', 'cours de maths', 'séance de mathématiques',
      'programme mathématiques', 'programme maths'
    ],
    contextual: [
      'calcul', 'géométrie', 'algèbre', 'équation', 'fonction', 'nombre',
      'fraction', 'pourcentage', 'proportion', 'théorème', 'démonstration',
      'trigonométrie', 'probabilité', 'statistique', 'algorithme',
      'résolution de problème', 'raisonnement mathématique', 'numération',
      'opération', 'multiplication', 'division', 'addition', 'soustraction',
      'pythagore', 'thalès', 'aire', 'périmètre', 'volume', 'mesure',
      'repère', 'coordonnées', 'vecteur', 'matrice', 'suite', 'limite'
    ]
  },
  'Français': {
    explicit: [
      'en français', 'cours de français', 'séance de français',
      'programme français', 'maîtrise de la langue'
    ],
    contextual: [
      'lecture', 'écriture', 'rédaction', 'orthographe', 'grammaire',
      'conjugaison', 'vocabulaire', 'compréhension de texte', 'expression écrite',
      'expression orale', 'dictée', 'poésie', 'littérature', 'roman',
      'nouvelle', 'théâtre', 'argumentation', 'dissertation', 'commentaire',
      'analyse littéraire', 'figure de style', 'narrateur', 'personnage',
      'syntaxe', 'ponctuation', 'accord', 'verbe', 'sujet', 'complément'
    ]
  },
  'Histoire-Géographie': {
    explicit: [
      'en histoire', 'en géographie', 'histoire-géographie', 'histoire-géo',
      'cours d\'histoire', 'cours de géographie', 'programme histoire',
      'en hggsp', 'hggsp'
    ],
    contextual: [
      'période historique', 'civilisation', 'guerre mondiale', 'révolution',
      'empire', 'monarchie', 'république', 'démocratie', 'colonisation',
      'territoire', 'carte', 'paysage', 'population', 'urbanisation',
      'mondialisation', 'développement durable', 'changement climatique',
      'géopolitique', 'frontière', 'migration', 'aménagement', 'espace',
      'antiquité', 'moyen âge', 'renaissance', 'lumières', 'contemporain',
      'chronologie', 'frise', 'source historique', 'document', 'patrimoine'
    ],
    regex: [/\bhggsp\b/i, /\bhistoire[- ]?géo/i]
  },
  'Sciences': {
    explicit: [
      'en sciences', 'en svt', 'sciences de la vie', 'sciences physiques',
      'cours de sciences', 'programme sciences', 'physique-chimie',
      'en physique', 'en chimie', 'en biologie'
    ],
    contextual: [
      'expérience', 'hypothèse', 'démarche scientifique', 'observation',
      'cellule', 'organisme', 'écosystème', 'biodiversité', 'évolution',
      'génétique', 'reproduction', 'nutrition', 'respiration', 'digestion',
      'énergie', 'matière', 'atome', 'molécule', 'réaction chimique',
      'électricité', 'magnétisme', 'optique', 'mécanique', 'force',
      'vitesse', 'accélération', 'température', 'pression', 'son', 'lumière',
      'circuit électrique', 'transformation', 'conservation'
    ],
    regex: [/\bsvt\b/i, /\bphysique[- ]?chimie\b/i]
  },
  'Langues vivantes': {
    explicit: [
      'en anglais', 'en espagnol', 'en allemand', 'en italien',
      'cours d\'anglais', 'cours de langue', 'langues vivantes',
      'lv1', 'lv2', 'langue étrangère'
    ],
    contextual: [
      'compréhension orale', 'expression orale', 'compréhension écrite',
      'expression écrite', 'interaction orale', 'médiation',
      'cecrl', 'niveau a1', 'niveau a2', 'niveau b1', 'niveau b2',
      'vocabulaire anglais', 'grammar', 'pronunciation', 'fluency',
      'phonologie', 'lexique', 'communication'
    ],
    regex: [/\blv[12]\b/i, /\bcecrl\b/i]
  },
  'Arts': {
    explicit: [
      'en arts plastiques', 'éducation musicale', 'éducation artistique',
      'cours d\'arts', 'histoire des arts', 'musique'
    ],
    contextual: [
      'création artistique', 'œuvre', 'artiste', 'technique artistique',
      'peinture', 'sculpture', 'dessin', 'collage', 'photographie',
      'installation', 'performance', 'composition', 'mélodie', 'rythme',
      'harmonie', 'instrument', 'chant', 'chorale', 'écoute musicale',
      'expression artistique', 'culture artistique', 'peac'
    ],
    regex: [/\bpeac\b/i]
  },
  'EMC': {
    explicit: [
      'en emc', 'enseignement moral et civique', 'éducation civique',
      'éducation morale', 'parcours citoyen'
    ],
    contextual: [
      'citoyenneté', 'valeurs républicaines', 'laïcité', 'droits',
      'devoirs', 'engagement', 'solidarité', 'discrimination', 'égalité',
      'fraternité', 'liberté', 'démocratie', 'vote', 'institution',
      'justice', 'respect', 'tolérance', 'débat', 'argumentation civique'
    ],
    regex: [/\bemc\b/i]
  },
  'Technologie': {
    explicit: [
      'en technologie', 'cours de technologie', 'programme technologie'
    ],
    contextual: [
      'objet technique', 'conception', 'fabrication', 'prototype',
      'cahier des charges', 'fonction technique', 'matériaux',
      'énergie', 'information', 'programmation', 'robotique',
      'arduino', 'scratch', 'maquette', 'modélisation 3d',
      'chaîne d\'énergie', 'chaîne d\'information', 'automatisme'
    ]
  },
  'SNT': {
    explicit: [
      'en snt', 'sciences numériques', 'numérique et sciences informatiques',
      'nsi', 'informatique'
    ],
    contextual: [
      'algorithme', 'programmation', 'python', 'données', 'réseau',
      'internet', 'web', 'cybersécurité', 'intelligence artificielle',
      'base de données', 'html', 'css', 'javascript', 'code',
      'variable', 'boucle', 'condition', 'fonction informatique'
    ],
    regex: [/\bsnt\b/i, /\bnsi\b/i]
  }
};

// ============================================================================
// SYNONYMES ÉDUCATIFS (pour expansion de requête)
// ============================================================================

const EDUCATION_SYNONYMS: Record<string, string[]> = {
  // Pédagogie & didactique
  'sequence': ['seance', 'progression', 'unite', 'module'],
  'seance': ['sequence', 'cours', 'activite', 'session'],
  'evaluation': ['controle', 'examen', 'devoir', 'test', 'notation', 'bilan'],
  'competence': ['capacite', 'aptitude', 'savoir-faire', 'acquis'],
  'objectif': ['attendu', 'but', 'finalite', 'visee'],
  'differentiation': ['adaptation', 'personnalisation', 'remediation', 'individualisation'],
  'remediation': ['soutien', 'aide', 'accompagnement', 'differentiation'],
  'programme': ['referentiel', 'curriculum', 'socle', 'attendus'],
  'socle': ['programme', 'referentiel', 'competences', 'attendus'],

  // Niveaux scolaires
  'cycle': ['niveau', 'classe', 'annee'],
  'primaire': ['elementaire', 'cp', 'ce1', 'ce2', 'cm1', 'cm2'],
  'college': ['6eme', '5eme', '4eme', '3eme', 'secondaire'],
  'lycee': ['seconde', 'premiere', 'terminale', 'secondaire'],
  'maternelle': ['petite section', 'moyenne section', 'grande section'],

  // Élèves & inclusion
  'eleve': ['apprenant', 'enfant', 'etudiant'],
  'inclusion': ['accessibilite', 'adaptation', 'handicap', 'ulis', 'segpa'],
  'difficulte': ['besoin', 'trouble', 'obstacle', 'blocage'],
  'trouble': ['dys', 'dyslexie', 'dyspraxie', 'tdah', 'tsa'],
  'motivation': ['engagement', 'interet', 'implication', 'participation'],

  // Pratiques pédagogiques
  'projet': ['tache complexe', 'situation probleme', 'realisation'],
  'groupe': ['equipe', 'binome', 'collectif', 'cooperatif', 'collaboratif'],
  'autonomie': ['independance', 'autoregulation', 'initiative'],
  'oral': ['prise de parole', 'expose', 'debat', 'presentation'],
  'ecrit': ['redaction', 'production', 'expression ecrite', 'trace ecrite'],

  // Numérique éducatif
  'numerique': ['digital', 'tice', 'informatique', 'tablette', 'ordinateur'],
  'outil': ['ressource', 'support', 'materiel', 'logiciel', 'application'],

  // Organisation scolaire
  'conseil': ['reunion', 'concertation', 'equipe pedagogique'],
  'parcours': ['peac', 'parcours citoyen', 'parcours avenir', 'parcours sante'],
  'interdisciplinaire': ['transversal', 'pluridisciplinaire', 'epi', 'croisement'],
};

/**
 * Extrait les mots-clés significatifs d'une requête (sans stop words)
 */
function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais',
    'donc', 'car', 'ni', 'que', 'qui', 'quoi', 'dont', 'ou', 'ce', 'cette',
    'ces', 'mon', 'ton', 'son', 'notre', 'votre', 'leur', 'je', 'tu', 'il',
    'elle', 'nous', 'vous', 'ils', 'elles', 'on', 'se', 'sa', 'ses', 'aux',
    'est', 'sont', 'etre', 'avoir', 'fait', 'faire', 'dit', 'dire', 'peut',
    'peux', 'sur', 'sous', 'dans', 'pour', 'par', 'avec', 'sans', 'chez',
    'entre', 'vers', 'plus', 'moins', 'tres', 'tout', 'tous', 'toute',
    'toutes', 'autre', 'autres', 'meme', 'aussi', 'bien', 'encore', 'alors',
    'ainsi', 'comme', 'comment', 'pourquoi', 'quand', 'si', 'ne', 'pas',
    'quel', 'quelle', 'quels', 'quelles',
    'propose', 'donne', 'montre', 'presente', 'fais', 'decris',
    'document', 'fichier', 'information',
  ]);

  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .map(word => word.replace(/[^a-z0-9-]/g, ''))
    .filter(word => word.length >= 3 && !stopWords.has(word));
}

/**
 * Extrait les mots-clés et ajoute leurs synonymes éducatifs
 */
function extractKeywordsWithSynonyms(query: string): string[] {
  const baseKeywords = extractKeywords(query);
  const allKeywords = new Set(baseKeywords);

  for (const keyword of baseKeywords) {
    if (EDUCATION_SYNONYMS[keyword]) {
      for (const synonym of EDUCATION_SYNONYMS[keyword]) {
        const normalized = synonym
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '');
        allKeywords.add(normalized);
      }
    }
  }

  return Array.from(allKeywords);
}

/**
 * Expand une requête avec les synonymes éducatifs pour l'embedding
 */
function expandQueryWithSynonyms(query: string): string {
  const keywords = extractKeywords(query);
  const expansions: string[] = [];

  for (const keyword of keywords) {
    if (EDUCATION_SYNONYMS[keyword]) {
      expansions.push(...EDUCATION_SYNONYMS[keyword].slice(0, 4));
    }
  }

  const unique = [...new Set(expansions)].slice(0, 8);
  if (unique.length > 0) {
    return `${query} (${unique.join(', ')})`;
  }
  return query;
}

// ============================================================================
// CORRECTION FUZZY (fautes de frappe)
// ============================================================================

/**
 * Vocabulaire éducatif de référence pour la correction fuzzy.
 * Mots fréquents dans le contexte scolaire français.
 */
const EDUCATION_VOCABULARY: string[] = [
  // Sport / EPS
  'terrain', 'natation', 'athletisme', 'gymnase', 'course', 'relais',
  'endurance', 'vitesse', 'lancer', 'saut', 'dribble', 'arbitre',
  'echauffement', 'match', 'equipe', 'exercice', 'entrainement',
  'parcours', 'obstacle', 'jeux', 'ballon', 'raquette', 'piscine',
  // Mathématiques
  'fraction', 'geometrie', 'calcul', 'multiplication', 'division',
  'addition', 'soustraction', 'nombre', 'equation', 'triangle',
  'rectangle', 'cercle', 'mesure', 'perimetre', 'surface', 'volume',
  'symetrie', 'proportionnalite', 'statistiques', 'probabilite',
  // Français
  'grammaire', 'conjugaison', 'orthographe', 'vocabulaire', 'lecture',
  'ecriture', 'redaction', 'dictee', 'syntaxe', 'adjectif', 'verbe',
  'adverbe', 'pronom', 'determinant', 'complement', 'sujet', 'accord',
  'phrase', 'paragraphe', 'texte', 'poesie', 'recit', 'conte',
  // Sciences
  'experience', 'electricite', 'magnetisme', 'photosynthese',
  'digestion', 'respiration', 'reproduction', 'ecosysteme',
  'biodiversite', 'energie', 'matiere', 'vivant', 'cellule',
  'molecule', 'atome', 'temperature', 'circuit',
  // Pédagogie
  'sequence', 'seance', 'evaluation', 'competence', 'objectif',
  'differentiation', 'remediation', 'programme', 'progression',
  'apprentissage', 'activite', 'consigne', 'situation', 'dispositif',
  'autonomie', 'cooperation', 'manipulation', 'observation',
  'classement', 'comparaison', 'hypothese', 'validation',
  // Niveaux / Organisation
  'maternelle', 'elementaire', 'college', 'lycee', 'primaire',
  'trimestre', 'semestre', 'periode', 'emploi', 'planning',
  // Disciplines
  'histoire', 'geographie', 'musique', 'arts', 'sciences',
  'technologie', 'informatique', 'anglais', 'allemand', 'espagnol',
  'education', 'civique', 'morale', 'philosophie',
  // DDC / Danse
  'danse', 'creation', 'choregraphie', 'mouvement', 'espace',
  'rythme', 'improvisation', 'composition', 'spectacle', 'corps',
  'expression', 'gestuelle', 'posture', 'deplacement',
];

/**
 * Distance de Levenshtein entre deux chaînes
 */
function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Optimisation : une seule ligne de la matrice
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let curr = new Array(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[lb];
}

/**
 * Tente de corriger un mot en trouvant le mot le plus proche
 * dans le vocabulaire éducatif. Retourne le mot original si
 * aucune correction convaincante n'est trouvée.
 *
 * Seuils :
 * - mots de 4-5 lettres : distance max 1
 * - mots de 6-8 lettres : distance max 2
 * - mots de 9+ lettres  : distance max 3
 */
function fuzzyCorrectWord(word: string): { corrected: string; wasFixed: boolean } {
  const normalized = word.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Ne pas corriger les mots trop courts ou les acronymes
  if (normalized.length < 4 || /^[A-Z]{2,}$/.test(word)) {
    return { corrected: word, wasFixed: false };
  }

  // Si le mot est déjà dans le vocabulaire, pas de correction
  if (EDUCATION_VOCABULARY.includes(normalized)) {
    return { corrected: word, wasFixed: false };
  }

  // Seuil dynamique selon la longueur du mot
  const maxDistance = normalized.length <= 5 ? 1 : normalized.length <= 8 ? 2 : 3;

  let bestMatch = '';
  let bestDistance = maxDistance + 1;

  for (const vocabWord of EDUCATION_VOCABULARY) {
    // Optimisation : ignorer si la différence de longueur est > maxDistance
    if (Math.abs(vocabWord.length - normalized.length) > maxDistance) continue;

    const dist = levenshteinDistance(normalized, vocabWord);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = vocabWord;
    }
    if (dist === 1) break; // Distance 1 = correction quasi-certaine
  }

  if (bestMatch && bestDistance <= maxDistance) {
    return { corrected: bestMatch, wasFixed: true };
  }

  return { corrected: word, wasFixed: false };
}

/**
 * Corrige les fautes de frappe dans une requête complète.
 * Retourne la requête corrigée et la liste des corrections appliquées.
 */
function fuzzyCorrectQuery(query: string): { corrected: string; corrections: string[] } {
  const words = query.split(/(\s+|[.,;:!?'"()\[\]{}])/); // Préserve les espaces et ponctuation
  const corrections: string[] = [];

  const correctedWords = words.map(token => {
    // Ne pas toucher aux espaces/ponctuation
    if (/^[\s.,;:!?'"()\[\]{}]+$/.test(token) || token.length < 4) {
      return token;
    }

    const { corrected, wasFixed } = fuzzyCorrectWord(token);
    if (wasFixed) {
      corrections.push(`${token}→${corrected}`);
      return corrected;
    }
    return token;
  });

  return {
    corrected: correctedWords.join(''),
    corrections,
  };
}

/**
 * Normalise une chaîne pour la comparaison
 */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/['']/g, "'")           // Normalise les apostrophes
    .trim();
}

/**
 * Détecte la discipline d'une requête de manière déterministe
 * Fonction PURE: pas d'appel LLM, uniquement règles et patterns
 * 
 * @param query - La requête utilisateur
 * @returns {discipline, confidence} - Discipline détectée et niveau de confiance
 */
function detectDiscipline(query: string): DisciplineDetection {
  const normalizedQuery = normalizeForMatch(query);
  
  let bestMatch: { discipline: string; confidence: number } | null = null;
  
  for (const [discipline, patterns] of Object.entries(DISCIPLINE_PATTERNS)) {
    let score = 0;
    let matchCount = 0;
    
    // 1. Vérification des patterns explicites (haute confiance: 0.9)
    for (const explicit of patterns.explicit) {
      const normalizedPattern = normalizeForMatch(explicit);
      if (normalizedQuery.includes(normalizedPattern)) {
        score = Math.max(score, 0.9);
        matchCount++;
      }
    }
    
    // 2. Vérification des regex si définis (haute confiance: 0.85)
    if (patterns.regex) {
      for (const regex of patterns.regex) {
        if (regex.test(query)) {
          score = Math.max(score, 0.85);
          matchCount++;
        }
      }
    }
    
    // 3. Vérification des termes contextuels (confiance variable selon nombre)
    let contextualMatches = 0;
    for (const contextual of patterns.contextual) {
      const normalizedContextual = normalizeForMatch(contextual);
      // Vérifier que c'est un mot complet (pas une sous-chaîne)
      const wordBoundaryRegex = new RegExp(`\\b${normalizedContextual.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (wordBoundaryRegex.test(normalizedQuery)) {
        contextualMatches++;
      }
    }
    
    // Calcul du score contextuel
    if (contextualMatches >= 3) {
      score = Math.max(score, 0.75);
    } else if (contextualMatches >= 2) {
      score = Math.max(score, 0.55);
    } else if (contextualMatches === 1 && score < 0.5) {
      score = Math.max(score, 0.35);
    }
    
    // Bonus si multiple types de matches
    if (matchCount > 1 || (matchCount >= 1 && contextualMatches >= 1)) {
      score = Math.min(score + 0.05, 0.95);
    }
    
    // Garder le meilleur match
    if (score > 0 && (!bestMatch || score > bestMatch.confidence)) {
      bestMatch = { discipline, confidence: score };
    }
  }
  
  // Retourner le résultat
  if (bestMatch && bestMatch.confidence >= 0.3) {
    return bestMatch;
  }
  
  return { discipline: null, confidence: 0 };
}

/**
 * Mappe le nom de discipline détecté vers la valeur stockée en métadonnées
 * Adapte selon votre schéma de données
 */
function mapDisciplineToMetadata(discipline: string): string[] {
  const mapping: Record<string, string[]> = {
    'EPS': ['EPS', 'eps', 'Éducation physique et sportive'],
    'Mathématiques': ['Mathématiques', 'Maths', 'maths', 'mathematiques'],
    'Français': ['Français', 'français', 'Francais', 'francais'],
    'Histoire-Géographie': ['Histoire-Géographie', 'Histoire', 'Géographie', 'HGGSP', 'hggsp', 'histoire-géographie'],
    'Sciences': ['Sciences', 'SVT', 'Physique-Chimie', 'physique-chimie', 'svt', 'sciences'],
    'Langues vivantes': ['Langues vivantes', 'Anglais', 'Espagnol', 'Allemand', 'LV1', 'LV2'],
    'Arts': ['Arts plastiques', 'Éducation musicale', 'Arts', 'arts'],
    'EMC': ['EMC', 'emc', 'Enseignement moral et civique'],
    'Technologie': ['Technologie', 'technologie'],
    'SNT': ['SNT', 'NSI', 'snt', 'nsi', 'Sciences numériques'],
  };
  
  return mapping[discipline] || [discipline];
}

// ============================================================================
// STEP 1: QUERY ANALYSIS & HyDE ADAPTATIF
// ============================================================================

interface HyDEDecision {
  shouldUse: boolean;
  reason: string;
  conceptScore: number;
}

/**
 * Analyse sémantique pour décider si HyDE est nécessaire
 */
function analyzeQueryForHyDE(query: string): HyDEDecision {
  const trimmed = query.trim().toLowerCase();
  const length = trimmed.length;
  
  // 1. Requête très courte → HyDE utile
  if (length < 40) {
    return { shouldUse: true, reason: 'short_query', conceptScore: 1.0 };
  }
  
  // 2. Requête très longue et spécifique → probablement pas besoin
  if (length > 250) {
    return { shouldUse: false, reason: 'long_specific_query', conceptScore: 0.1 };
  }
  
  // 3. Analyse des patterns conceptuels
  let conceptScore = 0;
  const patterns = CONFIG.hyde.conceptualPatterns;
  
  for (const pattern of patterns) {
    if (trimmed.includes(pattern)) {
      conceptScore += 0.2;
    }
  }
  
  // 4. Détection de questions ouvertes
  if (trimmed.startsWith('qu') || trimmed.startsWith('comment') || 
      trimmed.startsWith('pourquoi') || trimmed.includes('?')) {
    conceptScore += 0.15;
  }
  
  // 5. Demande de génération/proposition
  if (trimmed.includes('propose') || trimmed.includes('donne') || 
      trimmed.includes('suggère') || trimmed.includes('exemple')) {
    conceptScore += 0.2;
  }
  
  // 5. Absence de termes très spécifiques (noms propres, acronymes, numéros)
  const hasSpecificTerms = /\b[A-Z]{2,}\b|\b\d{4,}\b|article\s+\d+/i.test(query);
  if (!hasSpecificTerms) {
    conceptScore += 0.1;
  }
  
  conceptScore = Math.min(conceptScore, 1.0);
  
  // Décision finale
  if (length < CONFIG.hyde.maxQueryLength && conceptScore >= CONFIG.hyde.minConceptScore) {
    return { shouldUse: true, reason: 'conceptual_query', conceptScore };
  }
  
  if (conceptScore >= 0.5) {
    return { shouldUse: true, reason: 'high_concept_score', conceptScore };
  }
  
  return { shouldUse: false, reason: 'specific_query', conceptScore };
}

/**
 * HyDE: Génère un document hypothétique pour améliorer l'embedding
 */
async function generateHyDE(
  query: string,
  apiKey: string
): Promise<{ hydeText: string; tokensUsed: number }> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.hydeModel,
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en éducation française. 
Génère un paragraphe détaillé (4-6 phrases) qui RÉPOND à la question de l'utilisateur, 
comme si tu citais un document officiel de l'Éducation Nationale ou un programme scolaire.
Inclus du vocabulaire technique et des termes spécifiques au domaine éducatif.
Ne dis pas "je" ou "selon moi". Écris comme un texte de référence factuel.`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    const hydeText = data.choices?.[0]?.message?.content || query;
    const tokensUsed = data.usage?.total_tokens || 0;

    return { hydeText, tokensUsed };
  } catch (error) {
    console.warn('[HyDE] Failed, using original query:', error);
    return { hydeText: query, tokensUsed: 0 };
  }
}

/**
 * Extrait les mots-clés significatifs pour la recherche FTS
 * Version améliorée: préserve les termes importants
 */
function extractSearchTerms(query: string): string {
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux',
    'ce', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
    'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
    'qui', 'que', 'quoi', 'dont', 'où', 'quand', 'comment', 'pourquoi',
    'est', 'sont', 'était', 'être', 'avoir', 'fait', 'faire',
    'pour', 'dans', 'avec', 'sur', 'sous', 'par', 'entre',
    'plus', 'moins', 'très', 'bien', 'aussi', 'encore',
    'tout', 'tous', 'toute', 'toutes', 'autre', 'autres',
    'quel', 'quelle', 'quels', 'quelles', 'peut', 'doit',
    'moi', 'toi', 'lui', 'elle', 'nous', 'vous', 'eux', 'elles',
    'cela', 'ceci', 'celui', 'celle', 'ceux', 'celles',
    'donc', 'car', 'mais', 'or', 'ni', 'soit',
    'propose', 'donne', 'montre', 'presente', 'fais',
  ]);

  // Préserver les acronymes (ex: PPMS, PAP, PAI, EPS, CA)
  const acronyms = query.match(/\b[A-Z]{2,}\b/g) || [];
  
  const words = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9àâäéèêëïîôùûüç-]+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const allTerms = [...new Set([...acronyms.map(a => a.toLowerCase()), ...words])];
  return allTerms.slice(0, 15).join(' | '); // Utiliser OR pour FTS
}

// ============================================================================
// STEP 2: DOCUMENT FILTERING AVEC RELAXATION PROGRESSIVE
// ============================================================================

interface FilterResult {
  docsMap: Map<string, DocumentInfo>;
  relaxationLevel: number;
  filtersApplied: {
    levels: boolean;
    subjects: boolean;
  };
}

async function getAllowedDocumentsProgressive(
  supabase: any,
  userId: string,
  options: {
    documentId?: string;
    usePersonalCorpus: boolean;
    useProfAssistCorpus: boolean;
    levels?: string[];
    subjects?: string[];
    folderIds?: string[];
  }
): Promise<FilterResult> {
  const { documentId, usePersonalCorpus, useProfAssistCorpus, levels, subjects, folderIds } = options;
  
  if (!usePersonalCorpus && !useProfAssistCorpus) {
    return { 
      docsMap: new Map(), 
      relaxationLevel: 0,
      filtersApplied: { levels: false, subjects: false }
    };
  }

  // Fonction helper pour construire la requête de base
  const buildBaseQuery = () => {
    let query = supabase
      .from('rag_documents')
      .select('id, title, scope, user_id, levels, subjects')
      .eq('status', 'ready');

    if (documentId) {
      query = query.eq('id', documentId);
    } else {
      if (usePersonalCorpus && useProfAssistCorpus) {
        query = query.or(`scope.eq.global,and(scope.eq.user,user_id.eq.${userId})`);
      } else if (useProfAssistCorpus) {
        query = query.eq('scope', 'global');
      } else if (usePersonalCorpus) {
        query = query.eq('scope', 'user').eq('user_id', userId);
      }
      // Filtrer par dossier si spécifié (uniquement pour les documents personnels)
      if (folderIds?.length && usePersonalCorpus) {
        query = query.in('folder_id', folderIds);
      }
    }
    return query;
  };

  // Niveau 0: Filtres stricts (levels ET subjects)
  if (levels?.length && subjects?.length) {
    const query = buildBaseQuery()
      .overlaps('levels', levels)
      .overlaps('subjects', subjects);
    
    const { data } = await query;
    if (data && data.length >= 3) {
      const docsMap = new Map<string, DocumentInfo>();
      data.forEach((d: any) => docsMap.set(d.id, d));
      console.log(`[Filters] Level 0 (strict): ${docsMap.size} documents`);
      return { 
        docsMap, 
        relaxationLevel: 0,
        filtersApplied: { levels: true, subjects: true }
      };
    }
  }

  // Niveau 1: Seulement levels OU seulement subjects
  if (levels?.length || subjects?.length) {
    let query = buildBaseQuery();
    
    if (levels?.length) {
      query = query.overlaps('levels', levels);
    } else if (subjects?.length) {
      query = query.overlaps('subjects', subjects);
    }
    
    const { data } = await query;
    if (data && data.length >= 2) {
      const docsMap = new Map<string, DocumentInfo>();
      data.forEach((d: any) => docsMap.set(d.id, d));
      console.log(`[Filters] Level 1 (partial): ${docsMap.size} documents`);
      return { 
        docsMap, 
        relaxationLevel: 1,
        filtersApplied: { levels: !!levels?.length, subjects: !!subjects?.length && !levels?.length }
      };
    }
  }

  // Niveau 2: Aucun filtre de métadonnées
  const query = buildBaseQuery();
  const { data, error } = await query;

  if (error) {
    console.error('[Documents] Query error:', error);
    return { 
      docsMap: new Map(), 
      relaxationLevel: 2,
      filtersApplied: { levels: false, subjects: false }
    };
  }

  const docsMap = new Map<string, DocumentInfo>();
  (data || []).forEach((d: any) => docsMap.set(d.id, d));
  console.log(`[Filters] Level 2 (relaxed): ${docsMap.size} documents`);
  
  return { 
    docsMap, 
    relaxationLevel: 2,
    filtersApplied: { levels: false, subjects: false }
  };
}

// ============================================================================
// STEP 3: RETRIEVAL AVEC FIX DES IDs ET FILTRAGE DISCIPLINE (V6.2)
// ============================================================================

/**
 * Génère un ID unique pour un chunk basé sur son contenu et document
 */
function generateChunkId(item: any, index: number): string {
  // Essayer plusieurs champs possibles pour l'ID
  if (item.id) return String(item.id);
  if (item.chunk_id) return String(item.chunk_id);
  
  // Fallback: générer un ID basé sur document + index
  const docId = item.document_id || 'unknown';
  const chunkIdx = item.chunk_index ?? index;
  return `${docId}_chunk_${chunkIdx}`;
}

/**
 * V6.2: Filtre les documents par discipline (soft filter sur allowedDocIds)
 */
async function filterDocumentsByDiscipline(
  supabase: any,
  allowedDocIds: string[],
  disciplineValues: string[]
): Promise<string[]> {
  if (allowedDocIds.length === 0 || disciplineValues.length === 0) {
    return allowedDocIds;
  }

  try {
    // Requête pour filtrer les documents par subject/discipline
    const { data, error } = await supabase
      .from('rag_documents')
      .select('id')
      .in('id', allowedDocIds)
      .overlaps('subjects', disciplineValues);

    if (error) {
      console.warn('[Discipline Filter] Query error, using all docs:', error.message);
      return allowedDocIds;
    }

    const filteredIds = (data || []).map((d: any) => d.id);
    return filteredIds;
  } catch (err) {
    console.warn('[Discipline Filter] Exception, using all docs:', err);
    return allowedDocIds;
  }
}

async function searchByVector(
  supabase: any,
  userId: string,
  embedding: number[],
  allowedDocIds: string[],
  threshold: number,
  topK: number
): Promise<{ chunks: RetrievedChunk[]; rawCount: number }> {
  if (allowedDocIds.length === 0) return { chunks: [], rawCount: 0 };

  const { data, error } = await supabase.rpc('match_rag_chunks', {
    p_query_embedding: `[${embedding.join(',')}]`,
    p_similarity_threshold: threshold,
    p_match_count: topK,
    p_user_id: userId,
    p_document_id: null,
  });

  if (error) {
    console.error('[Vector Search] Error:', error);
    return { chunks: [], rawCount: 0 };
  }

  const rawCount = data?.length || 0;
  const allowedSet = new Set(allowedDocIds);
  
  const chunks = (data || [])
    .filter((item: any) => allowedSet.has(item.document_id))
    .map((item: any, index: number) => ({
      id: generateChunkId(item, index),
      documentId: item.document_id,
      documentTitle: item.document_title || '',
      chunkIndex: item.chunk_index ?? index,
      content: item.content,
      score: item.similarity,
      source: 'vector' as const,
    }));

  return { chunks, rawCount };
}

async function searchByFTS(
  supabase: any,
  searchTerms: string,
  allowedDocIds: string[],
  limit: number
): Promise<RetrievedChunk[]> {
  if (allowedDocIds.length === 0 || !searchTerms.trim()) return [];

  try {
    const { data, error } = await supabase.rpc('search_rag_chunks_fts', {
      p_query: searchTerms,
      p_document_ids: allowedDocIds,
      p_limit: limit,
    });

    if (error) {
      console.error('[FTS Search] Error:', error.message);
      return [];
    }

    return (data || []).map((item: any, index: number) => ({
      id: generateChunkId(item, index),
      documentId: item.document_id,
      documentTitle: item.document_title || '',
      chunkIndex: item.chunk_index ?? index,
      content: item.content,
      score: item.rank || 0.5,
      source: 'fts' as const,
    }));
  } catch (err) {
    console.error('[FTS Search] Exception:', err);
    return [];
  }
}

/**
 * Retrieval adaptatif avec plusieurs passes si nécessaire
 * V6.2: Supporte le filtrage par discipline avec fallback
 */
async function adaptiveRetrieval(
  supabase: any,
  userId: string,
  embedding: number[],
  searchTerms: string,
  allowedDocIds: string[],
  disciplineFilter?: {
    discipline: string;
    disciplineValues: string[];
    confidence: number;
  }
): Promise<{ 
  vectorResults: RetrievedChunk[]; 
  ftsResults: RetrievedChunk[]; 
  threshold: number; 
  passes: number;
  rawVectorCount: number;
  disciplineMode: 'filtered' | 'global' | 'fallback';
}> {
  
  const thresholds = [
    CONFIG.similarityThresholds.normal,
    CONFIG.similarityThresholds.relaxed,
    CONFIG.similarityThresholds.minimal,
  ];
  
  let vectorResults: RetrievedChunk[] = [];
  let rawVectorCount = 0;
  let usedThreshold = thresholds[0];
  let passes = 0;
  let disciplineMode: 'filtered' | 'global' | 'fallback' = 'global';
  
  // V6.2: Déterminer les documents à utiliser (avec ou sans filtre discipline)
  let effectiveDocIds = allowedDocIds;
  
  if (disciplineFilter && disciplineFilter.confidence >= CONFIG.disciplineRouting.minConfidence) {
    const filteredDocIds = await filterDocumentsByDiscipline(
      supabase,
      allowedDocIds,
      disciplineFilter.disciplineValues
    );
    
    if (filteredDocIds.length > 0) {
      effectiveDocIds = filteredDocIds;
      disciplineMode = 'filtered';
      console.log(`[Routing] Discipline=${disciplineFilter.discipline} | confidence=${disciplineFilter.confidence.toFixed(2)} | mode=filtered | docs=${filteredDocIds.length}/${allowedDocIds.length}`);
    } else {
      console.log(`[Routing] Discipline=${disciplineFilter.discipline} | No matching docs, using global`);
    }
  }
  
  // FTS en parallèle (ne dépend pas du threshold)
  const ftsPromise = searchByFTS(supabase, searchTerms, effectiveDocIds, CONFIG.ftsTopK);
  
  // Retrieval adaptatif pour vector search
  for (const threshold of thresholds) {
    passes++;
    const result = await searchByVector(
      supabase,
      userId,
      embedding,
      effectiveDocIds,
      threshold,
      CONFIG.vectorTopK
    );
    
    vectorResults = result.chunks;
    rawVectorCount = result.rawCount;
    usedThreshold = threshold;
    
    // Si on a assez de résultats, on s'arrête
    if (vectorResults.length >= CONFIG.minDesiredChunks) {
      break;
    }
    
    console.log(`[Adaptive] Threshold ${threshold}: ${vectorResults.length} results (raw: ${rawVectorCount}), trying lower...`);
  }
  
  const ftsResults = await ftsPromise;
  
  // V6.2: Fallback vers RAG global si pas assez de résultats après filtrage discipline
  const totalUniqueChunks = new Set([
    ...vectorResults.map(c => c.id),
    ...ftsResults.map(c => c.id)
  ]).size;
  
  if (disciplineMode === 'filtered' && totalUniqueChunks < CONFIG.disciplineRouting.minChunksForFiltered) {
    console.log(`[Routing] Fallback to global retrieval (only ${totalUniqueChunks} chunks found)`);
    disciplineMode = 'fallback';
    
    // Relancer avec tous les documents
    const ftsGlobal = searchByFTS(supabase, searchTerms, allowedDocIds, CONFIG.ftsTopK);
    
    // Reset et relancer vector search avec tous les documents
    passes = 0;
    for (const threshold of thresholds) {
      passes++;
      const result = await searchByVector(
        supabase,
        userId,
        embedding,
        allowedDocIds,
        threshold,
        CONFIG.vectorTopK
      );
      
      vectorResults = result.chunks;
      rawVectorCount = result.rawCount;
      usedThreshold = threshold;
      
      if (vectorResults.length >= CONFIG.minDesiredChunks) {
        break;
      }
    }
    
    const ftsResultsGlobal = await ftsGlobal;
    return { 
      vectorResults, 
      ftsResults: ftsResultsGlobal, 
      threshold: usedThreshold, 
      passes, 
      rawVectorCount,
      disciplineMode
    };
  }
  
  return { vectorResults, ftsResults, threshold: usedThreshold, passes, rawVectorCount, disciplineMode };
}

async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.embeddingModel,
      input: text.replace(/\n/g, ' ').substring(0, 8000),
      dimensions: CONFIG.embeddingDimensions,
    }),
  });

  const data = await response.json();
  if (!data.data?.[0]?.embedding) {
    throw new Error('Failed to create embedding');
  }
  return data.data[0].embedding;
}

// ============================================================================
// STEP 4: RRF FUSION CORRIGÉE
// ============================================================================

/**
 * Normalise les scores d'une liste de chunks (min-max)
 */
function normalizeScores(chunks: RetrievedChunk[]): RetrievedChunk[] {
  if (chunks.length === 0) return [];
  
  const scores = chunks.map(c => c.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;
  
  return chunks.map(chunk => ({
    ...chunk,
    normalizedScore: (chunk.score - minScore) / range,
  }));
}

/**
 * RRF Fusion pondérée avec normalisation et bonus dual-source
 * VERSION CORRIGÉE: gestion robuste des IDs
 */
function fuseWithWeightedRRF(
  vectorResults: RetrievedChunk[],
  ftsResults: RetrievedChunk[],
  docsMap: Map<string, DocumentInfo>
): RetrievedChunk[] {
  const { k, vectorWeight, ftsWeight, dualSourceBonus } = CONFIG.rrf;
  
  // Normaliser les scores avant fusion
  const normalizedVector = normalizeScores(vectorResults);
  const normalizedFTS = normalizeScores(ftsResults);
  
  const rrfScores = new Map<string, number>();
  const chunkMap = new Map<string, RetrievedChunk>();
  const sources = new Map<string, Set<string>>();

  const processList = (
    list: RetrievedChunk[], 
    sourceType: 'vector' | 'fts',
    weight: number
  ) => {
    list.forEach((item, rank) => {
      // S'assurer que l'ID est valide
      const chunkId = item.id || `${sourceType}_${item.documentId}_${rank}`;
      
      // Enrichir avec le titre du document
      if (!item.documentTitle && docsMap.has(item.documentId)) {
        item.documentTitle = docsMap.get(item.documentId)!.title;
      }

      // Tracker les sources
      if (!sources.has(chunkId)) {
        sources.set(chunkId, new Set());
      }
      sources.get(chunkId)!.add(sourceType);

      // Stocker le chunk avec le meilleur score
      const existing = chunkMap.get(chunkId);
      if (!existing) {
        chunkMap.set(chunkId, { ...item, id: chunkId });
      } else if ((item.normalizedScore || item.score) > (existing.normalizedScore || existing.score)) {
        chunkMap.set(chunkId, { ...item, id: chunkId });
      }

      // Calculer le score RRF pondéré
      const currentRRF = rrfScores.get(chunkId) || 0;
      const rrfContribution = weight / (k + rank + 1);
      rrfScores.set(chunkId, currentRRF + rrfContribution);
    });
  };

  processList(normalizedVector, 'vector', vectorWeight);
  processList(normalizedFTS, 'fts', ftsWeight);

  // Appliquer le bonus pour les chunks trouvés par les deux sources
  for (const [chunkId, sourcesSet] of sources.entries()) {
    if (sourcesSet.size > 1) {
      const currentScore = rrfScores.get(chunkId) || 0;
      rrfScores.set(chunkId, currentScore * dualSourceBonus);
      
      // Marquer comme 'both'
      const chunk = chunkMap.get(chunkId);
      if (chunk) {
        chunkMap.set(chunkId, { ...chunk, source: 'both' });
      }
    }
  }

  const results = Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([chunkId, rrfScore]) => {
      const chunk = chunkMap.get(chunkId)!;
      return { ...chunk, score: rrfScore };
    });

  // Log de diagnostic
  console.log(`[Fusion Debug] Vector: ${normalizedVector.length}, FTS: ${normalizedFTS.length}, Unique chunks: ${results.length}`);
  
  return results;
}

// ============================================================================
// STEP 5: COHERE RERANKING
// ============================================================================

async function rerankWithCohere(
  query: string,
  candidates: RetrievedChunk[],
  topK: number
): Promise<RerankResult[]> {
  const cohereApiKey = Deno.env.get('COHERE_API_KEY');
  
  if (!cohereApiKey) {
    console.warn('[Rerank] No COHERE_API_KEY, using RRF scores only');
    return candidates.slice(0, topK).map(chunk => ({
      chunk,
      relevanceScore: chunk.score,
    }));
  }

  if (candidates.length === 0) {
    return [];
  }

  try {
    const documents = candidates.map(c => c.content.substring(0, 2000));

    const response = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cohereApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.cohereRerankModel,
        query: query,
        documents: documents,
        top_n: Math.min(topK, candidates.length),
        return_documents: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Rerank] Cohere API error:', response.status, errorText);
      return candidates.slice(0, topK).map(chunk => ({
        chunk,
        relevanceScore: chunk.score,
      }));
    }

    const data = await response.json();
    
    const results = (data.results || []).map((result: any) => ({
      chunk: candidates[result.index],
      relevanceScore: result.relevance_score,
    }));
    
    // Log des scores pour debug
    if (results.length > 0) {
      const avgScore = results.reduce((sum: number, r: RerankResult) => sum + r.relevanceScore, 0) / results.length;
      console.log(`[Rerank] ${results.length} results, avg score: ${avgScore.toFixed(3)}`);
    }
    
    return results;
  } catch (error) {
    console.error('[Rerank] Error:', error);
    return candidates.slice(0, topK).map(chunk => ({
      chunk,
      relevanceScore: chunk.score,
    }));
  }
}

// ============================================================================
// STEP 6: CONTEXT ASSEMBLY INTELLIGENT
// ============================================================================

/**
 * Calcule une similarité approximative entre deux textes (Jaccard sur mots)
 */
function textSimilarity(text1: string, text2: string): number {
  const getWords = (text: string) => 
    new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  const words1 = getWords(text1);
  const words2 = getWords(text2);
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Déduplique les chunks trop similaires
 */
function deduplicateChunks(results: RerankResult[]): RerankResult[] {
  const deduplicated: RerankResult[] = [];
  
  for (const result of results) {
    const isDuplicate = deduplicated.some(
      existing => textSimilarity(existing.chunk.content, result.chunk.content) > CONFIG.context.redundancyThreshold
    );
    
    if (!isDuplicate) {
      deduplicated.push(result);
    }
  }
  
  return deduplicated;
}

/**
 * Limite le nombre de chunks par document pour diversifier les sources
 */
function limitChunksPerDocument(results: RerankResult[]): RerankResult[] {
  const countByDoc = new Map<string, number>();
  const filtered: RerankResult[] = [];
  
  for (const result of results) {
    const docId = result.chunk.documentId;
    const currentCount = countByDoc.get(docId) || 0;
    
    if (currentCount < CONFIG.context.maxChunksPerDocument) {
      filtered.push(result);
      countByDoc.set(docId, currentCount + 1);
    }
  }
  
  return filtered;
}

/**
 * Construit le contexte de manière structurée
 */
function buildStructuredContext(results: RerankResult[]): string {
  // Grouper par document
  const byDocument = new Map<string, RerankResult[]>();
  
  for (const result of results) {
    const docId = result.chunk.documentId;
    if (!byDocument.has(docId)) {
      byDocument.set(docId, []);
    }
    byDocument.get(docId)!.push(result);
  }
  
  // Construire le contexte groupé
  const contextParts: string[] = [];
  let sourceIndex = 1;
  
  for (const [_, docResults] of byDocument) {
    // Trier les chunks d'un même document par chunkIndex
    docResults.sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex);
    
    for (const result of docResults) {
      const excerpt = result.chunk.content.substring(0, CONFIG.context.excerptLength);
      contextParts.push(
        `[Source ${sourceIndex}] (${result.chunk.documentTitle || 'Document'})\n${excerpt}`
      );
      sourceIndex++;
    }
  }
  
  return contextParts.join('\n\n---\n\n');
}

// ============================================================================
// STEP 7: RESPONSE GENERATION
// ============================================================================

async function generateResponse(
  query: string,
  rerankResults: RerankResult[],
  mode: ChatMode,
  history: any[],
  apiKey: string
): Promise<{ answer: string; tokensUsed: number }> {
  const allowAI = mode === 'corpus_plus_ai';

  // Aucun résultat trouvé dans les documents
  if (rerankResults.length === 0) {
    // En mode corpus_only, pas de fallback possible
    if (!allowAI) {
      return {
        answer: "Je n'ai pas trouvé d'information pertinente dans les documents disponibles pour répondre à cette question.",
        tokensUsed: 0,
      };
    }

    // En mode corpus_plus_ai, utiliser le LLM avec ses connaissances
    console.log(`[Fallback IA] No corpus results, using AI knowledge for query`);

    const fallbackPrompt = `Tu es un assistant pédagogique expert pour les enseignants français.

CONTEXTE : Aucun document du corpus de l'utilisateur ne contient d'information directement pertinente pour cette question. Tu dois répondre en utilisant tes connaissances générales.

INSTRUCTIONS :
1. Réponds à la question de l'utilisateur en utilisant tes connaissances pédagogiques et disciplinaires.
2. Structure ta réponse avec des titres (##) et des puces (-) pour faciliter la lecture.
3. Sois précis, professionnel et adapté à un public enseignant français.
4. Si tu n'es pas certain d'une information, indique-le.

Réponds en français.`;

    const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.chatModel,
        messages: [
          { role: 'system', content: fallbackPrompt },
          ...history.slice(-CONFIG.maxHistoryMessages),
          { role: 'user', content: query },
        ],
        temperature: 0.3,
      }),
    });

    const fallbackData = await fallbackResponse.json();
    return {
      answer: fallbackData.choices?.[0]?.message?.content || 'Erreur lors de la génération de la réponse.',
      tokensUsed: fallbackData.usage?.total_tokens || 0,
    };
  }

  // Dédupliquer et limiter pour diversifier
  const deduplicated = deduplicateChunks(rerankResults);
  const balanced = limitChunksPerDocument(deduplicated);
  const context = buildStructuredContext(balanced);

  const numSources = balanced.length;

  const systemPrompt = `Tu es un assistant pédagogique expert pour les enseignants français.

SOURCES DOCUMENTAIRES DISPONIBLES (${numSources} extraits) :
${context}

INSTRUCTIONS STRICTES :
1. Base ta réponse sur TOUTES les Sources pertinentes ci-dessus, pas seulement une.
2. Cite systématiquement tes sources : [Source 1], [Source 2], etc.
3. Si plusieurs sources traitent du même sujet, SYNTHÉTISE-les de manière cohérente.
4. Structure ta réponse avec des titres (##) et des puces (-) pour faciliter la lecture.
5. Sois complet : utilise l'ensemble des informations disponibles dans les sources.
${allowAI
  ? `6. Si les sources sont insuffisantes pour répondre complètement, tu PEUX compléter avec tes connaissances, en le signalant clairement avec "💡 Complément IA :".`
  : `6. Si l'information demandée n'est pas dans les sources, indique-le clairement. Ne fabrique JAMAIS d'information.`}

Réponds en français, de manière professionnelle et adaptée à un public enseignant.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-CONFIG.maxHistoryMessages),
        { role: 'user', content: query },
      ],
      temperature: 0.2,
    }),
  });

  const data = await response.json();
  return {
    answer: data.choices?.[0]?.message?.content || 'Erreur lors de la génération de la réponse.',
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

// ============================================================================
// STEP 8: TOKEN MANAGEMENT
// ============================================================================

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

// ============================================================================
// STEP 8b: RECHERCHE COMPLÉMENTAIRE PAR TITRE DE DOCUMENT
// ============================================================================

/**
 * Recherche des documents par titre pour rattraper les cas où la recherche
 * vectorielle a raté un document dont le titre correspond à la requête.
 * Ex: "séquence natation cycle 3" → trouve "Sequence_Natation_C3.pdf"
 */
async function searchByDocumentTitle(
  supabase: any,
  keywords: string[],
  allowedDocIds: string[],
  existingDocumentIds: Set<string>,
  maxResults: number = 8
): Promise<RetrievedChunk[]> {
  if (keywords.length === 0 || allowedDocIds.length === 0) return [];

  try {
    // Récupérer les documents autorisés avec leur titre
    const { data: docs, error } = await supabase
      .from('rag_documents')
      .select('id, title, keywords, subjects')
      .in('id', allowedDocIds)
      .eq('status', 'ready');

    if (error || !docs || docs.length === 0) return [];

    // Filtrer les documents dont le titre ou les keywords matchent
    const normalizedKeywords = keywords.map(kw =>
      kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    const matchingDocs = docs.filter((doc: any) => {
      if (existingDocumentIds.has(doc.id)) return false;

      // Match par titre
      if (doc.title) {
        const normalizedTitle = doc.title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        if (normalizedKeywords.some(kw => normalizedTitle.includes(kw))) return true;
      }

      // Match par keywords stockés sur le document
      if (doc.keywords && Array.isArray(doc.keywords)) {
        const normalizedDocKw = doc.keywords.map((k: string) =>
          k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );
        if (normalizedKeywords.some(kw =>
          normalizedDocKw.some((dk: string) => dk.includes(kw) || kw.includes(dk))
        )) return true;
      }

      return false;
    });

    if (matchingDocs.length === 0) return [];

    console.log(`[TitleSearch] Found ${matchingDocs.length} matching documents by title/keywords`);

    // Récupérer les chunks de ces documents
    const matchingDocIds = matchingDocs.map((d: any) => d.id);
    const { data: chunks, error: chunksError } = await supabase
      .from('rag_chunks')
      .select('id, content, document_id, chunk_index, metadata')
      .in('document_id', matchingDocIds)
      .order('chunk_index', { ascending: true })
      .limit(maxResults);

    if (chunksError || !chunks) return [];

    return chunks.map((c: any, index: number) => ({
      id: c.id || `title_${c.document_id}_${index}`,
      documentId: c.document_id,
      documentTitle: matchingDocs.find((d: any) => d.id === c.document_id)?.title || '',
      chunkIndex: c.chunk_index ?? index,
      content: c.content,
      score: 0.5, // Score neutre, sera reranké par Cohere
      source: 'fts' as const,
    }));
  } catch (err) {
    console.warn('[TitleSearch] Error:', err);
    return [];
  }
}

// ============================================================================
// STEP 8c: BOOST PAR MÉTADONNÉES DOCUMENT
// ============================================================================

/**
 * Calcule un boost basé sur les métadonnées du document (summary, keywords, titre)
 * Permet de favoriser les documents contextuellement pertinents
 */
function calculateMetadataBoost(
  queryKeywords: string[],
  docInfo: {
    title?: string | null;
    summary?: string | null;
    keywords?: string[] | null;
  }
): number {
  if (queryKeywords.length === 0) return 0;

  let boost = 0;

  const normalize = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Boost par titre (max +0.4)
  if (docInfo.title) {
    const normalizedTitle = normalize(docInfo.title);
    const matchingInTitle = queryKeywords.filter(kw => normalizedTitle.includes(kw));
    if (matchingInTitle.length > 0) {
      boost += Math.min(0.4, matchingInTitle.length * 0.2);
    }
  }

  // Boost par summary (max +0.2)
  if (docInfo.summary) {
    const normalizedSummary = normalize(docInfo.summary);
    const matchingInSummary = queryKeywords.filter(kw => normalizedSummary.includes(kw));
    if (matchingInSummary.length > 0) {
      boost += Math.min(0.2, matchingInSummary.length * 0.08);
    }
  }

  // Boost par keywords du document (max +0.3)
  if (docInfo.keywords && docInfo.keywords.length > 0) {
    const normalizedDocKw = docInfo.keywords.map(k => normalize(k));
    const matchingKw = queryKeywords.filter(kw =>
      normalizedDocKw.some(dk => dk.includes(kw) || kw.includes(dk))
    );
    if (matchingKw.length > 0) {
      boost += Math.min(0.3, matchingKw.length * 0.15);
    }
  }

  return boost;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

async function chatHandler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const startTime = Date.now();
  const metrics: Partial<RetrievalMetrics> = {};

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }

    const supabase = createSupabaseClient(authHeader);
    const serviceClient = createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const body = await req.json() as ChatRequest;
    const {
      message,
      conversationId,
      documentId,
      usePersonalCorpus = true,
      useProfAssistCorpus = true,
      useAI = false,
      levels,
      subjects,
      folderIds,
      debug = false,
    } = body;

    const effectiveMode: ChatMode = useAI ? 'corpus_plus_ai' : 'corpus_only';
    let totalTokensUsed = 0;

    metrics.queryLength = message.length;

    // ========== STEP 0: Correction fuzzy des fautes de frappe ==========
    const { corrected: correctedMessage, corrections } = fuzzyCorrectQuery(message);
    const effectiveMessage = corrections.length > 0 ? correctedMessage : message;

    if (corrections.length > 0) {
      console.log(`[Fuzzy] Corrections applied: ${corrections.join(', ')}`);
      console.log(`[Fuzzy] Corrected query: "${correctedMessage}"`);
    }

    // ========== NEW V6.2: Détection de discipline ==========
    const disciplineDetection = detectDiscipline(effectiveMessage);
    metrics.disciplineDetected = disciplineDetection.discipline;
    metrics.disciplineConfidence = disciplineDetection.confidence;

    if (disciplineDetection.discipline) {
      console.log(`[Discipline] Detected: ${disciplineDetection.discipline} (confidence: ${disciplineDetection.confidence.toFixed(2)})`);
    }

    // ========== STEP 1: Analyse HyDE adaptative ==========
    const hydeDecision = analyzeQueryForHyDE(effectiveMessage);
    metrics.hydeUsed = hydeDecision.shouldUse;
    metrics.hydeReason = hydeDecision.reason;
    
    console.log(`[rag-chat] Query: "${message.substring(0, 50)}..." | HyDE: ${hydeDecision.shouldUse} (${hydeDecision.reason}, score: ${hydeDecision.conceptScore.toFixed(2)}) | AI: ${useAI}`);

    // ========== STEP 2: Get allowed documents (progressive) ==========
    const filterResult = await getAllowedDocumentsProgressive(serviceClient, user.id, {
      documentId,
      usePersonalCorpus,
      useProfAssistCorpus,
      levels,
      subjects,
      folderIds,
    });

    const { docsMap, relaxationLevel } = filterResult;
    const allowedDocIds = Array.from(docsMap.keys());
    
    metrics.documentsSearched = allowedDocIds.length;
    metrics.filtersRelaxed = relaxationLevel > 0;
    metrics.filterRelaxationLevel = relaxationLevel;

    // ========== CAS: Aucun document, IA seule ==========
    if (allowedDocIds.length === 0) {
      if (useAI) {
        let convId = conversationId;
        if (!convId) {
          const { data } = await serviceClient
            .from('rag_conversations')
            .insert({ user_id: user.id })
            .select('id')
            .single();
          convId = data?.id;
        }

        const { data: history } = await serviceClient
          .from('rag_messages')
          .select('role, content')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(CONFIG.maxHistoryMessages);

        await serviceClient.from('rag_messages').insert({
          conversation_id: convId,
          role: 'user',
          content: message,
        });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: CONFIG.chatModel,
            messages: [
              {
                role: 'system',
                content: 'Tu es un assistant pédagogique. Réponds selon tes connaissances générales. Précise que ta réponse ne provient pas de documents officiels.',
              },
              ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
              { role: 'user', content: message },
            ],
            temperature: 0.4,
          }),
        });

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || 'Erreur.';
        const tokensUsed = data.usage?.total_tokens || 0;

        await serviceClient.from('rag_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: answer,
          sources: [],
        });

        await deductTokens(serviceClient, user.id, tokensUsed);

        return new Response(
          JSON.stringify({
            answer,
            sources: [],
            conversationId: convId,
            tokensUsed,
            mode: 'ai_only',
            metrics: debug ? { ...metrics, totalDurationMs: Date.now() - startTime } : undefined,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          answer: "Aucun document accessible. Activez un corpus ou l'option IA.",
          sources: [],
          tokensUsed: 0,
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // ========== STEP 3: Query Processing (HyDE adaptatif + synonymes) ==========
    const queryKeywords = extractKeywordsWithSynonyms(effectiveMessage);
    console.log(`[Keywords] ${queryKeywords.length} keywords (with synonyms): ${queryKeywords.slice(0, 10).join(', ')}`);

    let queryForEmbedding = effectiveMessage;

    if (hydeDecision.shouldUse) {
      const hydeResult = await generateHyDE(effectiveMessage, OPENAI_API_KEY);
      queryForEmbedding = hydeResult.hydeText;
      totalTokensUsed += hydeResult.tokensUsed;
      console.log(`[HyDE] Generated (${hydeResult.tokensUsed} tokens): "${hydeResult.hydeText.substring(0, 100)}..."`);
    } else {
      // Si pas de HyDE, enrichir l'embedding avec les synonymes
      queryForEmbedding = expandQueryWithSynonyms(effectiveMessage);
      if (queryForEmbedding !== effectiveMessage) {
        console.log(`[Synonyms] Expanded: "${queryForEmbedding.substring(0, 120)}..."`);
      }
    }

    const searchTerms = extractSearchTerms(effectiveMessage);
    console.log(`[FTS] Search terms: "${searchTerms}"`);

    // ========== STEP 4: Adaptive Hybrid Retrieval (V6.2: avec discipline routing) ==========
    const embedding = await createEmbedding(queryForEmbedding, OPENAI_API_KEY);

    // V6.2: Préparer le filtre discipline si confiance suffisante
    const disciplineFilter = disciplineDetection.discipline &&
      disciplineDetection.confidence >= CONFIG.disciplineRouting.minConfidence
      ? {
          discipline: disciplineDetection.discipline,
          disciplineValues: mapDisciplineToMetadata(disciplineDetection.discipline),
          confidence: disciplineDetection.confidence,
        }
      : undefined;

    const { vectorResults, ftsResults, threshold, passes, rawVectorCount, disciplineMode } = await adaptiveRetrieval(
      serviceClient,
      user.id,
      embedding,
      searchTerms,
      allowedDocIds,
      disciplineFilter
    );

    metrics.vectorResultsRaw = rawVectorCount;
    metrics.vectorResultsFiltered = vectorResults.length;
    metrics.ftsResultsCount = ftsResults.length;
    metrics.similarityThreshold = threshold;
    metrics.retrievalPasses = passes;
    metrics.disciplineMode = disciplineMode;

    console.log(`[Retrieval] Vector: ${vectorResults.length} (raw: ${rawVectorCount}, threshold: ${threshold}) | FTS: ${ftsResults.length} | Passes: ${passes} | DisciplineMode: ${disciplineMode}`);

    // ========== STEP 4b: Recherche complémentaire par titre ==========
    const existingDocIds = new Set([
      ...vectorResults.map(r => r.documentId),
      ...ftsResults.map(r => r.documentId),
    ]);

    const titleResults = await searchByDocumentTitle(
      serviceClient,
      queryKeywords,
      allowedDocIds,
      existingDocIds,
      8
    );

    if (titleResults.length > 0) {
      console.log(`[TitleSearch] Added ${titleResults.length} extra chunks from title/keyword matching`);
    }

    // ========== STEP 5: Weighted RRF Fusion (inclut les résultats titre) ==========
    const allFtsResults = [...ftsResults, ...titleResults];
    const fusedResults = fuseWithWeightedRRF(vectorResults, allFtsResults, docsMap);
    metrics.fusedResultsCount = fusedResults.length;
    console.log(`[Fusion] ${fusedResults.length} unique chunks after weighted RRF (incl. ${titleResults.length} title-matched)`);

    // ========== STEP 5b: Récupérer métadonnées et appliquer boost ==========
    const uniqueDocIds = [...new Set(fusedResults.map(r => r.documentId))];
    const { data: docsMetadata } = await serviceClient
      .from('rag_documents')
      .select('id, title, summary, keywords')
      .in('id', uniqueDocIds);

    const docMetaMap = new Map<string, { title: string | null; summary: string | null; keywords: string[] | null }>();
    if (docsMetadata) {
      for (const d of docsMetadata) {
        docMetaMap.set(d.id, { title: d.title, summary: d.summary, keywords: d.keywords });
      }
    }

    // Appliquer le boost par métadonnées sur les scores fusionnés
    const boostedResults = fusedResults.map(chunk => {
      const docMeta = docMetaMap.get(chunk.documentId);
      const boost = docMeta ? calculateMetadataBoost(queryKeywords, docMeta) : 0;
      return {
        ...chunk,
        score: chunk.score + boost,
      };
    });

    // Re-trier après boost
    boostedResults.sort((a, b) => b.score - a.score);

    if (boostedResults.some((r, i) => fusedResults[i]?.id !== r.id)) {
      console.log(`[Boost] Ranking changed after metadata boost`);
    }

    // ========== STEP 6: Reranking ==========
    const candidatesForRerank = boostedResults.slice(0, 30);
    const rerankResults = await rerankWithCohere(
      effectiveMessage,
      candidatesForRerank,
      CONFIG.rerankTopK
    );

    metrics.rerankResultsCount = rerankResults.length;

    if (rerankResults.length > 0) {
      const docTitles = [...new Set(rerankResults.map(r => r.chunk.documentTitle))].slice(0, 3);
      console.log(`[Rerank] Top ${rerankResults.length} from ${docTitles.length} docs: ${docTitles.join(', ')}`);
    }

    // ========== STEP 7: Conversation Management ==========
    let convId = conversationId;
    if (!convId) {
      const { data } = await serviceClient
        .from('rag_conversations')
        .insert({ user_id: user.id })
        .select('id')
        .single();
      convId = data?.id;
    }

    const { data: history } = await serviceClient
      .from('rag_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(CONFIG.maxHistoryMessages);

    await serviceClient.from('rag_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // ========== STEP 8: Response Generation ==========
    const { answer, tokensUsed } = await generateResponse(
      effectiveMessage,
      rerankResults,
      effectiveMode,
      history || [],
      OPENAI_API_KEY
    );

    totalTokensUsed += tokensUsed;

    // Format sources for response
    const sources = rerankResults.map((r, index) => ({
      sourceIndex: index + 1,
      documentId: r.chunk.documentId,
      documentTitle: r.chunk.documentTitle,
      chunkId: r.chunk.id,
      chunkIndex: r.chunk.chunkIndex,
      excerpt: r.chunk.content.substring(0, CONFIG.context.excerptLength),
      relevanceScore: r.relevanceScore,
    }));

    await serviceClient.from('rag_messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: answer,
      sources,
    });

    await deductTokens(serviceClient, user.id, totalTokensUsed);

    const duration = Date.now() - startTime;
    metrics.totalDurationMs = duration;
    
    console.log(`[rag-chat] Completed in ${duration}ms | Tokens: ${totalTokensUsed} | Sources: ${sources.length} | Discipline: ${disciplineDetection.discipline || 'none'} (${disciplineMode})`);
      // ============================================
    // LOGGING POUR DASHBOARD ADMIN
    // ============================================
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        fetch(`${SUPABASE_URL}/rest/v1/edge_function_logs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            function_name: 'rag-chat',
            user_id: user.id,
            metadata: { 
              mode: effectiveMode,
              sources_count: sources.length,
              duration_ms: duration
            },
            tokens_used: totalTokensUsed,
            success: true
          })
        }).catch(() => {});
      }
    } catch {}
    // FIN LOGGING

  

    return new Response(
      JSON.stringify({
        answer,
        sources,
        conversationId: convId,
        tokensUsed: totalTokensUsed,
        mode: effectiveMode,
        metrics: debug ? metrics : undefined,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[rag-chat] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        metrics: { totalDurationMs: Date.now() - startTime },
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
}

Deno.serve(chatHandler);


