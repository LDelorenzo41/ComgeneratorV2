// src/lib/api.ts - Version sécurisée utilisant Edge Functions
import { secureApi, type GenerateAppreciationParams } from './secureApi';
import type { AppreciationTone } from './types';

// Réexport de l'interface pour maintenir la compatibilité
export type { GenerateAppreciationParams };

// Fonction principale - maintenant utilise secureApi au lieu d'OpenAI direct
export async function generateAppreciation(params: GenerateAppreciationParams): Promise<{ detailed: string; summary: string; usedTokens: number }> {
  try {
    // Validation locale (garde la même logique qu'avant)
    const evaluatedCriteriaCount = params.criteria.filter(c => c.value > 0).length;
    if (evaluatedCriteriaCount === 0) {
      throw new Error('Veuillez évaluer au moins un critère avant de générer une appréciation.');
    }

    // Appel sécurisé via Edge Function au lieu d'OpenAI direct
    const result = await secureApi.generateAppreciation(params);
    
    return {
      detailed: result.detailed,
      summary: result.summary,
      usedTokens: result.usedTokens
    };
  } catch (error: any) {
    console.error('Erreur lors de la génération de l\'appréciation:', error);
    
    // Gestion d'erreurs améliorée
    if (error.message.includes('Session expirée')) {
      throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
    }
    
    if (error.message.includes('Utilisateur non authentifié')) {
      throw new Error('Vous devez être connecté pour générer des appréciations.');
    }
    
    throw error;
  }
}

// Fonctions utilitaires conservées (pour maintenir la compatibilité)
export const valueToLabel = (value: number): string => {
  switch (value) {
    case 0: return "Non évalué";
    case 1: return "Très insuffisant";
    case 2: return "Insuffisant";
    case 3: return "Moyen";
    case 4: return "Assez bien";
    case 5: return "Bien";
    case 6: return "Très bien";
    case 7: return "Excellent";
    default: return "Non évalué";
  }
};

export const importanceToLabel = (importance: number): string => {
  switch (importance) {
    case 1: return "Normal";
    case 2: return "Important";
    case 3: return "Crucial";
    default: return "Normal";
  }
};

// Fonction utilitaire conservée
function formatCriteriaForPrompt(criteria: GenerateAppreciationParams['criteria']) {
  const evaluatedCriteria = criteria.filter(c => c.value > 0);
  
  if (evaluatedCriteria.length === 0) {
    throw new Error('Aucun critère n\'a été évalué. Veuillez évaluer au moins un critère.');
  }

  return evaluatedCriteria
    .map(c => `- ${c.name} : ${valueToLabel(c.value)} (Importance: ${importanceToLabel(c.importance)})`)
    .join('\n');
}