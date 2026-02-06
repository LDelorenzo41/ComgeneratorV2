// supabase/functions/synthesis/index.ts - VERSION AMÉLIORÉE

// @ts-ignore - Deno global disponible en runtime

interface SynthesisRequest {
  extractedText: string;
  maxChars: number;
  tone?: 'neutre' | 'encourageant' | 'analytique';
  outputType?: 'complet' | 'essentiel';
}

const synthesisHandler = async (req: Request): Promise<Response> => {
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
  // ✅ SÉCURITÉ : Vérification de l'authentification JWT
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
  console.log(`[synthesis] Utilisateur authentifié: ${authUser.id}`);
  // =====================================================
  // FIN VÉRIFICATION JWT
  // =====================================================

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', {
        status: 500,
        headers: corsHeaders
      });
    }

    const {
      extractedText,
      maxChars,
      tone = 'neutre',
      outputType = 'complet'
    }: SynthesisRequest = await req.json();

    if (!extractedText) {
      return new Response(JSON.stringify({
        error: 'Aucun texte détecté dans votre capture d\'écran.'
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ✅ ADAPTATION DU TON
    const toneInstructions = getToneInstructions(tone);

    // ✅ CHOIX DU PROMPT SELON LE TYPE
    const prompt = outputType === 'essentiel'
      ? buildEssentialPrompt(extractedText, maxChars, toneInstructions)
      : buildCompletePrompt(extractedText, maxChars, toneInstructions);

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: Math.ceil(maxChars * 2)
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(JSON.stringify({
        error: 'Erreur lors de la génération de la synthèse'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const openAIData = await openAIResponse.json();
    const content = openAIData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API OpenAI'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      content,
      usage: openAIData.usage
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error('Synthesis function error:', error);
    return new Response('Internal server error', {
      status: 500,
      headers: corsHeaders
    });
  }
};

// ✅ FONCTION POUR ADAPTER LE TON
function getToneInstructions(tone: 'neutre' | 'encourageant' | 'analytique'): string {
  switch (tone) {
    case 'encourageant':
      return `**TON ENCOURAGEANT :**
   - Mets en avant les points positifs et les réussites de l'élève
   - Valorise les efforts et les progrès, même modestes
   - Présente les axes d'amélioration comme des opportunités de développement
   - Utilise un vocabulaire stimulant et motivant
   - Termine sur une note positive et constructive`;

    case 'analytique':
      return `**TON ANALYTIQUE :**
   - Adopte une approche détaillée et approfondie
   - Établis des liens de causalité entre les observations
   - Identifie les patterns et tendances dans les commentaires
   - Propose une analyse nuancée des forces et faiblesses
   - Fournis des explications sur les difficultés rencontrées
   - Suggère des pistes concrètes d'amélioration avec justifications`;

    case 'neutre':
    default:
      return `**TON NEUTRE :**
   - Adopte un ton factuel et objectif
   - Présente les observations de manière équilibrée
   - Évite les jugements de valeur excessifs
   - Reste professionnel et respectueux`;
  }
}

// ✅ PROMPT COMPLET (CONSERVÉ DE L'ORIGINAL)
function buildCompletePrompt(extractedText: string, maxChars: number, toneInstructions: string): string {
  return `Tu es un expert en pédagogie et en évaluation scolaire, spécialisé dans la rédaction d'appréciations générales de bulletin.

**CONTEXTE ET MISSION :**
Tu dois analyser les commentaires de plusieurs professeurs extraits d'un bulletin scolaire et rédiger une appréciation générale cohérente et professionnelle qui sera placée en pied de bulletin.

**COMMENTAIRES À ANALYSER :**
"""
${extractedText}
"""

**INSTRUCTIONS D'ANALYSE :**

1. **Identification des tendances pédagogiques :**
   - Repère les points forts récurrents dans les différentes matières
   - Identifie les difficultés ou axes d'amélioration mentionnés
   - Détecte les compétences transversales (autonomie, participation, méthode, etc.)
   - Évalue l'évolution ou la progression de l'élève si mentionnée

2. **Analyse des domaines de compétences :**
   - **Savoirs disciplinaires :** Connaissances et compétences spécifiques aux matières
   - **Savoir-faire méthodologiques :** Organisation, rigueur, présentation des travaux
   - **Savoir-être comportementaux :** Participation, attitude, relations avec autrui
   - **Compétences transversales :** Raisonnement, créativité, esprit critique

3. **Cohérence pédagogique :**
   - Identifie les convergences entre les appréciations des différents professeurs
   - Repère les spécificités selon les types de matières (littéraires, scientifiques, artistiques)
   - Détecte les compétences qui se confirment ou s'infirment selon les disciplines

**INSTRUCTIONS DE RÉDACTION :**

4. **Structure de l'appréciation générale :**
   - **Bilan global :** Vue d'ensemble du trimestre/semestre
   - **Points forts :** Compétences confirmées et réussites significatives
   - **Axes d'amélioration :** Difficultés identifiées et besoins repérés
   - **Recommandations :** Conseils concrets et encouragements

5. **Style et forme :**
   - Langage professionnel adapté à un bulletin officiel
   - Phrases construites et fluides
   - Vocabulaire précis et pédagogique
   - Évite les généralités vagues
   - Reste concret et factuel

6. ${toneInstructions}

7. **Contraintes impératives :**
   - Longueur maximale STRICTE : ${maxChars} caractères
   - Rédige une appréciation cohérente qui synthétise l'ensemble des commentaires
   - Ne mentionne JAMAIS les noms des professeurs
   - Reste dans un cadre pédagogique bienveillant même si les commentaires sont négatifs
   - Assure-toi que ton texte soit directement utilisable dans un bulletin officiel

**ACTION REQUISE :**
Rédige maintenant l'appréciation générale en respectant SCRUPULEUSEMENT ces instructions, notamment la limite de ${maxChars} caractères.`;
}

// ✅ PROMPT ESSENTIEL (CORRIGÉ)
function buildEssentialPrompt(extractedText: string, maxChars: number, toneInstructions: string): string {
  return `Tu es un expert en pédagogie et en évaluation scolaire, spécialisé dans la rédaction d'appréciations générales de bulletin.

**CONTEXTE ET MISSION :**
Tu dois analyser les commentaires de plusieurs professeurs extraits d'un bulletin scolaire et identifier LA TENDANCE GLOBALE DOMINANTE qui caractérise le bilan de l'élève, puis rédiger une synthèse concise centrée sur cette vision d'ensemble.

**COMMENTAIRES À ANALYSER :**
"""
${extractedText}
"""

**INSTRUCTIONS D'ANALYSE CRITIQUE :**

1. **Identification de la tendance GLOBALE dominante :**

   ⚠️ **ATTENTION PRIORITAIRE :** Évalue d'abord la VISION D'ENSEMBLE :
   - Combien de matières/commentaires sont POSITIFS vs NÉGATIFS ?
   - Quelle est la TONALITÉ GÉNÉRALE du bulletin ?
   - Y a-t-il des mentions explicites (félicitations, encouragements, mises en garde) ?

   **Hiérarchie d'importance :**
   1. **Si > 70% des commentaires sont positifs** → La tendance dominante est LA RÉUSSITE GLOBALE
   2. **Si > 70% des commentaires sont négatifs** → La tendance dominante est LES DIFFICULTÉS GÉNÉRALISÉES
   3. **Si équilibré (40-60%)** → Identifier LE POINT TRANSVERSAL le plus significatif

   ⚠️ **NE PAS se focaliser sur 2-3 points mineurs négatifs si l'ensemble est excellent**
   ⚠️ **NE PAS se focaliser sur 2-3 points mineurs positifs si l'ensemble est faible**

2. **Exemples de tendances dominantes correctes :**
   - **Bulletin très positif** : "Trimestre excellent avec félicitations" / "Résultats très satisfaisants"
   - **Bulletin positif** : "Bon trimestre avec réussites marquées"
   - **Bulletin mitigé** : "Résultats contrastés nécessitant régularité" / "Lacunes méthodologiques transversales"
   - **Bulletin faible** : "Difficultés généralisées nécessitant soutien" / "Manque de travail et d'investissement"

3. **Construction de la synthèse essentielle :**
   - **Point principal :** Énonce la tendance GLOBALE dominante
   - **Constat :** Illustre avec 1-2 éléments concrets
   - **Perspective :** Encouragement ou conseil adapté au niveau global

4. ${toneInstructions}

**CONTRAINTES IMPÉRATIVES :**
- Longueur maximale STRICTE : ${maxChars} caractères
- Focus sur la VISION D'ENSEMBLE, pas sur des détails isolés
- Si le bulletin est globalement positif, la synthèse DOIT être positive
- Si le bulletin est globalement négatif, la synthèse DOIT être constructive mais lucide
- Reste professionnel et utilisable dans un bulletin officiel

**STRUCTURE ATTENDUE :**
[Bilan global en une phrase] + [Illustration concrète] + [Perspective/Conseil]

**ACTION REQUISE :**
Rédige maintenant cette synthèse essentielle en respectant SCRUPULEUSEMENT la limite de ${maxChars} caractères.`;
}

Deno.serve(synthesisHandler);
