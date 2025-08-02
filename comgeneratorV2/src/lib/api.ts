import axios from 'axios';
import type { AppreciationTone } from './types';

interface GenerateAppreciationParams {
  subject: string;
  studentName: string;
  criteria: Array<{
    id: string;
    name: string;
    value: number;
    importance: number;
  }>;
  personalNotes: string;
  minLength: number;
  maxLength: number;
  tone: AppreciationTone;
}

const valueToLabel = (value: number): string => {
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

const importanceToLabel = (importance: number): string => {
  switch (importance) {
    case 1: return "Normal";
    case 2: return "Important";
    case 3: return "Crucial";
    default: return "Normal";
  }
};

const toneDescriptions = {
  bienveillant: "bienveillant et encourageant",
  normal: "neutre et objectif",
  severe: "strict et exigeant"
};

const formatCriteriaForPrompt = (criteria: GenerateAppreciationParams['criteria']) => {
  const evaluatedCriteria = criteria.filter(c => c.value > 0);
  
  if (evaluatedCriteria.length === 0) {
    throw new Error('Aucun critère n\'a été évalué. Veuillez évaluer au moins un critère.');
  }

  return evaluatedCriteria
    .map(c => `- ${c.name} : ${valueToLabel(c.value)} (Importance: ${importanceToLabel(c.importance)})`)
    .join('\n');
};

export async function generateAppreciation(params: GenerateAppreciationParams): Promise<{ detailed: string; summary: string; usedTokens: number }> {
  const evaluatedCriteriaCount = params.criteria.filter(c => c.value > 0).length;
  if (evaluatedCriteriaCount === 0) {
    throw new Error('Veuillez évaluer au moins un critère avant de générer une appréciation.');
  }

  const criteriaText = formatCriteriaForPrompt(params.criteria);

  const prompt = `Tu es un assistant pédagogique chargé de générer des appréciations personnalisées pour les bulletins scolaires. Ton objectif est de créer des synthèses pertinentes et contextualisées en fonction des informations fournies par l'utilisateur (le professeur). Voici les étapes à suivre :

1. **Contexte de la matière** :  
   - Matière : ${params.subject}
   - Critères évalués avec leur importance :
${criteriaText}

2. **Évaluation de l'élève** :  
   - Prénom : ${params.studentName}
   - Niveaux d'évaluation possibles : "Non évalué", "Très insuffisant", "Insuffisant", "Moyen", "Assez bien", "Bien", "Très bien", "Excellent"
   - IMPORTANT : Les critères "Non évalué" ont été automatiquement exclus et ne doivent JAMAIS être mentionnés dans l'appréciation

3. **Notes personnelles du professeur** :  
${params.personalNotes || "Aucune note personnelle"}

4. **Température de l'appréciation** :  
   Le ton doit être ${toneDescriptions[params.tone]}

5. **Longueur de l'appréciation** :  
   - Version détaillée : entre ${params.minLength} et ${params.maxLength} caractères
   - Version synthétique : environ 40% de la longueur de la version détaillée

6. **Structure de l'appréciation** :  
   - Commence par une phrase d'introduction qui résume la performance globale de l'élève
   - Détaille les points forts et les points à améliorer en fonction des critères évalués et de leur importance
   - Termine par une phrase de conclusion qui encourage l'élève ou propose des pistes de progression

7. **Personnalisation** :  
   - Utilise le prénom de l'élève pour rendre l'appréciation plus personnelle
   - Contextualise l'appréciation en fonction de la matière et des critères spécifiques
   - Adapte le niveau de langage pour des élèves de collège et lycée

Génère deux versions de l'appréciation :

Version détaillée :
[Ton appréciation détaillée ici]

Version synthétique :
[Ton appréciation synthétique ici]`;

  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Clé API OpenAI manquante. Veuillez configurer la variable d\'environnement VITE_OPENAI_API_KEY.');
    }

    // Vérifier si la clé API commence par "sk-"
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Format de clé API OpenAI invalide. La clé doit commencer par "sk-".');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Tu es un professeur expérimenté qui rédige des appréciations pour les bulletins scolaires. Tu dois ABSOLUMENT ignorer tous les critères marqués comme "Non évalué" et ne jamais les mentionner dans l\'appréciation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: Math.floor(params.maxLength * 2.5),
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Réponse invalide de l\'API OpenAI. Veuillez réessayer.');
    }

    const content = response.data.choices[0].message.content;
    const parts = content.split('Version synthétique :');
    
    if (parts.length !== 2) {
      throw new Error('Format de réponse invalide. Veuillez réessayer.');
    }

    const detailed = parts[0].replace('Version détaillée :', '').trim();
    const summary = parts[1].trim();
    const usedTokens: number = response.data.usage?.total_tokens ?? 0;

    return {
      detailed,
      summary,
      usedTokens,
    };
  } catch (error: any) {
    console.error('Erreur lors de la génération de l\'appréciation:', error);
    
    if (error.response?.status === 401) {
      throw new Error('Erreur d\'authentification avec l\'API OpenAI. Votre clé API semble invalide.');
    }
    
    if (error.response?.status === 429) {
      throw new Error('Limite de requêtes OpenAI atteinte. Veuillez réessayer dans quelques minutes.');
    }

    if (error.response?.status === 500) {
      throw new Error('Erreur serveur OpenAI. Veuillez réessayer plus tard.');
    }
    
    throw new Error(error.message || 'Une erreur est survenue lors de la génération de l\'appréciation. Veuillez réessayer.');
  }
}