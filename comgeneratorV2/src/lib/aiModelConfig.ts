// src/lib/aiModelConfig.ts
// Configuration centralisée pour le choix du modèle IA utilisateur

/**
 * Types de modèles disponibles pour l'utilisateur
 * - "default" : utilise les modèles actuels (gpt-4o-mini / gpt-4.1-mini)
 * - "gpt-5-mini" : utilise GPT-5 mini d'OpenAI
 * - "mistral-medium" : utilise Mistral Medium
 */
export type AIModelChoice = "default" | "gpt-5-mini" | "mistral-medium";

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
    label: "Modèle standard",
    description: "Recommandé - Modèles optimisés pour ProfAssist"
  },
  {
    value: "gpt-5-mini",
    label: "GPT-5 mini",
    description: "OpenAI - Dernière génération"
  },
  {
    value: "mistral-medium",
    label: "Mistral Medium",
    description: "Mistral AI - Alternative européenne"
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
  return ["default", "gpt-5-mini", "mistral-medium"].includes(value);
}
