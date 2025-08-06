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
  situation: string;
  destinataire: string;
}

export async function generateReply({ situation, destinataire }: Params): Promise<string> {
  const prompt = `Tu es un professeur répondant à un message de ${destinataire}.
Voici la situation :

${situation}

Rédige une réponse adaptée, claire et bienveillante.`;

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


