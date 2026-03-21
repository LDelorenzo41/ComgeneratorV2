// supabase/functions/exercises/index.ts
// Edge function pour générer des supports pédagogiques (exercices, fiches, QCM...)

// =====================================================
// CONFIGURATION DES MODÈLES IA
// =====================================================

function resolveAIConfig(aiModel: string | undefined, openaiKey: string, mistralKey: string | undefined) {
  if (!aiModel || aiModel === 'default') {
    return {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      model: 'gpt-4.1-mini',
      isResponsesAPI: false,
    };
  }

  if (aiModel === 'gpt-5-mini') {
    return {
      endpoint: 'https://api.openai.com/v1/responses',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      model: 'gpt-5-mini',
      isResponsesAPI: true,
    };
  }

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
      isResponsesAPI: false,
    };
  }

  // Fallback
  return {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    model: 'gpt-4.1-mini',
    isResponsesAPI: false,
  };
}

// =====================================================
// HELPERS
// =====================================================

async function createServiceClient() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function deductTokens(
  serviceClient: any,
  userId: string,
  tokensUsed: number
): Promise<void> {
  if (tokensUsed <= 0) return;

  const { data } = await serviceClient
    .from('profiles')
    .select('tokens')
    .eq('user_id', userId)
    .single();

  if (data) {
    await serviceClient
      .from('profiles')
      .update({ tokens: Math.max(0, data.tokens - tokensUsed) })
      .eq('user_id', userId);
  }
}

function cleanOutputText(text: string): string {
  if (!text) return text;
  let cleaned = text.trim();

  // Supprimer les blocs de code markdown englobants (```markdown ... ``` ou ``` ... ```)
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (cleaned.startsWith('```') && !cleaned.startsWith('```mermaid') && !cleaned.startsWith('```chart')) {
    cleaned = cleaned.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Corriger les tableaux markdown mal formatés
  // Double pipes || → |
  cleaned = cleaned.replace(/\|\|+/g, '|');
  // Lignes de séparateur cassées (ex: |---|---|  ou  | --- | --- |) : normaliser
  cleaned = cleaned.replace(/^\|[\s\-:|]+\|$/gm, (match) => {
    const cols = match.split('|').filter(c => c.trim() !== '');
    return '|' + cols.map(() => ' --- ').join('|') + '|';
  });

  // Supprimer les lignes vides parasites à l'intérieur des tableaux
  // (une ligne vide entre deux lignes commençant par | casse le tableau)
  cleaned = cleaned.replace(/(\|.*\|)\n\n+(\|.*\|)/g, '$1\n$2');

  // Supprimer les balises HTML parasites parfois injectées par certains modèles
  cleaned = cleaned.replace(/<\/?br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<\/?div[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?span[^>]*>/gi, '');

  return cleaned.trim();
}

// =====================================================
// MAPPING DES TYPES DE SUPPORTS
// =====================================================

const SUPPORT_TYPE_INSTRUCTIONS: Record<string, string> = {
  auto: `Analyse la phase et crée le support le plus utile — celui qui apporte le CONTENU CONCRET manquant.
Ne reformule pas la phase. Demande-toi : "De quoi l'élève a besoin entre les mains pour réussir cette activité ?"
Exemples : une fiche avec des routines tactiques illustrées (EPS), un texte source à analyser (Français/HG), un protocole expérimental détaillé (Sciences), des exercices progressifs avec méthode (Maths), un dialogue modèle (Langues).
Si la phase implique des processus, des méthodes en étapes, des données chiffrées, ou des situations spatiales (EPS, géométrie), inclus un diagramme mermaid ou un graphique chart pour les visualiser.`,

  contexte: `La phase mentionne un document, un scénario, un texte ou une situation que les élèves doivent utiliser, mais ce support n'est pas fourni.
Génère ce document de manière réaliste, détaillée et experte :
- Texte littéraire ou documentaire : rédige un vrai texte complet (pas un résumé), avec le style approprié
- Scénario / situation-problème : crée un cas concret, chiffré si pertinent, avec tous les détails nécessaires
- Document historique : rédige un texte vraisemblable d'époque avec source fictive crédible
- Support EPS : décris des situations tactiques concrètes avec des enchaînements pas à pas
Le document doit être suffisamment riche pour que les élèves puissent travailler dessus pendant toute la phase.
Si le contexte implique des données chiffrées ou une chronologie, inclus un graphique Chart.js ou un diagramme mermaid pour les visualiser.`,

  texte_a_trous: `Crée un texte à trous portant sur les NOTIONS CLÉS de la phase.
- Rédige un texte original (pas une copie de la phase) qui synthétise les savoirs visés
- Remplace les mots-clés par '________' (10 à 15 trous minimum)
- Les trous doivent porter sur le vocabulaire disciplinaire important
- Fournis la correction (liste numérotée des mots) à la fin`,

  vocabulaire: `Crée une fiche de vocabulaire EXPERTE sur le thème de la phase :
- 10 à 15 termes disciplinaires essentiels
- Pour chaque terme : définition claire + exemple concret d'utilisation en contexte
- Ajoute les pièges courants ou confusions fréquentes entre termes proches
- Si pertinent, ajoute un petit exercice d'association ou de réemploi en fin de fiche`,

  qcm: `Crée un QCM de 10 à 12 questions qui TESTE LA COMPRÉHENSION PROFONDE, pas la simple mémorisation :
- Mélange des questions factuelles et des questions de raisonnement/application
- Propose 3 à 4 choix par question, avec des distracteurs crédibles (erreurs fréquentes d'élèves)
- Fournis la correction à la fin avec une EXPLICATION pour chaque bonne réponse
- Les questions doivent couvrir les notions clés de la phase, pas reformuler les consignes`,

  exercices: `Crée des exercices d'application PROGRESSIFS (du plus simple au plus complexe) :
- 4 à 6 exercices qui permettent de mettre en pratique les compétences visées par la phase
- Chaque exercice a un énoncé clair avec des données concrètes (chiffres, textes, situations)
- Inclure au moins un exercice de type "expert" ou "défi" pour les élèves avancés
- Correction détaillée à la fin avec la MÉTHODE pas à pas, pas juste la réponse
- Si les exercices impliquent des courbes, des données chiffrées, ou de la géométrie, inclus un graphique Chart.js
- Si une méthode en étapes est au cœur de l'exercice, ajoute un diagramme mermaid`,

  dictee: `Crée une dictée préparée en lien avec le thème de la phase :
- Texte de 80 à 150 mots (adapté au niveau) portant sur le thème étudié
- Liste des mots difficiles à préparer en amont avec règles orthographiques associées
- Points de vigilance : accords, homophones, conjugaisons à surveiller
- Version annotée pour l'enseignant avec les pièges soulignés`,

  grille: `Crée une grille d'évaluation ou d'observation OPÉRATIONNELLE :
- Critères précis et OBSERVABLES (pas de formulations vagues comme "bonne maîtrise")
- Pour chaque critère, décris concrètement ce qu'on observe à chaque niveau (insuffisant / fragile / satisfaisant / expert)
- En EPS : critères moteurs précis (ex : "replacement en position T en moins de 2 secondes après la frappe")
- En production écrite : critères linguistiques précis avec exemples
- Format tableau prêt à cocher, avec une colonne commentaire`,

  fiche_eleve: `Crée une fiche élève qui soit un vrai OUTIL DE TRAVAIL, pas un résumé de cours :
- L'essentiel à retenir présenté de manière visuelle (encadrés, schémas décrits, mots-clés en gras)
- Des EXEMPLES CONCRETS et DÉTAILLÉS (pas des mentions génériques)
- Un ou deux exercices d'application rapide avec correction
- En EPS : des routines ou enchaînements décrits étape par étape
- En Sciences : un protocole ou une méthode à suivre
- En Maths : une méthode type avec un exemple résolu pas à pas
- Si le contenu implique des processus, des méthodes en étapes, des données chiffrées, ou des situations spatiales, enrichis la fiche avec un diagramme mermaid et/ou un graphique chart.`,
};

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

interface ExerciseRequest {
  phaseContent: string;
  supportType: string;
  subject: string;
  level: string;
  fullLessonContext: string;
  aiModel?: string;
}

const exercisesHandler = async (req: Request): Promise<Response> => {
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

  // =====================================================
  // SÉCURITÉ : Vérification de l'authentification JWT
  // =====================================================
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Configuration serveur manquante' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseServiceKey
    }
  });

  if (!userResponse.ok) {
    return new Response(JSON.stringify({ error: 'Token invalide ou expiré' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authUser = await userResponse.json();
  console.log(`[exercises] Utilisateur authentifié: ${authUser.id}`);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', {
        status: 500,
        headers: corsHeaders
      });
    }

    const data: ExerciseRequest = await req.json();

    // Vérification du solde de tokens
    const serviceClient = await createServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('tokens')
      .eq('user_id', authUser.id)
      .single();

    if (!profile || profile.tokens < 1000) {
      return new Response(JSON.stringify({
        error: 'Tokens insuffisants. Il vous faut au moins 1 000 tokens pour générer un support.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Résoudre la configuration API
    let aiConfig;
    try {
      aiConfig = resolveAIConfig(data.aiModel, OPENAI_API_KEY, MISTRAL_API_KEY);
    } catch (configError) {
      return new Response(JSON.stringify({
        error: (configError as Error).message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[exercises] Modèle IA utilisé: ${aiConfig.model}, type: ${data.supportType}`);

    // Construction des prompts
    const supportInstruction = SUPPORT_TYPE_INSTRUCTIONS[data.supportType] || SUPPORT_TYPE_INSTRUCTIONS.auto;

    // Tronquer le contexte global si trop long
    const truncatedContext = data.fullLessonContext.length > 2000
      ? data.fullLessonContext.substring(0, 2000) + '\n\n[... contexte tronqué ...]'
      : data.fullLessonContext;

    // Instructions markdown renforcées pour les modèles sujets à des artefacts
    const markdownRules = aiConfig.model !== 'gpt-4.1-mini'
      ? `
FORMAT MARKDOWN OBLIGATOIRE :
- Utilise exclusivement du Markdown standard, PAS de HTML
- Tableaux : chaque ligne commence et finit par | avec un seul | entre chaque colonne
- Tableaux : la 2e ligne doit être le séparateur | --- | --- | (autant de colonnes que l'en-tête)
- Ne jamais insérer de ligne vide entre les lignes d'un même tableau
- Ne jamais entourer la réponse de blocs \`\`\`markdown ou \`\`\`
- Listes : utiliser - ou 1. 2. 3. sans mélanger les formats
- Les blocs mermaid et chart doivent être correctement délimités par triple backticks avec le tag de langage`
      : '';

    const systemPrompt = `Tu es un expert pédagogique disciplinaire pour l'enseignement en France.
Tu crées des supports prêts à imprimer qui APPORTENT DU CONTENU CONCRET que la séance ne fournit pas.

PRINCIPE FONDAMENTAL — VALEUR AJOUTÉE :
Ta mission n'est PAS de reformuler ou résumer la phase de séance.
La phase décrit l'organisation et les objectifs. Toi, tu dois CRÉER LE CONTENU OPÉRATIONNEL que l'enseignant n'a pas eu le temps de rédiger :
- En EPS : des routines tactiques détaillées étape par étape (ex : "Si tu sers court et que l'adversaire retourne court → avance au filet et joue un contre-amorti ; s'il retourne long → replace-toi et joue un dégagé"), des arbres de décision, des schémas de déplacement décrits pas à pas
- En Maths : des exercices originaux avec résolution détaillée étape par étape, des erreurs types commentées, des méthodes pas à pas
- En Français : des textes supports inédits adaptés, des exemples de rédaction commentés, des grilles d'analyse pré-remplies avec un exemple
- En Histoire-Géo : des documents sources réalistes (extraits de textes d'époque, données chiffrées, témoignages fictifs mais vraisemblables), des frises et repères concrets
- En Sciences : des protocoles expérimentaux détaillés, des tableaux de mesures pré-formatés avec un exemple, des schémas décrits étape par étape
- En Langues : des dialogues modèles, du vocabulaire en contexte avec exemples d'usage, des exercices de transformation
- Pour toute matière : des EXEMPLES CONCRETS, des CAS PRATIQUES, des MODÈLES que l'élève peut imiter

RÈGLES STRICTES :
- Tout le contenu est en français
- Adapté au niveau scolaire indiqué (vocabulaire, complexité, longueur)
- Directement imprimable et utilisable en classe
- Mise en page claire avec des consignes explicites pour les élèves
- Format Markdown propre (titres, listes, tableaux si pertinent)
- Inclure un titre clair pour le support
- Ne pas générer de commentaires ou notes destinés à l'enseignant dans le support élève
- Fournir la correction/les réponses à la fin quand c'est pertinent
- NE PAS recopier les consignes organisationnelles de la phase (groupes, rotations, durées) — l'élève les aura à l'oral
- NE JAMAIS insérer de liens vers des images externes (imgur, wikimedia, etc.) — elles ne s'afficheront pas
- Pour les graphiques et courbes, utiliser UNIQUEMENT les blocs \`\`\`chart avec du JSON Chart.js
- Pour les schémas et diagrammes, utiliser UNIQUEMENT les blocs \`\`\`mermaid

ILLUSTRATIONS VISUELLES — UNIQUEMENT QUAND ELLES ONT UN INTÉRÊT PÉDAGOGIQUE :
Inclus un diagramme mermaid ou un graphique chart quand cela aide réellement l'élève à comprendre. Ne force PAS un visuel quand le contenu est purement textuel (dictée, vocabulaire, QCM simple).
Quand inclure un visuel :
- EPS : schémas d'organisation des situations, arbres de décision tactiques → TOUJOURS pertinent
- Maths : courbes de fonctions, schémas de géométrie, méthode en étapes → pertinent
- Sciences : protocoles, graphiques de mesures, schémas d'expérience → pertinent
- Histoire-Géo : chronologies, données chiffrées → pertinent
Quand NE PAS inclure de visuel :
- Dictée, texte à trous, vocabulaire, QCM factuel → le texte suffit

■ Diagramme mermaid — pour les méthodes, processus, arbres de décision :
  \`\`\`mermaid
  flowchart TD
    A["Étape 1"] --> B{"Condition ?"}
    B -->|Oui| C["Action 1"]
    B -->|Non| D["Action 2"]
  \`\`\`
  Exemples par matière :
  - Maths : flowchart de la méthode (Calculer f' → Résoudre f'=0 → Signer → Conclure)
  - Sciences : protocole expérimental étape par étape
  - EPS : arbre de décision tactique (adversaire recule → frappe longue / adversaire avance → amorti)
  - Français : structure du plan de rédaction, analyse de texte

■ Graphique Chart.js — pour les courbes, données chiffrées, comparaisons :
  \`\`\`chart
  {"type":"line","data":{"labels":["-3","-2","-1","0","1","2","3"],"datasets":[{"label":"f(x)","data":[-17,-5,3,1,-1,3,19],"borderColor":"#3b82f6","fill":false}]}}
  \`\`\`
  Exemples par matière :
  - Maths : courbe de la fonction étudiée, courbe de la dérivée
  - Sciences : graphique des résultats expérimentaux attendus
  - Histoire-Géo : évolution chronologique, répartition en camembert
  - Économie : courbes d'offre/demande, histogrammes

SYNTAXE MERMAID — RÈGLES STRICTES :
- TOUS les textes de nœuds DOIVENT être entre guillemets doubles : A["texte ici"]
- Correct : A["L'élève observe"] B{"Est-il prêt ?"}
- Incorrect : A[L'élève observe] B{Est-il prêt ?}
- Ne jamais utiliser de parenthèses () à l'intérieur des labels de nœuds
- Garder les labels courts (max 8 mots par nœud)
- Maximum 15 nœuds par diagramme

Règles techniques graphiques :
- Labels en français
- Le JSON du bloc chart doit être valide et sur une seule ligne
- Privilégier 1-2 visuels bien choisis plutôt que 3 visuels médiocres${markdownRules}`;

    const userPrompt = `Génère un support pédagogique pour la phase ci-dessous.

**Matière :** ${data.subject}
**Niveau :** ${data.level}

---

**Contenu de la phase (ce que l'enseignant a prévu) :**
${data.phaseContent}

---

**Contexte de la séance complète (pour référence) :**
${truncatedContext}

---

**Type de support demandé :** ${supportInstruction}

RAPPEL IMPORTANT : La phase ci-dessus décrit l'organisation pédagogique. Ton support doit apporter le CONTENU CONCRET que l'élève utilisera pendant cette phase — pas reformuler ce que l'enseignant sait déjà.
Pose-toi la question : "Qu'est-ce que l'élève doit avoir entre les mains pour réussir cette activité ?"

Si le contenu a un intérêt pédagogique à être visualisé (courbe, schéma, processus, organisation spatiale), inclus un diagramme \`\`\`mermaid ou un graphique \`\`\`chart. Ne force pas de visuel sur un contenu purement textuel. ATTENTION à la syntaxe mermaid : les textes de nœuds doivent être entre guillemets doubles (ex: A["L'élève observe"]).

Génère maintenant le support, prêt à être imprimé et distribué aux élèves.`;

    // Construction du body
    let requestBody;

    if (aiConfig.isResponsesAPI) {
      const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
      requestBody = {
        model: aiConfig.model,
        input: fullPrompt,
        max_output_tokens: 4000,
        text: {
          format: { type: "text" }
        },
        reasoning: {
          effort: "low"
        }
      };
    } else if (aiConfig.model === 'mistral-medium-latest') {
      requestBody = {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      };
    } else {
      requestBody = {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      };
    }

    const response = await fetch(aiConfig.endpoint, {
      method: 'POST',
      headers: aiConfig.headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[exercises] ${aiConfig.model} API error:`, errorText);
      return new Response(JSON.stringify({ error: 'Erreur de l\'API IA' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await response.json();

    let content = null;

    if (aiConfig.isResponsesAPI) {
      if (aiData?.output && Array.isArray(aiData.output)) {
        const messageItem = aiData.output.find((item: any) => item.type === 'message');
        if (messageItem?.content && Array.isArray(messageItem.content)) {
          const outputText = messageItem.content.find((c: any) => c.type === 'output_text');
          if (outputText?.text) {
            content = outputText.text;
          }
        }
      }
      if (!content && aiData?.output_text) {
        content = aiData.output_text;
      }
    } else {
      content = aiData.choices?.[0]?.message?.content;
    }

    if (!content) {
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API IA'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[exercises] Support généré (${content.length} caractères) avec ${aiConfig.model}`);

    const cleanedContent = cleanOutputText(content);

    // Déduction de 1000 tokens
    await deductTokens(serviceClient, authUser.id, 1000);

    return new Response(JSON.stringify({
      content: cleanedContent,
      usage: aiData.usage,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8"
      }
    });

  } catch (error) {
    console.error('[exercises] Error:', error);
    return new Response(JSON.stringify({ error: 'Erreur interne du serveur' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

Deno.serve(exercisesHandler);