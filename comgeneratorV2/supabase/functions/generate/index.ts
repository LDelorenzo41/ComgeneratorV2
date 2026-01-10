// supabase/functions/generate/index.ts

// =====================================================
// CONFIGURATION DES MODÈLES IA
// =====================================================

/**
 * Résout la configuration API en fonction du choix de modèle
 * @param {string|undefined} aiModel - Le choix de modèle de l'utilisateur
 * @param {string} openaiKey - Clé API OpenAI
 * @param {string|undefined} mistralKey - Clé API Mistral (optionnelle)
 * @returns {{ endpoint: string, headers: object, model: string, tokenParamName: string, supportsTemperature: boolean, isResponsesAPI: boolean }}
 */
function resolveAIConfig(aiModel, openaiKey, mistralKey) {
  // Modèle par défaut : gpt-4o-mini (comportement actuel inchangé)
  if (!aiModel || aiModel === 'default') {
    return {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      model: 'gpt-4o-mini',
      tokenParamName: 'max_tokens',
      supportsTemperature: true,
      isResponsesAPI: false
    };
  }

  // GPT-5 mini (OpenAI) - utilise l'API Responses, pas Chat Completions
  if (aiModel === 'gpt-5-mini') {
    return {
      endpoint: 'https://api.openai.com/v1/responses',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      model: 'gpt-5-mini',
      tokenParamName: 'max_output_tokens',
      supportsTemperature: false,
      isResponsesAPI: true
    };
  }

  // Mistral Medium
  if (aiModel === 'mistral-medium') {
    if (!mistralKey) {
      throw new Error('MISTRAL_API_KEY non configurée');
    }
    return {
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${mistralKey}`,
        'Content-Type': 'application/json'
      },
      model: 'mistral-medium-latest',
      tokenParamName: 'max_tokens',
      supportsTemperature: true,
      isResponsesAPI: false
    };
  }

  // Fallback : modèle par défaut si choix non reconnu
  console.warn(`Modèle non reconnu: ${aiModel}, utilisation du modèle par défaut`);
  return {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    model: 'gpt-4o-mini',
    tokenParamName: 'max_tokens',
    supportsTemperature: true,
    isResponsesAPI: false
  };
}


/**
 * Parse la réponse de l'IA pour extraire les versions détaillée et synthétique
 * Gère mieux les balises Markdown (**Version...**) de Mistral
 */
function parseAIResponse(content) {
  if (!content) return null;

  // Essayer le format standard avec "Version synthétique :" (avec tolérance au markdown et ponctuation)
  // Split sur : (espaces/etoiles/diese) "Version synthétique" (espaces/etoiles/diese/deux-points)
  let parts = content.split(/[\s\*\#\-_]*Version\s+synthétique[\s\*\#\-_:]*/i);
  
  // Si ça échoue, essayer juste "Synthétique :" ou "Résumé :"
  if (parts.length < 2) {
    parts = content.split(/[\s\*\#\-_]*(?:Synthétique|Résumé|Summary)[\s\*\#\-_:]+/i);
  }

  // Si ça échoue, essayer le format avec séparateur "---" ou "***"
  if (parts.length < 2) {
    parts = content.split(/\n[\s\*\-]{3,}\n/);
  }

  if (parts.length >= 2) {
    let detailed = parts[0];
    let summary = parts[parts.length - 1];
    
    // Nettoyage préventif du label "Version détaillée" au début (même avec Markdown)
    detailed = detailed.replace(/^[\s\*\#\-_]*(?:Version\s+|Partie\s+)?(?:détaillée|detailed)[\s\*\#\-_:]*/gi, '').trim();
    
    return { detailed, summary };
  }

  // Dernier recours : diviser en deux parties mathématiquement
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length >= 2) {
    const midPoint = Math.floor(lines.length * 0.7);
    const detailed = lines.slice(0, midPoint).join('\n').trim();
    const summary = lines.slice(midPoint).join('\n').trim();
    return { detailed, summary };
  }

  // Échec total
  return null;
}


/**
 * Nettoie le texte de sortie (supprime markdown, compteurs de caractères, labels, etc.)
 * CORRIGÉ : Supprime agressivement la ponctuation résiduelle (:) au début
 */
function cleanOutputText(text) {
  if (!text) return text;
  
  let cleaned = text.trim();
  
  // 1. Supprimer "Version détaillée/synthétique" même s'il y a du gras (**), des titres (#) ou des tirets
  cleaned = cleaned.replace(/^[\s\*\#\-_]*(?:Version\s+|Partie\s+)?(?:détaillée|detailed)[\s\*\#\-_:]*/gmi, '');
  cleaned = cleaned.replace(/^[\s\*\#\-_]*(?:Version\s+|Partie\s+)?(?:synthétique|résumé|summary)[\s\*\#\-_:]*/gmi, '');
  
  // 2. Supprimer les balises markdown de mise en forme
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/^#{1,6}\s*/gm, '');
  cleaned = cleaned.replace(/`{1,3}/g, '');
  
  // 3. Supprimer les mentions de nombre de caractères (ex: [350 chars], (400 caractères))
  cleaned = cleaned.replace(/\s*\(?\[?\d+\s*(?:caractères?|car\.?|chars?|mots?|words?)\]?\)?\.?\s*/gi, '');
  
  // 4. Supprimer les lignes qui ne contiennent que des informations de comptage
  cleaned = cleaned.replace(/^.*(?:total|compte|longueur|length|respect).*:\s*\d+.*$/gmi, '');
  
  // 5. Supprimer les lignes vides multiples
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // 6. Supprimer les espaces en début/fin
  cleaned = cleaned.trim();

  // 7. ✅ NETTOYAGE ULTIME : Supprimer tout caractère de ponctuation ou espace qui traîne au tout début
  // Cela élimine les ":" orphelins, les "-", les "*" qui seraient restés après la suppression du titre
  cleaned = cleaned.replace(/^[\s:\-\*]+/, '');
  
  return cleaned;
}





// =====================================================
// HANDLER PRINCIPAL
// =====================================================

const generateHandler = async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
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
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', {
        status: 500,
        headers: corsHeaders
      });
    }

    const params = await req.json();

    // Extraire le choix de modèle (optionnel)
    const aiModel = params.aiModel;

    // Résoudre la configuration API
    let aiConfig;
    try {
      aiConfig = resolveAIConfig(aiModel, OPENAI_API_KEY, MISTRAL_API_KEY);
    } catch (configError) {
      return new Response(JSON.stringify({
        error: configError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Log du modèle utilisé (pour debug)
    console.log(`Modèle IA utilisé: ${aiConfig.model}`);

    // Validation - reproduction exacte de votre logique
    const evaluatedCriteriaCount = params.criteria.filter((c) => c.value > 0).length;
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

6. **⚠️ RÈGLE CRITIQUE : Distinction entre critères ACTIONNABLES et critères de RÉSULTATS :**

   **PRIORITÉ ABSOLUE : Établir des liens causaux UNIQUEMENT avec les critères évalués**
   
   **CRITÈRES ACTIONNABLES** (peuvent être travaillés directement par l'élève) :
   - **Exemples** : attitude, écoute, application des consignes, participation, organisation, soin, autonomie, comportement, attention, rigueur, méthode de travail
   - **Comment les traiter** : Ces critères PEUVENT être mentionnés comme axes d'amélioration directs
   - **Formulations correctes** :
     - ✅ "L'attitude doit être améliorée"
     - ✅ "Il conviendrait de renforcer l'écoute en classe"
     - ✅ "L'application des consignes nécessite plus d'attention"
     - ✅ "Ton organisation doit être travaillée"
   
   **CRITÈRES DE RÉSULTATS** (conséquences du travail, ne peuvent PAS être travaillés directement) :
   - **Exemples** : résultats, notes, performances, réussite aux évaluations, résultats aux contrôles, moyenne, niveau
   - **ERREUR ABSOLUE À ÉVITER** : 
     - ❌ "Tu dois travailler tes résultats" / "Les résultats doivent être améliorés" / "Il faut travailler les notes"
     - ❌ INVENTER des causes non évaluées (révisions, compréhension, etc.)
   
   **RÈGLE D'OR - ANALYSE CAUSALE STRICTE :**
   
   **CAS 1 : Il existe des critères ACTIONNABLES évalués qui peuvent expliquer les résultats**
   → Tu DOIS faire le lien explicite entre résultats et critères actionnables évalués
   
   Exemples avec critères évalués [Résultats: Insuffisant, Application des consignes: Moyen] :
   - ✅ "Les résultats insuffisants s'expliquent en partie par une application des consignes qui reste moyenne. En renforçant le respect des consignes, les performances progresseront."
   - ✅ "Le niveau actuel est lié à une application encore fragile des consignes. Un effort sur ce point améliorera les résultats."
   
   **CAS 2 : Aucun critère actionnable évalué n'explique directement les résultats**
   → Reste FACTUEL, ne mentionne QUE les critères évalués, n'invente RIEN
   
   Exemples avec critères évalués [Résultats: Insuffisant, Attitude: Bien, Participation: Bien] :
   - ✅ "Les résultats restent insuffisants malgré une attitude et une participation satisfaisantes."
   - ✅ "Le niveau actuel ne reflète pas encore l'attitude positive et la participation active."
   - ❌ "Les résultats nécessitent un approfondissement des révisions" (INTERDIT si "révisions" n'est pas un critère évalué)

7. **⚠️ RÈGLE GRAMMATICALE CRITIQUE pour les formulations avec les critères évalués :**

   Tu NE DOIS JAMAIS reprendre mot pour mot les niveaux "Très insuffisant / Insuffisant / Moyen / Assez bien / Bien / Très bien / Excellent" derrière un nom comme "attitude", "participation", "application des consignes", "comportement", "écoute", etc.
   Tu dois TOUJOURS transformer ces niveaux en adjectifs corrects en français.

   ---

   **7.1. Pour "niveau / résultats / notes / performances" :**

   Tu dois transformer le niveau en adjectif AVANT le nom.

   - "Très insuffisant" → "un niveau très insuffisant" / "des résultats très insuffisants"
   - "Insuffisant" → "des résultats insuffisants"
   - "Moyen" → "un niveau moyen"
   - "Assez bien" → "un assez **bon** niveau"
   - "Bien" → "de **bons** résultats"
   - "Très bien" → "un très **bon** niveau"
   - "Excellent" → "d'**excellents** résultats"

   **INTERDIT** :
   - "un niveau assez bien"
   - "des résultats bien"
   - "un niveau très bien"

   ---

   **7.2. Pour les critères de comportement, attitude et implication :**

   Tu dois absolument convertir le niveau en adjectif adapté :

   - "Attitude : Bien" → "une bonne attitude"
   - "Attitude : Assez bien" → "une attitude assez bonne" ou "une attitude globalement satisfaisante"
   - "Participation : Bien" → "une bonne participation"
   - "Participation : Moyen" → "une participation moyenne"
   - "Application des consignes : Assez bien" → 
     - "une application des consignes assez bonne"
     - ou "elle applique globalement bien les consignes"
   - "Comportement : Très bien" → "un très bon comportement"

   **INTERDIT** :
   - "une attitude bien"
   - "une attitude assez bien"
   - "l'application des consignes est assez bien"
   - "une participation bien"
   - "un comportement bien"

   ---

   **7.3. RÈGLE D'OR**

   Tu peux conserver les niveaux EXACTS dans la liste des critères (c'est ce que voit le professeur),  
   mais dans l'appréciation tu dois TOUJOURS :

   - transformer le niveau en adjectif grammaticalement correct,
   - choisir parmi : bon / satisfaisant / correct / faible / limité / solide / attentif / sérieux / rigoureux…
   - ne JAMAIS coller littéralement : "attitude + niveau", "participation + niveau", etc.

   Ton texte DOIT toujours être du français naturel et professionnel.

8. **Adaptation tonale selon le profil :**
${getToneInstructionsForAppreciation(params.tone)}

9. **Cohérence évaluative :**
   - L'appréciation doit être **parfaitement cohérente** avec les niveaux attribués
   - Les critères d'importance "Crucial" doivent être **prioritaires** dans l'analyse
   - Les critères "Important" sont **développés** dans la version détaillée
   - Les critères "Normal" sont **mentionnés** de manière équilibrée

**PROCESSUS DE VÉRIFICATION OBLIGATOIRE :**
1. VÉRIFIE d'abord que tu respectes le mode d'adresse : ${addressModeDescriptions[params.addressMode]}
2. IDENTIFIE les critères de RÉSULTATS et les critères ACTIONNABLES dans la liste fournie
3. Si des résultats sont faibles ET qu'il existe des critères actionnables faibles : FAIS LE LIEN explicite
4. N'INVENTE JAMAIS de causes non présentes dans les critères évalués
5. VÉRIFIE la grammaire pour niveau/résultats/notes (adjectif AVANT le nom)
6. Rédige tes deux versions selon les instructions ci-dessus
7. VÉRIFIE que tu utilises le bon vocabulaire selon le type de compétence
8. COMPTE PRÉCISÉMENT les caractères de chaque version (espaces compris)
9. Si une version dépasse les limites : RACCOURCIS immédiatement
10. Si une version est trop courte : DÉVELOPPE avec plus de détails
11. VÉRIFIE UNE SECONDE FOIS que les longueurs respectent les contraintes
12. VÉRIFIE UNE DERNIÈRE FOIS le mode d'adresse dans CHAQUE phrase

**CONSIGNES DE FINALISATION :**
- **Respect ABSOLU** du mode d'adresse ${addressModeDescriptions[params.addressMode]}
- **Respect ABSOLU** des limites de caractères imposées
- **Vocabulaire adapté** au type de compétence (disciplinaire/comportementale/méthodologique)
- **Analyse causale STRICTE** : liens uniquement avec critères évalués, pas d'invention
- **Grammaire correcte** : "un assez bon niveau" (PAS "un niveau assez bien")
- **Exclusion totale** des critères "Non évalué" (déjà filtrés)
- **Lisibilité** pour élèves, parents et équipe pédagogique
- **Professionnalisme** dans le style et la présentation

**FORMAT DE RÉPONSE OBLIGATOIRE :**

Version détaillée :
[Rédige ici l'appréciation détaillée respectant STRICTEMENT ${params.minLength}-${params.maxLength} caractères]


[Rédige ici l'appréciation synthétique respectant STRICTEMENT ${Math.floor(params.maxLength * 0.35)}-${Math.floor(params.maxLength * 0.45)} caractères]

⚠️ RAPPEL FINAL : Le mode d'adresse ${addressModeDescriptions[params.addressMode]} est une CONTRAINTE ABSOLUE, les contraintes de longueur sont CRITIQUES, le vocabulaire doit être adapté au type de compétence évaluée, l'analyse causale doit se limiter STRICTEMENT aux critères évalués (pas d'invention), et la grammaire pour niveau/résultats/notes doit placer l'adjectif AVANT le nom.`;

    // ✅ Calculer le nombre de tokens selon le modèle
    let tokenLimit;
    if (aiConfig.model === 'gpt-5-mini') {
      tokenLimit = 4000; // Limite pour GPT-5 mini (API Responses)
    } else {
      tokenLimit = Math.floor(params.maxLength * 2.5);
    }

    // ✅ System prompt pour les modèles Chat
    const systemPrompt = `Tu es un professeur expérimenté qui rédige des appréciations pour les bulletins scolaires.

⚠️ RÈGLE ANTI-HALLUCINATIONS (PRIORITÉ ABSOLUE) :
Tu dois rester STRICTEMENT FACTUEL. 
Tu NE DOIS JAMAIS inventer une cause, une explication, un raisonnement ou un lien qui n'est PAS explicitement présent dans les critères évalués.
Si aucun lien causal évident n'existe entre les critères évalués, tu dois écrire : 
"Aucun critère ne permet d'expliquer clairement ce niveau." 
Tu n'as PAS le droit d'ajouter des interprétations externes (révisions, compréhension, méthode de travail, fondamentaux, apprentissage, etc.) sauf si ces termes apparaissent EXACTEMENT dans les critères.

⚠️ RÈGLE ABSOLUE #1 - MODE D'ADRESSE :
${getSystemAddressModeMessage(params.addressMode)}

RÈGLE #2 : Tu dois ABSOLUMENT ignorer tous les critères marqués comme "Non évalué" et ne jamais les mentionner dans l'appréciation.

RÈGLE #3 : Tu dois IMPÉRATIVEMENT respecter les limites de caractères imposées et utiliser un vocabulaire adapté selon le type de compétence (disciplinaire, comportementale, méthodologique).

RÈGLE #4 CRITIQUE : Les critères liés aux RÉSULTATS/NOTES/PERFORMANCES sont des CONSÉQUENCES. Tu dois faire des liens causaux UNIQUEMENT avec les critères actionnables effectivement évalués. N'INVENTE JAMAIS de causes (révisions, compréhension, etc.) qui ne sont pas dans les critères évalués.

RÈGLE #5 GRAMMATICALE : Pour niveau/résultats/notes, transforme l'évaluation en adjectif AVANT le nom : "un assez BON niveau" (PAS "un niveau assez bien"), "de BONS résultats" (PAS "des résultats bien").`;

    // ✅ Construction du body selon le type d'API
    let requestBody;

    if (aiConfig.isResponsesAPI) {
      // API Responses (GPT-5 mini) - format différent
      // Fusionner system prompt et user prompt en un seul input
      const fullPrompt = `${systemPrompt}\n\n---\n\n${prompt}`;
      
      requestBody = {
        model: aiConfig.model,
        input: fullPrompt,
        [aiConfig.tokenParamName]: tokenLimit,
        // ✅ CORRECTION GPT-5 MINI (OBLIGATOIRE)
        text: {
          format: { type: "text" }
        },
        reasoning: {
          effort: "low"
        }
      };
    } else {
      // API Chat Completions (GPT-4, Mistral) - format standard
      requestBody = {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        ...(aiConfig.supportsTemperature && { temperature: 0.2 }),
        [aiConfig.tokenParamName]: tokenLimit
      };
    }

    // Appel API
    const response = await fetch(aiConfig.endpoint, {
      method: "POST",
      headers: aiConfig.headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`${aiConfig.model} API Error:`, error);
      return new Response(`${aiConfig.model} API Error`, {
        status: response.status,
        headers: corsHeaders
      });
    }

    const aiData = await response.json();

    // ✅ Log pour débugger le format de réponse
    console.log('Réponse API brute:', JSON.stringify(aiData, null, 2));

    // ✅ Extraire le contenu selon le type d'API
    let content = null;
    
    if (aiConfig.isResponsesAPI) {
      // API Responses (GPT-5 mini) - format avec tableau output
      // Structure: { output: [{ type: "reasoning", ... }, { type: "message", content: [{ type: "output_text", text: "..." }] }] }
      
      if (aiData?.output && Array.isArray(aiData.output)) {
        // Chercher l'élément de type "message"
        const messageItem = aiData.output.find(item => item.type === 'message');
        
        if (messageItem?.content && Array.isArray(messageItem.content)) {
          // Chercher l'élément de type "output_text" dans content
          const outputText = messageItem.content.find(c => c.type === 'output_text');
          if (outputText?.text) {
            content = outputText.text;
          }
        }
      }
      // Fallback si structure différente
      if (!content && aiData?.output_text) {
        content = aiData.output_text;
      }
    } else {

      // API Chat Completions (GPT-4, Mistral) - format standard
      if (aiData?.choices?.[0]?.message?.content) {
        content = aiData.choices[0].message.content;
      } else if (aiData?.choices?.[0]?.text) {
        content = aiData.choices[0].text;
      }
    }

    if (!content) {
      console.error('Format de réponse non reconnu:', JSON.stringify(aiData, null, 2));
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API. Veuillez réessayer.'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // ✅ Utiliser le parser amélioré pour gérer les différents formats
    const parsed = parseAIResponse(content);
    
    if (!parsed) {
      console.error('Format de réponse non reconnu:', content.substring(0, 500));
      return new Response(JSON.stringify({
        error: 'Format de réponse invalide. Veuillez réessayer.'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let { detailed, summary } = parsed;

    // ✅ Nettoyer les sorties avec la fonction améliorée
    detailed = cleanOutputText(detailed);
    summary = cleanOutputText(summary);

    // ✅ VALIDATION ET CORRECTION AUTOMATIQUE DES LONGUEURS
    const detailedLength = detailed.length;
    const summaryLength = summary.length;
    const expectedSummaryMin = Math.floor(params.maxLength * 0.35);
    const expectedSummaryMax = Math.floor(params.maxLength * 0.45);

    // Correction de la version détaillée si nécessaire
    if (detailedLength > params.maxLength) {
      console.warn(`Version détaillée trop longue (${detailedLength}/${params.maxLength}), coupe douce`);
      let cut = detailed.substring(0, params.maxLength);
      const lastDot = cut.lastIndexOf('.');
      const lastSemi = cut.lastIndexOf(';');
      const lastExcl = cut.lastIndexOf('!');
      const lastQuest = cut.lastIndexOf('?');
      const cutPoints = [lastDot, lastSemi, lastExcl, lastQuest];
      const bestCut = Math.max(...cutPoints);
      if (bestCut > params.maxLength * 0.6) {
        detailed = cut.substring(0, bestCut + 1).trim();
      } else {
        const lastSpace = cut.lastIndexOf(' ');
        detailed = cut.substring(0, lastSpace).trim();
      }
    }

    // Correction de la version synthétique si nécessaire
    if (summaryLength > expectedSummaryMax) {
      console.warn(`Version synthétique trop longue (${summaryLength}/${expectedSummaryMax}), coupe douce finale`);
      let cut = summary.substring(0, expectedSummaryMax).trim();
      const punctuations = ['.', '!', '?', ';'];
      let bestCutIndex = -1;
      punctuations.forEach((p) => {
        const idx = cut.lastIndexOf(p);
        if (idx > bestCutIndex) bestCutIndex = idx;
      });
      if (bestCutIndex !== -1 && bestCutIndex > expectedSummaryMax * 0.5) {
        summary = cut.substring(0, bestCutIndex + 1).trim();
      } else {
        const lastSpace = cut.lastIndexOf(' ');
        const shorter = cut.substring(0, lastSpace).trim();
        let finalCutIndex = -1;
        punctuations.forEach((p) => {
          const idx = shorter.lastIndexOf(p);
          if (idx > finalCutIndex) finalCutIndex = idx;
        });
        if (finalCutIndex !== -1) {
          summary = shorter.substring(0, finalCutIndex + 1).trim();
        } else {
          summary = shorter;
        }
      }
    }

    const usedTokens = aiData.usage?.total_tokens ?? 0;

    // Log des longueurs finales pour debug
    console.log('Longueurs finales des appréciations:', {
      model: aiConfig.model,
      detailed: detailed.length,
      summary: summary.length,
      limitesDetaillees: `${params.minLength}-${params.maxLength}`,
      limitesSynthetique: `${expectedSummaryMin}-${expectedSummaryMax}`,
      addressMode: params.addressMode
    });

    return new Response(JSON.stringify({
      detailed,
      summary,
      usedTokens
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Erreur lors de la génération de l\'appréciation:', error);

    if (error.response?.status === 401) {
      return new Response(JSON.stringify({
        error: 'Erreur d\'authentification avec l\'API. Votre clé API semble invalide.'
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (error.response?.status === 429) {
      return new Response(JSON.stringify({
        error: 'Limite de requêtes atteinte. Veuillez réessayer dans quelques minutes.'
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (error.response?.status === 500) {
      return new Response(JSON.stringify({
        error: 'Erreur serveur. Veuillez réessayer plus tard.'
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

// =====================================================
// FONCTIONS HELPER (inchangées)
// =====================================================

function formatCriteriaForPrompt(criteria) {
  const evaluatedCriteria = criteria.filter((c) => c.value > 0);
  if (evaluatedCriteria.length === 0) {
    throw new Error('Aucun critère n\'a été évalué. Veuillez évaluer au moins un critère.');
  }
  return evaluatedCriteria.map((c) => `- ${c.name} : ${valueToLabel(c.value)} (Importance: ${importanceToLabel(c.importance)})`).join('\n');
}

function valueToLabel(value) {
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

function importanceToLabel(importance) {
  switch (importance) {
    case 1: return "Normal";
    case 2: return "Important";
    case 3: return "Crucial";
    default: return "Normal";
  }
}

function getToneInstructionsForAppreciation(tone) {
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

function getAddressModeInstructions(addressMode, studentName) {
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

function getSystemAddressModeMessage(addressMode) {
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