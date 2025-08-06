import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

interface Params {
  messageRecu: string;
  ton: string;
  objectifs: string;
}

export async function generateReply({ messageRecu, ton, objectifs }: Params): Promise<string> {
  const prompt = `Tu es un enseignant qui répond à un message reçu. 
Voici le message initial :

"${messageRecu}"

Tu dois formuler une réponse ${ton.toLowerCase()}, mais toujours professionnelle et respectueuse.

La réponse doit contenir les éléments suivants :
${objectifs}

Évite les répétitions du message initial. Sois clair, courtois, et efficace.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-1106-preview', // ou 'gpt-4.1-mini'
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });

  return completion.choices[0]?.message?.content ?? '';
}
