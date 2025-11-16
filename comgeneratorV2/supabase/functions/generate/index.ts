// supabase/functions/generate/index.ts

// Déclarations pour l'environnement Deno
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

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
  tone: 'bienveillant' | 'normal' | 'severe';
  addressMode: 'tutoiement' | 'vouvoiement' | 'impersonnel';
}

const generateHandler = async (req: Request): Promise<Response> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const params: GenerateAppreciationParams = await req.json();
    
    // Validation - reproduction exacte de votre logique
    const evaluatedCriteriaCount = params.criteria.filter(c => c.value > 0).length;
    if (evaluatedCriteriaCount === 0) {
      return new Response(JSON.stringify({
        error: 'Veuillez évaluer au moins un critère avant de générer une appréciation.'
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const criteriaText = formatCriteriaForPrompt(params.criteria);
    
    const toneDescriptions = {
      bienveillant: "bienveillant et encourageant",
      normal: "neutre et objectif", 
      severe: "strict et exigeant"
    };

    const addressModeDescriptions = {
      tutoiement: "TUTOIEMENT (tu/te/ton/ta/tes)",
      vouvoiement: "VOUVOIEMENT (vous/votre/vos)",
      impersonnel: "FORMULATION IMPERSONNELLE (l'élève/il/elle)"
    };

    // Reproduction exacte de votre prompt complet
    const prompt = `Tu es un enseignant expérimenté, expert en évaluation pédagogique et en rédaction d'appréciations de bulletins scolaires. Tu maîtrises parfaitement les enjeux de l'évaluation formative et les codes de communication avec les élèves et leurs familles.

**⚠️ CONTRAINTE CRITIQUE #1 - MODE D'ADRESSE (PRIORITÉ ABSOLUE) :**
${getAddressModeInstructions(params.addressMode, params.studentName)}

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
**MODE D'ADRESSE IMPOSÉ :** ${addressModeDescriptions[params.addressMode]}

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
1. VÉRIFIE d'abord que tu respectes le mode d'adresse : ${addressModeDescriptions[params.addressMode]}
2. Rédige tes deux versions selon les instructions ci-dessus
3. VÉRIFIE que tu utilises le bon vocabulaire selon le type de compétence
4. COMPTE PRÉCISÉMENT les caractères de chaque version (espaces compris)
5. Si une version dépasse les limites : RACCOURCIS immédiatement
6. Si une version est trop courte : DÉVELOPPE avec plus de détails
7. VÉRIFIE UNE SECONDE FOIS que les longueurs respectent les contraintes
8. VÉRIFIE UNE DERNIÈRE FOIS le mode d'adresse dans CHAQUE phrase

**CONSIGNES DE FINALISATION :**
- **Respect ABSOLU** du mode d'adresse ${addressModeDescriptions[params.addressMode]}
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

⚠️ RAPPEL FINAL : Le mode d'adresse ${addressModeDescriptions[params.addressMode]} est une CONTRAINTE ABSOLUE, les contraintes de longueur sont CRITIQUES et le vocabulaire doit être adapté au type de compétence évaluée.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: 'system',
            content: `Tu es un professeur expérimenté qui rédige des appréciations pour les bulletins scolaires.

⚠️ RÈGLE ABSOLUE #1 - MODE D'ADRESSE :
${getSystemAddressModeMessage(params.addressMode)}

RÈGLE #2 : Tu dois ABSOLUMENT ignorer tous les critères marqués comme "Non évalué" et ne jamais les mentionner dans l'appréciation.

RÈGLE #3 : Tu dois IMPÉRATIVEMENT respecter les limites de caractères imposées et utiliser un vocabulaire adapté selon le type de compétence (disciplinaire, comportementale, méthodologique).`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: Math.floor(params.maxLength * 2.5),
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API Error:', error);
      return new Response('OpenAI API Error', { 
        status: response.status, 
        headers: corsHeaders 
      });
    }

    const openAIData = await response.json();
    
    if (!openAIData?.choices?.[0]?.message?.content) {
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API OpenAI. Veuillez réessayer.'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const content = openAIData.choices[0].message.content;
    const parts = content.split('Version synthétique :');
    
    if (parts.length !== 2) {
      return new Response(JSON.stringify({
        error: 'Format de réponse invalide. Veuillez réessayer.'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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

    const usedTokens: number = openAIData.usage?.total_tokens ?? 0;

    // Log des longueurs finales pour debug
    console.log('Longueurs finales des appréciations:', {
      detailed: detailed.length,
      summary: summary.length,
      limitesDetaillees: `${params.minLength}-${params.maxLength}`,
      limitesSynthetique: `${expectedSummaryMin}-${expectedSummaryMax}`,
      addressMode: params.addressMode
    });

    return new Response(JSON.stringify({
      detailed,
      summary,
      usedTokens,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error: any) {
    console.error('Erreur lors de la génération de l\'appréciation:', error);
    
    if (error.response?.status === 401) {
      return new Response(JSON.stringify({
        error: 'Erreur d\'authentification avec l\'API OpenAI. Votre clé API semble invalide.'
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    if (error.response?.status === 429) {
      return new Response(JSON.stringify({
        error: 'Limite de requêtes OpenAI atteinte. Veuillez réessayer dans quelques minutes.'
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (error.response?.status === 500) {
      return new Response(JSON.stringify({
        error: 'Erreur serveur OpenAI. Veuillez réessayer plus tard.'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    return new Response(JSON.stringify({
      error: error.message || 'Une erreur est survenue lors de la génération de l\'appréciation. Veuillez réessayer.'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

// Fonctions helper reproduites exactement
function formatCriteriaForPrompt(criteria: GenerateAppreciationParams['criteria']) {
  const evaluatedCriteria = criteria.filter(c => c.value > 0);
  
  if (evaluatedCriteria.length === 0) {
    throw new Error('Aucun critère n\'a été évalué. Veuillez évaluer au moins un critère.');
  }

  return evaluatedCriteria
    .map(c => `- ${c.name} : ${valueToLabel(c.value)} (Importance: ${importanceToLabel(c.importance)})`)
    .join('\n');
}

function valueToLabel(value: number): string {
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
}

function importanceToLabel(importance: number): string {
  switch (importance) {
    case 1: return "Normal";
    case 2: return "Important";
    case 3: return "Crucial";
    default: return "Normal";
  }
}

function getToneInstructionsForAppreciation(tone: 'bienveillant' | 'normal' | 'severe'): string {
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

function getAddressModeInstructions(addressMode: 'tutoiement' | 'vouvoiement' | 'impersonnel', studentName: string): string {
  switch (addressMode) {
    case "tutoiement":
      return `Tu DOIS ABSOLUMENT utiliser le TUTOIEMENT dans TOUTE l'appréciation :
- Utilise UNIQUEMENT : "tu", "te", "t'", "ton", "ta", "tes"
- Exemples corrects : "Tu montres", "Ton travail", "Tu dois", "Tes efforts"
- INTERDIT : "vous", "votre", "vos", "l'élève", "il/elle"
- Cette règle s'applique à CHAQUE phrase sans exception.`;

    case "vouvoiement":
      return `Tu DOIS ABSOLUMENT utiliser le VOUVOIEMENT dans TOUTE l'appréciation :
- Utilise UNIQUEMENT : "vous", "votre", "vos"
- Exemples corrects : "Vous montrez", "Votre travail", "Vous devez", "Vos efforts"
- INTERDIT : "tu", "te", "ton", "ta", "tes", "l'élève", "il/elle"
- Cette règle s'applique à CHAQUE phrase sans exception.`;

    case "impersonnel":
      return `Tu DOIS ABSOLUMENT utiliser une FORMULATION IMPERSONNELLE dans TOUTE l'appréciation :
- Utilise UNIQUEMENT : "l'élève", "il", "elle", "son", "sa", "ses", le prénom de l'élève
- Exemples corrects : "L'élève montre", "Son travail", "Elle doit", "Ses efforts", "${studentName} démontre"
- INTERDIT : "tu", "te", "ton", "ta", "tes", "vous", "votre", "vos"
- Cette règle s'applique à CHAQUE phrase sans exception.`;

    default:
      return `Utilise le tutoiement par défaut.`;
  }
}

function getSystemAddressModeMessage(addressMode: 'tutoiement' | 'vouvoiement' | 'impersonnel'): string {
  switch (addressMode) {
    case "tutoiement":
      return `Tu dois IMPÉRATIVEMENT utiliser le TUTOIEMENT (tu/te/ton/ta/tes) dans chaque phrase de l'appréciation. L'utilisation de "vous", "votre", "l'élève" ou "il/elle" est une ERREUR CRITIQUE.`;

    case "vouvoiement":
      return `Tu dois IMPÉRATIVEMENT utiliser le VOUVOIEMENT (vous/votre/vos) dans chaque phrase de l'appréciation. L'utilisation de "tu", "te", "l'élève" ou "il/elle" est une ERREUR CRITIQUE.`;

    case "impersonnel":
      return `Tu dois IMPÉRATIVEMENT utiliser une FORMULATION IMPERSONNELLE (l'élève/il/elle/son/sa/ses ou le prénom) dans chaque phrase de l'appréciation. L'utilisation de "tu", "te", "vous" ou "votre" est une ERREUR CRITIQUE.`;

    default:
      return `Utilise le tutoiement par défaut.`;
  }
}

Deno.serve(generateHandler);