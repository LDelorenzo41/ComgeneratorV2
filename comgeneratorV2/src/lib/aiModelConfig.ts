// src/lib/aiModelConfig.ts
// Configuration centralisée pour le choix du modèle IA utilisateur

/**
 * Choix du modèle IA par l'utilisateur — masqué depuis le 08/11/2026.
 *
 * Le serveur choisit le modèle outil par outil : GPT-6 Luna pour les
 * appréciations et les synthèses (constante DEFAUT_LUNA des Edge Functions),
 * les anciens modèles pour les autres outils jusqu'à leur bascule
 * (docs/CONTEXTE-STRATEGIE.md, § 6). La carte « Modèle IA » des Paramètres est
 * donc masquée et seul "default" reste valide : un choix mémorisé dans un
 * navigateur ("gpt-5-mini", retiré par OpenAI le 11/12/2026 ; "mistral-medium",
 * retiré du front le 01/11/2026) n'est plus reconnu, getAIModelChoice() renvoie
 * "default" et secureApi n'envoie plus aucun modèle.
 *
 * Le circuit (aiModel transmis par secureApi, résolu par resolveAIConfig côté
 * serveur) reste en place pour un éventuel choix de modèle en BYOK.
 */
export type AIModelChoice = "default";

/**
 * Clé de stockage localStorage
 */
const STORAGE_KEY = "profassist_ai_model_choice";

/**
 * Options du sélecteur (carte masquée dans les Paramètres)
 */
export const AI_MODEL_OPTIONS: Array<{
  value: AIModelChoice;
  label: string;
  description: string;
}> = [
  {
    value: "default",
    label: "Modèle standard",
    description: "Le modèle choisi par ProfAssist pour chaque outil"
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
  return ["default"].includes(value);
}