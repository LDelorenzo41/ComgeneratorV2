// supabase/functions/synthesis/index.ts

// @ts-ignore - Deno global disponible en runtime

interface SynthesisRequest {
  extractedText: string;
  maxChars: number;
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

    const { extractedText, maxChars }: SynthesisRequest = await req.json();

    if (!extractedText) {
      return new Response(JSON.stringify({
        error: 'Aucun texte détecté dans votre capture d\'écran.'
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Reproduction exacte de votre prompt de SynthesePage.tsx
    const prompt = `Tu es un expert en pédagogie et en évaluation scolaire, spécialisé dans la rédaction d'appréciations générales de bulletin.

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
   - **Ouverture :** Bilan global du trimestre/semestre en 1-2 phrases
   - **Points forts :** Mise en valeur des réussites et qualités de l'élève
   - **Axes d'amélioration :** Formulation constructive des difficultés avec pistes de progrès
   - **Conclusion :** Encouragements et objectifs pour la suite

5. **Ton et registre :**
   - Adopte un ton bienveillant mais objectif
   - Utilise un vocabulaire pédagogique professionnel
   - Évite les jugements de valeur et privilégie les observations factuelles
   - Maintiens une perspective encourageante même en cas de difficultés

6. **Formulation pédagogique :**
   - Utilise des tournures positives même pour les points d'amélioration
   - Privilégie "Il serait profitable de..." plutôt que "Il faut absolument..."
   - Emploie le vocabulaire des compétences et de la progression
   - Évite les répétitions avec les commentaires disciplinaires

**CONTRAINTES TECHNIQUES :**
- **Limite stricte :** ${maxChars} caractères maximum (espaces compris)
- **Références aux matières :** Tu PEUX mentionner les disciplines sans citer nommément les professeurs
- **Cohérence :** L'appréciation doit être en accord avec l'ensemble des commentaires analysés
- **Lisibilité :** Phrases fluides et accessibles aux parents et à l'élève

**PRINCIPES PÉDAGOGIQUES À RESPECTER :**
- **Bienveillance éducative :** Chaque élève a des potentialités à développer
- **Constructivisme :** Les difficultés sont des étapes vers le progrès
- **Différenciation :** Reconnaissance des spécificités et du rythme de chaque élève
- **Motivation :** L'appréciation doit encourager la poursuite des efforts

**EXEMPLES DE FORMULATIONS PROFESSIONNELLES :**
- "Trimestre révélateur de qualités solides en..."
- "Des acquis qui se confirment particulièrement en..."
- "Une progression encourageante notamment dans..."
- "Il serait profitable de renforcer..."
- "Les efforts consentis méritent d'être poursuivis..."
- "Un potentiel à développer davantage en..."

**ATTENTION PARTICULIÈRE :**
- Si les commentaires sont majoritairement positifs → valorise tout en maintenant des objectifs
- Si les commentaires révèlent des difficultés → reste constructif et propose des pistes
- Si les commentaires sont contradictoires → trouve l'équilibre et explique les variations
- Si certaines matières ne sont pas évaluées → concentre-toi sur celles qui le sont

Rédige maintenant cette appréciation générale en respectant scrupuleusement ces instructions et en t'adaptant intelligemment au profil de l'élève qui se dégage des commentaires analysés.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: Math.floor(maxChars * 1.5)
      })
    });

    if (!response.ok) {
      return new Response('OpenAI API Error', { 
        status: response.status, 
        headers: corsHeaders 
      });
    }

    const openAIData = await response.json();
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

Deno.serve(synthesisHandler);