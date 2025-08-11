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

// ✅ FONCTION HELPER POUR L'ADAPTATION TONALE SPÉCIALISÉE
function getToneInstructionsForAppreciation(tone: AppreciationTone): string {
  switch (tone) {
    case "bienveillant":
      return `   - **Chaleur pédagogique** : Utilise des formulations encourageantes et empathiques
   - **Valorisation maximale** : Met l'accent sur les réussites et les potentialités
   - **Optimisme éducatif** : Présente chaque difficulté comme une opportunité de croissance
   - **Proximité bienveillante** : Adopte un ton paternel/maternel approprié au cadre scolaire
   - **Formulations types** : "Je suis fier(e) de...", "Continue sur cette belle lancée", "Tes efforts portent leurs fruits"`;

    case "normal":
      return `   - **Objectivité professionnelle** : Équilibre entre encouragements et axes d'amélioration
   - **Neutralité bienveillante** : Reste factuel tout en maintenant une perspective positive
   - **Clarté pédagogique** : Privilégie les constats précis et les conseils pratiques
   - **Distance professionnelle adaptée** : Ton respectueux sans familiarité excessive
   - **Formulations types** : "Les résultats montrent...", "Il convient de...", "Les progrès sont visibles en..."`;

    case "severe":
      return `   - **Exigence constructive** : Maintiens des standards élevés tout en restant encourageant
   - **Fermeté bienveillante** : Sois direct sur les manques sans décourager
   - **Autorité pédagogique** : Affirme clairement les attentes et les objectifs
   - **Rigueur motivante** : Les exigences sont présentées comme des défis stimulants
   - **Formulations types** : "Des efforts soutenus sont nécessaires...", "Les progrès attendus concernent...", "Une implication plus soutenue permettrait..."`;

    default:
      return `   - Adapte le ton en maintenant la bienveillance éducative et le professionnalisme`;
  }
}

export async function generateAppreciation(params: GenerateAppreciationParams): Promise<{ detailed: string; summary: string; usedTokens: number }> {
  const evaluatedCriteriaCount = params.criteria.filter(c => c.value > 0).length;
  if (evaluatedCriteriaCount === 0) {
    throw new Error('Veuillez évaluer au moins un critère avant de générer une appréciation.');
  }

  const criteriaText = formatCriteriaForPrompt(params.criteria);

  // ✅ PROMPT COMPLET AVEC VOCABULAIRE CORRIGÉ
  const prompt = `Tu es un enseignant expérimenté, expert en évaluation pédagogique et en rédaction d'appréciations de bulletins scolaires. Tu maîtrises parfaitement les enjeux de l'évaluation formative et les codes de communication avec les élèves et leurs familles.

**⚠️ CONTRAINTES CRITIQUES DE LONGUEUR (IMPÉRATIF ABSOLU) :**
- Version détaillée : EXACTEMENT entre ${params.minLength} et ${params.maxLength} caractères (espaces compris)
- Version synthétique : EXACTEMENT entre ${Math.floor(params.maxLength * 0.35)} et ${Math.floor(params.maxLength * 0.45)} caractères (espaces compris)
- COMPTE TOUS les caractères y compris espaces, ponctuation et retours à la ligne
- Si ton texte dépasse : RACCOURCIS en supprimant des détails
- Si ton texte est trop court : DÉVELOPPE avec plus d'encouragements et conseils
- Ces limites sont NON-NÉGOCIABLES et doivent être respectées ABSOLUMENT

**CONTEXTE PÉDAGOGIQUE :**

**MATIÈRE ENSEIGNÉE :** ${params.subject}
**ÉLÈVE ÉVALUÉ :** ${params.studentName}
**TON REQUIS :** ${toneDescriptions[params.tone]}

**CRITÈRES D'ÉVALUATION ANALYSÉS :**
${criteriaText}

**OBSERVATIONS PERSONNELLES DU PROFESSEUR :**
${params.personalNotes || "Aucune observation particulière"}

**INSTRUCTIONS DE RÉDACTION PÉDAGOGIQUE :**

1. **Analyse des compétences évaluées :**
   - Identifie les **points forts** de l'élève selon les critères les mieux évalués
   - Repère les **axes d'amélioration** basés sur les critères plus faibles
   - Prends en compte le **niveau d'importance** de chaque critère dans ta pondération
   - Établis des **liens pédagogiques** entre les différents critères évalués

2. **Adaptation au profil de l'élève :**
   - Personnalise l'appréciation en utilisant le prénom de ${params.studentName}
   - Adapte le vocabulaire au niveau scolaire (collège/lycée)
   - Contextualise les remarques selon la discipline ${params.subject}
   - Intègre les observations personnelles du professeur de manière naturelle

3. **Structure pédagogique des appréciations :**

   **VERSION DÉTAILLÉE (${params.minLength}-${params.maxLength} caractères) :**
   - **Bilan d'ouverture** : Phrase d'accroche positive sur le trimestre/semestre
   - **Valorisation des acquis** : Mise en avant des points forts avec des exemples concrets
   - **Axes de progression** : Identification constructive des améliorations possibles
   - **Conseils méthodologiques** : Pistes concrètes pour progresser
   - **Encouragements** : Conclusion motivante et bienveillante

   **VERSION SYNTHÉTIQUE (${Math.floor(params.maxLength * 0.35)}-${Math.floor(params.maxLength * 0.45)} caractères) :**
   - **Bilan condensé** : Appréciation globale en 2-3 phrases
   - **Essentiel des points forts et axes d'amélioration**
   - **Conclusion encourageante**

4. **Principes de bienveillance éducative :**
   - **Positivité constructive** : Même les difficultés sont présentées comme des leviers de progrès
   - **Équilibre pédagogique** : Chaque appréciation contient encouragements ET pistes d'amélioration
   - **Évitement des jugements de valeur** : Focus sur les compétences et comportements observables
   - **Motivation intrinsèque** : Formulations qui donnent envie de progresser

5. **Vocabulaire pédagogique professionnel adapté :**
   
   **Pour les COMPÉTENCES DISCIPLINAIRES** (connaissances, techniques, méthodes, savoirs) :
   - Utilise : "acquis", "en cours d'acquisition", "à consolider", "maîtrisé", "en voie de maîtrise"
   - Exemples : "Les notions sont acquises", "La technique est en cours d'acquisition"
   
   **Pour les COMPÉTENCES COMPORTEMENTALES** (attitude, écoute, attention, participation, respect, comportement) :
   - Utilise : "satisfaisant", "correct", "à améliorer", "exemplaire", "approprié", "adapté", "constructif"
   - "développe", "renforce", "persévère dans", "maintient", "progresse vers"
   - Exemples : "L'attitude est satisfaisante", "L'écoute reste à améliorer", "Le respect des consignes est exemplaire"
   
   **Pour les COMPÉTENCES MÉTHODOLOGIQUES** (organisation, rigueur, présentation, autonomie, méthode) :
   - Utilise : "efficace", "structuré", "organisé", "rigoureux", "méthodique", "autonome"
   - "développe sa méthode", "structure mieux", "gagne en autonomie"
   - Exemples : "L'organisation est efficace", "La méthode de travail se structure"

   **ÉVITE ABSOLUMENT :**
   - "En cours d'acquisition" pour l'attitude, l'écoute, le comportement, l'attention
   - "Acquis" pour des aspects comportementaux
   - Vocabulaire technique pour des savoir-être

6. **Adaptation tonale selon le profil :**
${getToneInstructionsForAppreciation(params.tone)}

7. **Cohérence évaluative :**
   - L'appréciation doit être **parfaitement cohérente** avec les niveaux attribués
   - Les critères d'importance "Crucial" doivent être **prioritaires** dans l'analyse
   - Les critères "Important" sont **développés** dans la version détaillée
   - Les critères "Normal" sont **mentionnés** de manière équilibrée

**PROCESSUS DE VÉRIFICATION OBLIGATOIRE :**
1. Rédige tes deux versions selon les instructions ci-dessus
2. VÉRIFIE que tu utilises le bon vocabulaire selon le type de compétence
3. COMPTE PRÉCISÉMENT les caractères de chaque version (espaces compris)
4. Si une version dépasse les limites : RACCOURCIS immédiatement
5. Si une version est trop courte : DÉVELOPPE avec plus de détails
6. VÉRIFIE UNE SECONDE FOIS que les longueurs respectent les contraintes

**CONSIGNES DE FINALISATION :**
- **Respect ABSOLU** des limites de caractères imposées
- **Vocabulaire adapté** au type de compétence (disciplinaire/comportementale/méthodologique)
- **Exclusion totale** des critères "Non évalué" (déjà filtrés)
- **Lisibilité** pour élèves, parents et équipe pédagogique
- **Professionnalisme** dans le style et la présentation

**FORMAT DE RÉPONSE OBLIGATOIRE :**

Version détaillée :
[Rédige ici l'appréciation détaillée respectant STRICTEMENT ${params.minLength}-${params.maxLength} caractères]

Version synthétique :
[Rédige ici l'appréciation synthétique respectant STRICTEMENT ${Math.floor(params.maxLength * 0.35)}-${Math.floor(params.maxLength * 0.45)} caractères]

⚠️ RAPPEL FINAL : Les contraintes de longueur sont CRITIQUES et le vocabulaire doit être adapté au type de compétence évaluée.`;

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
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'Tu es un professeur expérimenté qui rédige des appréciations pour les bulletins scolaires. Tu dois ABSOLUMENT ignorer tous les critères marqués comme "Non évalué" et ne jamais les mentionner dans l\'appréciation. Tu dois IMPÉRATIVEMENT respecter les limites de caractères imposées et utiliser un vocabulaire adapté selon le type de compétence (disciplinaire, comportementale, méthodologique).'
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

    let detailed = parts[0].replace('Version détaillée :', '').trim();
    let summary = parts[1].trim();
    
    // ✅ VALIDATION ET CORRECTION AUTOMATIQUE DES LONGUEURS
    const detailedLength = detailed.length;
    const summaryLength = summary.length;
    const expectedSummaryMin = Math.floor(params.maxLength * 0.35);
    const expectedSummaryMax = Math.floor(params.maxLength * 0.45);

    // Correction de la version détaillée si nécessaire
    if (detailedLength > params.maxLength) {
      console.warn(`Version détaillée trop longue (${detailedLength}/${params.maxLength}), troncature automatique`);
      const lastSpace = detailed.lastIndexOf(' ', params.maxLength - 3);
      detailed = detailed.substring(0, lastSpace > params.maxLength * 0.8 ? lastSpace : params.maxLength - 3) + '...';
    }

    // Correction de la version synthétique si nécessaire
    if (summaryLength > expectedSummaryMax) {
      console.warn(`Version synthétique trop longue (${summaryLength}/${expectedSummaryMax}), troncature automatique`);
      const lastSpace = summary.lastIndexOf(' ', expectedSummaryMax - 3);
      summary = summary.substring(0, lastSpace > expectedSummaryMax * 0.8 ? lastSpace : expectedSummaryMax - 3) + '...';
    }

    const usedTokens: number = response.data.usage?.total_tokens ?? 0;

    // Log des longueurs finales pour debug
    console.log('Longueurs finales des appréciations:', {
      detailed: detailed.length,
      summary: summary.length,
      limitesDetaillees: `${params.minLength}-${params.maxLength}`,
      limitesSynthetique: `${expectedSummaryMin}-${expectedSummaryMax}`
    });

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