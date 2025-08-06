import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY, // ⚠️ adapte si nécessaire
  dangerouslyAllowBrowser: true // requis pour utiliser OpenAI côté client dans Vite
});

interface Params {
  destinataire: string;
  ton: string;
  contenu: string;
}

export async function generateCommunication({ destinataire, ton, contenu }: Params): Promise<string> {
  const prompt = `Tu es un professeur souhaitant écrire un message à ${destinataire}.
Le ton doit être ${ton.toLowerCase()} (mais toujours professionnel et bienveillant).
Voici les éléments que le message doit contenir :

${contenu}

Rédige une communication claire, structurée, sans excès de formalisme, avec une salutation d’ouverture et une formule de clôture.`;

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

  return completion.choices[0]?.message?.content ?? '';
}

