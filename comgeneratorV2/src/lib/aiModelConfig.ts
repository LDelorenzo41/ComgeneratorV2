// src/lib/aiModelConfig.ts
// Configuration centralisée pour le choix du modèle IA utilisateur

/**
 * Types de modèles disponibles pour l'utilisateur
 * - "default" : utilise les modèles actuels (gpt-4o-mini / gpt-4.1-mini)
 * - "gpt-6-luna" : utilise GPT-6 Luna d'OpenAI, futur modèle par défaut
 *
 * L'option "gpt-5-mini" a été remplacée le 08/11/2026 par "gpt-6-luna" :
 * OpenAI retire gpt-5-mini le 11/12/2026, et l'option n'avait servi qu'à des
 * essais. Un choix "gpt-5-mini" resté dans un navigateur retombe sur
 * "default" ; Luna remplacera gpt-4o-mini et gpt-4.1-mini, retirés le
 * 14/01/2027 (docs/CONTEXTE-STRATEGIE.md, § 6).
 *
 * L'option "mistral-medium" a été retirée le 01/11/2026 : Mistral retire
 * Mistral Medium 3.5 le 30/04/2027, et l'option n'avait aucun utilisateur
 * réel (mesure credit_ledger). Un choix "mistral-medium" resté dans un
 * navigateur n'est plus reconnu par isValidModelChoice : getAIModelChoice()
 * renvoie alors "default". Les Edge Functions gardent leur branche Mistral,
 * inutilisée, jusqu'à son nettoyage.
 */
export type AIModelChoice = "default" | "gpt-6-luna";

/**
 * Clé de stockage localStorage
 */
const STORAGE_KEY = "profassist_ai_model_choice";

/**
 * Options affichées dans le sélecteur
 */
export const AI_MODEL_OPTIONS: Array<{
  value: AIModelChoice;
  label: string;
  description: string;
}> = [
  {
    value: "default",
    label: "GPT-4.1 mini (standard)",
    description: "Recommandé — Prompts optimisés pour ce modèle, meilleur rapport qualité/coût"
  },
  {
    value: "gpt-6-luna",
    label: "GPT-6 Luna",
    description: "Nouveau modèle OpenAI — futur modèle standard, à essayer dès maintenant"
  }
];

/**
 * Récupère le choix de modèle stocké
 * @returns Le choix de modèle ou "default" si non défini
 */
export function getAIModelChoice(): AIModelChoice {
  if (typeof window === "undefined") return "default";
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isValidModelChoice(stored)) {
    return stored as AIModelChoice;
  }
  return "default";
}

/**
 * Sauvegarde le choix de modèle
 * @param choice Le choix de modèle à sauvegarder
 */
export function setAIModelChoice(choice: AIModelChoice): void {
  if (typeof window === "undefined") return;
  
  if (choice === "default") {
    // Si default, on supprime la clé pour ne pas polluer le localStorage
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, choice);
  }
}

/**
 * Vérifie si une valeur est un choix de modèle valide
 */
function isValidModelChoice(value: string): value is AIModelChoice {
  return ["default", "gpt-6-luna"].includes(value);
}