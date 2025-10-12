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

// ✅ PROMPT ESSENTIEL (NOUVEAU)
function buildEssentialPrompt(extractedText: string, maxChars: number, toneInstructions: string): string {
  return `Tu es un expert en pédagogie et en évaluation scolaire, spécialisé dans la rédaction d'appréciations générales de bulletin.

**CONTEXTE ET MISSION :**
Tu dois analyser les commentaires de plusieurs professeurs extraits d'un bulletin scolaire et identifier LA CARACTÉRISTIQUE PRINCIPALE qui ressort, puis rédiger une synthèse concise centrée sur cet élément.

**COMMENTAIRES À ANALYSER :**
"""
${extractedText}
"""

**INSTRUCTIONS D'ANALYSE :**

1. **Identification de l'élément central :**
   - Quel est LE point qui revient le plus souvent dans les commentaires ?
   - Quelle est LA tendance dominante (positive ou négative) ?
   - Quel est LE constat principal qui se dégage ?
   
   Exemples possibles :
   - Un élève en difficulté généralisée
   - Un élève excellent partout
   - Des lacunes méthodologiques transversales
   - Un problème comportemental récurrent
   - Une force particulière (créativité, rigueur, participation...)

2. **Construction de la synthèse essentielle :**
   - **Point principal :** Énonce clairement la caractéristique dominante
   - **Constat :** Explique comment cela se manifeste concrètement
   - **Action recommandée :** Propose UNE piste d'action prioritaire

3. ${toneInstructions}

**CONTRAINTES IMPÉRATIVES :**
- Longueur maximale STRICTE : ${maxChars} caractères
- Focus UNIQUEMENT sur l'élément central identifié
- Évite les listes ou énumérations multiples
- Va droit au but avec une synthèse percutante
- Reste professionnel et utilisable dans un bulletin officiel

**STRUCTURE ATTENDUE :**
[Point principal en une phrase] + [Constat concret] + [Action recommandée]

**ACTION REQUISE :**
Rédige maintenant cette synthèse essentielle en respectant SCRUPULEUSEMENT la limite de ${maxChars} caractères.`;
}

Deno.serve(synthesisHandler);