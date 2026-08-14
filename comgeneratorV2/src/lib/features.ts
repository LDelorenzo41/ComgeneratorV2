// src/lib/features.ts
// Configuration des fonctionnalités activées/désactivées
// Pour activer une fonctionnalité, passer la valeur à true

export const FEATURES = {
  // Chatbot et banque de réponses - à activer quand prêt
  CHATBOT_ENABLED: true,
  
  // Scénario pédagogique - à activer quand prêt
  SCENARIO_ENABLED: true,
  
  // Formulaire de feedback testeurs
  FEEDBACK_ENABLED: true,

  // Dictée vocale (transcription Mistral) sur la page Communication
  DICTATION_ENABLED: true,

  // Analyse de brouillon (pré-remplissage du formulaire Communication)
  BRIEF_ANALYSIS_ENABLED: true,

  // Autres features à venir...
} as const;




