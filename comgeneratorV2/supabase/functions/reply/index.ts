// supabase/functions/reply/index.ts

interface ReplyParams {
  message: string;
  ton: string;
  objectifs: string;
  signature?: string | null;
}

const replyHandler = async (req: Request): Promise<Response> => {
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

    const body: ReplyParams = await req.json();
    const { message, ton, objectifs, signature } = body;

    const prompt = `Tu es un enseignant expérimenté qui rédige une réponse professionnelle et réfléchie à un message reçu.

**CONTEXTE DE LA RÉPONSE :**

**MESSAGE REÇU À ANALYSER :**
"""
${message}
"""

**TON SOUHAITÉ POUR LA RÉPONSE :** ${ton}
**OBJECTIFS ET ÉLÉMENTS À INTÉGRER :** ${objectifs}

**INSTRUCTIONS D'ANALYSE ET DE RÉDACTION :**

1. **Analyse du message reçu :**
   - Identifie le type d'expéditeur probable (parent, collègue, direction, élève)
   - Détermine le niveau de formalisme nécessaire
   - Repère les points clés qui nécessitent une réponse
   - Évalue le ton du message original (inquiet, neutre, satisfait, etc.)
   - Détecte les questions explicites et implicites

2. **Adaptation du ton de réponse :**
${getReplyToneInstructions(ton)}

3. **Structure de la réponse :**
   - **Accusé de réception :** Remercie pour le message et montre que tu as bien compris
   - **Réponse aux points soulevés :** Traite chaque élément important du message original
   - **Intégration des objectifs :** Intègre naturellement les éléments demandés
   - **Propositions/Solutions :** Si pertinent, propose des actions concrètes
   - **Ouverture au dialogue :** Invite à continuer l'échange si nécessaire

4. **Principes de communication :**
   - **Empathie :** Comprends et valide les préoccupations exprimées
   - **Clarté :** Réponds de manière précise et sans ambiguïté
   - **Proactivité :** Anticipe les questions non formulées
   - **Bienveillance :** Maintiens un ton positif même si le message original est critique
   - **Professionnalisme :** Reste dans le cadre de tes responsabilités d'enseignant

5. **Exigences qualité :**
   - Réponds à TOUS les points importants du message original
   - Évite les réponses évasives ou trop générales
   - Utilise un vocabulaire adapté à l'interlocuteur
   - Propose des solutions concrètes quand c'est possible
   - Maintiens un équilibre entre réactivité et réflexion

6. **Signature :**
${signature ? 
  `   - Termine OBLIGATOIREMENT par cette signature exacte :\n   ${signature}\n   - N'ajoute aucune autre signature ou formule de clôture` :
  `   - Termine par une formule de clôture professionnelle adaptée au contexte`
}

**CONSIGNES SPÉCIFIQUES :**
- Adapte automatiquement le niveau de formalisme selon l'expéditeur détecté
- Si le message original exprime une inquiétude, rassure tout en étant factuel
- Si le message original est positif, partage cette satisfaction
- Si le message original contient une critique, réponds de manière constructive
- Intègre tous les objectifs demandés de manière naturelle et cohérente
- Évite les réponses trop longues : sois concis mais complet

**ATTENTION PARTICULIÈRE :**
- Si le message original semble urgent, commence par reconnaître cette urgence
- Si le message original contient des questions précises, réponds point par point
- Si le message original mentionne un problème, propose des solutions concrètes
- Si le message original demande un rendez-vous, donne des créneaux ou modalités

Rédige maintenant cette réponse en respectant scrupuleusement ces instructions et en t'adaptant intelligemment au contexte du message reçu.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      return new Response('OpenAI API Error', { 
        status: response.status, 
        headers: corsHeaders 
      });
    }

    const openAIData = await response.json();
    const result = openAIData.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ 
      content: result,
      usage: openAIData.usage 
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error('Reply function error:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
};

function getReplyToneInstructions(ton: string): string {
  switch (ton.toLowerCase()) {
    case "détendu":
      return `   - Adopte un ton chaleureux et accessible
   - Utilise des formulations naturelles et empathiques
   - Montre de la proximité tout en restant professionnel
   - Autorise quelques touches personnelles appropriées
   - Évite la rigidité excessive
   - Privilégie l'aspect humain de la relation éducative
   - Utilise des formulations rassurantes et encourageantes`;

    case "neutre":
      return `   - Maintiens un registre professionnel équilibré
   - Sois factuel et objectif dans tes réponses
   - Évite les effusions d'émotion mais reste bienveillant
   - Utilise un vocabulaire précis et approprié
   - Garde une distance professionnelle respectueuse
   - Privilégie la clarté et l'efficacité dans la communication
   - Reste courtois sans être trop chaleureux`;

    case "stricte":
      return `   - Adopte un registre soutenu et protocolaire
   - Utilise des formulations précises et sans ambiguïté
   - Maintiens une autorité bienveillante mais ferme
   - Évite les familiarités ou les effets de style
   - Structure très clairement tes arguments et réponses
   - Reste respectueux tout en marquant ton expertise
   - Privilégie le cadre institutionnel et les règles établies`;

    default:
      return `   - Adapte le ton au contexte en privilégiant le professionnalisme
   - Équilibre entre respect du cadre et proximité humaine
   - Maintiens la bienveillance caractéristique du milieu éducatif`;
  }
}

Deno.serve(replyHandler);