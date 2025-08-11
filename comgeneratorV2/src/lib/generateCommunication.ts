// src/lib/generateCommunication.ts
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
  destinataire: string;
  ton: string;
  contenu: string;
  signature?: string | null;
}

export async function generateCommunication({
  destinataire,
  ton,
  contenu,
  signature
}: Params): Promise<string> {
  const user = useAuthStore.getState().user;
  if (!user) {
    console.error("Utilisateur non trouvé");
    return '';
  }

  // ✅ NOUVEAU PROMPT AMÉLIORÉ
  const prompt = `Tu es un enseignant expérimenté qui rédige une communication professionnelle dans le milieu éducatif.

**CONTEXTE DE LA COMMUNICATION :**
- **Destinataire :** ${destinataire}
- **Ton souhaité :** ${ton}
- **Contenu à transmettre :** ${contenu}

**INSTRUCTIONS DE RÉDACTION :**

1. **Adaptation au destinataire :**
${getDestinataireInstructions(destinataire)}

2. **Adaptation du ton :**
${getTonInstructions(ton)}

3. **Structure à respecter :**
   - **Objet/Titre :** Concis et informatif (si pertinent)
   - **Salutation :** Appropriée au destinataire et au contexte
   - **Introduction :** Contexte bref et raison du message
   - **Corps du message :** Développement clair et structuré des éléments
   - **Conclusion :** Synthèse ou appel à l'action si nécessaire
   - **Formule de clôture :** Professionnelle et adaptée

4. **Exigences qualité :**
   - Langage clair, précis et professionnel
   - Phrases courtes et bien construites
   - Éviter le jargon technique sauf si nécessaire
   - Ton respectueux et bienveillant en toutes circonstances
   - Longueur adaptée : ni trop concis ni trop verbeux

5. **Signature :**
${signature ? 
  `- Termine OBLIGATOIREMENT par cette signature exacte :\n${signature}\n- N'ajoute aucune autre signature ou formule de clôture` :
  `- Termine par une formule de clôture professionnelle standard adaptée au destinataire`
}

**CONSIGNES SPÉCIFIQUES :**
- Intègre naturellement tous les éléments du contenu fourni
- Assure-toi que le message soit actionnable si nécessaire
- Maintiens un équilibre entre professionnalisme et proximité humaine
- Évite les formulations trop complexes ou ambiguës

Rédige maintenant cette communication en respectant scrupuleusement ces instructions.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });

  const result = response.choices?.[0]?.message?.content ?? '';
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

// ✅ NOUVELLES FONCTIONS HELPER SPÉCIALISÉES

function getDestinataireInstructions(destinataire: string): string {
  switch (destinataire.toLowerCase()) {
    case "parents d'élèves":
      return `- Utilise un registre professionnel mais accessible
- Évite le jargon pédagogique complexe
- Sois bienveillant et rassurant
- Privilégie "Madame, Monsieur" ou "Chers parents"
- Contextualise les informations pour qu'elles soient compréhensibles
- Propose des solutions ou des pistes d'accompagnement si pertinent`;

    case "élève":
      return `- Adopte un ton direct mais respectueux
- Utilise un vocabulaire adapté à l'âge de l'élève
- Sois encourageant tout en étant clair sur les attentes
- Privilégie "Bonjour [Prénom]" si le nom est mentionné
- Évite les formulations culpabilisantes
- Propose des axes d'amélioration constructifs`;

    case "classe":
      return `- S'adresse à l'ensemble du groupe
- Utilise "Chers élèves" ou "Bonjour à tous"
- Ton fédérateur et motivant
- Messages clairs et concis
- Évite les références individuelles
- Privilégie l'esprit de groupe et la cohésion`;

    case "collègue(s)":
      return `- Registre professionnel entre pairs
- Peux utiliser un ton plus direct et technique
- Privilégie "Bonjour [Prénom]" ou "Chers collègues"
- Références pédagogiques acceptées
- Sois concis et efficace
- Propose collaboration si pertinent`;

    case "chef(fe) d'établissement / chef(fe) adjoint":
      return `- Registre soutenu et protocolaire
- Utilise "Madame/Monsieur [Fonction]" ou "Madame la Directrice/Monsieur le Principal"
- Ton respectueux et professionnel
- Structure très claire avec contexte précis
- Argumente les demandes ou constats
- Propose des solutions concrètes`;

    default:
      return `- Adapte le registre au contexte professionnel éducatif
- Maintiens un ton respectueux et bienveillant
- Structure le message de manière claire et professionnelle`;
  }
}

function getTonInstructions(ton: string): string {
  switch (ton.toLowerCase()) {
    case "détendu":
      return `- Utilise un langage naturel et fluide
- Autorise quelques tournures moins formelles (tout en restant professionnel)
- Montre de la proximité et de l'empathie
- Utilise des formulations chaleureuses
- Évite la rigidité excessive
- Privilégie un style conversationnel adapté`;

    case "neutre":
      return `- Adopte un registre professionnel standard
- Équilibre entre formalisme et accessibilité
- Ton objectif et factuel
- Évite les effets de style ou l'excès d'émotion
- Reste courtois sans être trop chaleureux
- Privilégie la clarté et l'efficacité`;

    case "stricte":
      return `- Utilise un registre soutenu et protocolaire
- Formulations précises et sans ambiguïté
- Ton ferme mais toujours respectueux
- Évite les familiarités
- Structure très claire avec arguments solides
- Maintiens l'autorité tout en restant bienveillant`;

    default:
      return `- Adapte le ton au contexte en privilégiant le professionnalisme
- Maintiens un équilibre entre respect et proximité humaine`;
  }
}



