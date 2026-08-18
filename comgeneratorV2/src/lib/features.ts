// src/lib/features.ts
// Configuration des fonctionnalités activées/désactivées
// Pour activer une fonctionnalité, passer la valeur à true

export const FEATURES = {
  // Chatbot et banque de réponses - à activer quand prêt
  CHATBOT_ENABLED: true,

  // Chatbot et corpus documentaire réservés au compte administrateur.
  // Mesures du 17/08/2026 : 3 utilisateurs externes depuis le lancement,
  // 0,003 € de consommation totale, aucun usage depuis des mois. La
  // fonctionnalité reste en place pour l'administration ; elle disparaît
  // simplement de la surface utilisateur.
  // Repasser à false rétablit l'accès pour tous, sans autre modification.
  CHATBOT_ADMIN_ONLY: true,
  
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

/**
 * Le chatbot et le corpus documentaire sont-ils visibles pour cet utilisateur ?
 *
 * Point de décision unique : tous les points d'entrée de l'interface
 * (menus, bouton flottant, options des générateurs, pages) s'y réfèrent,
 * de sorte que rétablir l'accès ne demande qu'un seul changement.
 *
 * `isAdmin` provient de checkIsAdmin() (src/lib/ragApi.ts), asynchrone :
 * tant que la réponse n'est pas connue, passer `false` — la surface reste
 * masquée par défaut, ce qui évite d'exposer brièvement un contenu réservé.
 */
export function isChatbotVisible(isAdmin: boolean): boolean {
  if (!FEATURES.CHATBOT_ENABLED) return false;
  return FEATURES.CHATBOT_ADMIN_ONLY ? isAdmin : true;
}




