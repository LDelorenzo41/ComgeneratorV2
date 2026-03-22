// Types pour l'application de feedback testeurs

export interface FeedbackSession {
  id?: string;
  tester_name: string;
  tester_email: string;
  matiere: string;
  niveau: string;
  anciennete: number | null;
  a_achete_tokens: boolean | null;
  prevoit_acheter: string;
  raison_achat: string;
  completed: boolean;
  created_at?: string;
}

export interface FeedbackRating {
  id?: string;
  session_id: string;
  section: string;
  question_key: string;
  rating: number;
  created_at?: string;
}

export interface FeedbackComment {
  id?: string;
  session_id: string;
  section: string;
  comment: string;
  created_at?: string;
}

// Sections du questionnaire
export const FEEDBACK_SECTIONS = [
  { key: 'appreciations', label: 'Appréciations Intelligentes', icon: 'PenTool' },
  { key: 'syntheses', label: 'Synthèses de Bulletins', icon: 'FileText' },
  { key: 'communications', label: 'Communications Professionnelles', icon: 'Mail' },
  { key: 'seances', label: 'Séances Pédagogiques', icon: 'BookOpen' },
  { key: 'scenarios', label: 'Scénarios Pédagogiques', icon: 'Layers' },
  { key: 'banques', label: 'Banques Personnalisées', icon: 'Database' },
  { key: 'veille', label: 'Veille Éducative', icon: 'TrendingUp' },
  { key: 'chatbot', label: 'Chatbot Personnel', icon: 'Bot' },
] as const;

export type FeatureSectionKey = typeof FEEDBACK_SECTIONS[number]['key'];

// Questions de notation par fonctionnalité
export const FEATURE_RATING_QUESTIONS = [
  { key: 'utilite', label: 'À quel point cette fonctionnalité vous semble utile dans votre pratique ?' },
  { key: 'qualite', label: 'Comment évaluez-vous la qualité du contenu généré/proposé ?' },
  { key: 'facilite', label: 'Cette fonctionnalité est-elle facile à prendre en main ?' },
] as const;

// Questions UX/Design
export const UX_RATING_QUESTIONS = [
  { key: 'design_general', label: 'Comment évaluez-vous le design général de l\'application ?' },
  { key: 'navigation', label: 'La navigation entre les différentes fonctionnalités est-elle claire et intuitive ?' },
  { key: 'responsive', label: 'L\'application fonctionne-t-elle bien sur mobile/tablette ?' },
  { key: 'mode_sombre', label: 'Le mode sombre est-il agréable et bien implémenté ?' },
  { key: 'vitesse', label: 'L\'application vous semble-t-elle rapide et réactive ?' },
] as const;

// Questions Tarification
export const PRICING_RATING_QUESTIONS = [
  { key: 'tokens_comprehension', label: 'Le système de tokens est-il clair et compréhensible ?' },
  { key: 'prix_juste', label: 'Les tarifs proposés (3,50€ à 7€) vous semblent-ils justes par rapport à la valeur apportée ?' },
  { key: 'pret_a_payer', label: 'Seriez-vous prêt(e) à payer pour utiliser ProfAssist régulièrement ?' },
] as const;

// Questions Satisfaction générale
export const GENERAL_RATING_QUESTIONS = [
  { key: 'satisfaction_globale', label: 'Quelle est votre satisfaction globale avec ProfAssist ?' },
  { key: 'recommandation', label: 'Recommanderiez-vous ProfAssist à un(e) collègue ?' },
  { key: 'gain_temps', label: 'ProfAssist vous fait-il gagner du temps dans votre travail ?' },
] as const;

// Labels des étoiles
export const STAR_LABELS: Record<number, string> = {
  1: 'Pas du tout',
  2: 'Peu',
  3: 'Moyen',
  4: 'Bien',
  5: 'Excellent',
};

// Données de synthèse
export interface SectionSynthesis {
  section: string;
  label: string;
  ratings: Record<string, { average: number; count: number }>;
  comments: Array<{ comment: string; tester_name: string; created_at: string }>;
}

export interface FeedbackSynthesisData {
  totalResponses: number;
  sessions: FeedbackSession[];
  sections: SectionSynthesis[];
}