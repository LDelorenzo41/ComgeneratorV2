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
}

export async function generateCommunication({
  destinataire,
  ton,
  contenu
}: Params): Promise<string> {
  const user = useAuthStore.getState().user;
  if (!user) {
    console.error("Utilisateur non trouvé");
    return '';
  }

  const prompt = `Tu es un professeur souhaitant écrire un message à ${destinataire}.
Le ton doit être ${ton.toLowerCase()} (mais toujours professionnel et bienveillant).
Voici les éléments que le message doit contenir :

${contenu}

Rédige une communication claire, structurée, sans excès de formalisme, avec une salutation d’ouverture et une formule de clôture.`;

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



