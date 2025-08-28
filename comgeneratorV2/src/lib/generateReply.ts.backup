// src/lib/generateReply.ts
import { OpenAI } from 'openai';
import { supabase } from './supabase';
import { countTokens } from './countTokens';
import { TOKEN_UPDATED } from '../components/layout/Header';
import { useAuthStore } from '../lib/store';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

interface Params {
  message: string;
  ton: string;
  objectifs: string;
  signature?: string | null;
}

export async function generateReply({ 
  message, 
  ton, 
  objectifs, 
  signature
}: Params): Promise<string> {
  
  // ✅ NOUVEAU PROMPT AMÉLIORÉ POUR LES RÉPONSES
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

  const user = useAuthStore.getState().user;

  if (!user) {
    console.error("Utilisateur non trouvé");
    return '';
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7
  });

  const result = completion.choices[0]?.message?.content ?? '';
  const tokensUsed = countTokens(prompt + result);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tokens')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Erreur récupération profil :', profileError);
    return result;
  }

  const currentTokens = profile.tokens ?? 0;
  const newTokens = currentTokens - tokensUsed;

  console.log("Token actuels :", currentTokens);
  console.log("Tokens utilisés :", tokensUsed);
  console.log("Tokens restants :", newTokens);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ tokens: newTokens })
    .eq('user_id', user.id);

  if (updateError) {
    console.error('Erreur mise à jour des tokens :', updateError);
  } else {
    window.dispatchEvent(new Event(TOKEN_UPDATED));
  }

  return result;
}

// ✅ NOUVELLE FONCTION HELPER POUR L'ADAPTATION DU TON DES RÉPONSES

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



