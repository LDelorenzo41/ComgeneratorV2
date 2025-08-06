import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { TOKEN_UPDATED, tokenUpdateEvent } from '../components/layout/Header';
import ReactMarkdown from 'react-markdown'; // ✅ Ajout de react-markdown

const lessonSchema = z.object({
  subject: z.string().min(1, 'La matière est requise'),
  topic: z.string().min(1, 'Le thème est requis'),
  level: z.string().min(1, 'Le niveau est requis'),
  pedagogy_type: z.string().min(1, 'Le type de pédagogie est requis'),
  duration: z.enum(['60', '120'])
});

type LessonFormData = z.infer<typeof lessonSchema>;

export function LessonGeneratorPage() {
  const { user, loading: authLoading } = useAuthStore();
  const [tokenCount, setTokenCount] = React.useState<number | null>(null);
  const [generatedContent, setGeneratedContent] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      subject: '',
      topic: '',
      level: '',
      pedagogy_type: '',
      duration: '60'
    }
  });

  const fetchTokenCount = React.useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setTokenCount(data?.tokens ?? 0);
    } catch (err) {
      console.error('Erreur lors de la récupération du solde de tokens:', err);
    }
  }, [user]);

  React.useEffect(() => {
    fetchTokenCount();
  }, [fetchTokenCount]);

  React.useEffect(() => {
    const handleTokenUpdate = () => {
      fetchTokenCount();
    };
    tokenUpdateEvent.addEventListener(TOKEN_UPDATED, handleTokenUpdate);
    return () => {
      tokenUpdateEvent.removeEventListener(TOKEN_UPDATED, handleTokenUpdate);
    };
  }, [fetchTokenCount]);

  const onSubmit = async (data: LessonFormData) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setGeneratedContent('');

    const prompt = `Tu es un expert de l'enseignement primaire et secondaire, spécialiste en didactique et en pédagogie. Génère une **séance pédagogique complète** d'une durée de ${data.duration} minutes pour un cours de ${data.subject} avec une classe de niveau ${data.level}, selon une pédagogie ${data.pedagogy_type}. Le **thème** de cette séance est : **${data.topic}**. Structure la séance avec un **objectif clair**, une **mise en activité**, une **phase principale**, une **évaluation finale** et **des prolongements éventuels**. Adopte un style **pédagogique clair, structuré et directement exploitable**.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        })
      });

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new Error('Réponse invalide de l\'API OpenAI');

      setGeneratedContent(content);

      const usedTokens: number = result.usage?.total_tokens ?? 0;
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw new Error("Impossible de vérifier votre solde de tokens");
      if ((profile?.tokens ?? 0) < usedTokens) throw new Error('Solde de tokens insuffisant');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ tokens: (profile.tokens || 0) - usedTokens })
        .eq('user_id', user.id);
      if (updateError) throw new Error('Échec de la mise à jour du solde de tokens');

      tokenUpdateEvent.dispatchEvent(new CustomEvent(TOKEN_UPDATED));

      const { error: insertError } = await supabase.from('lessons').insert({
        user_id: user.id,
        subject: data.subject,
        topic: data.topic,
        level: data.level,
        pedagogy_type: data.pedagogy_type,
        duration: parseInt(data.duration, 10),
        content,
        created_at: new Date().toISOString()
      });
      if (insertError) throw insertError;

      reset();
    } catch (err: any) {
      console.error('Erreur lors de la génération:', err);
      setError(err.message || 'Une erreur est survenue lors de la génération.');
    } finally {
      setLoading(false);
    }
  };

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Générateur de séance
        </h1>
        {tokenCount !== null && (
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Crédits restants : {tokenCount.toLocaleString()} tokens
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 bg-white dark:bg-gray-800 shadow rounded-lg p-6"
      >
        <Input
          id="subject"
          label="Matière"
          {...register('subject')}
          error={errors.subject?.message}
          className="border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500"
        />
        <Input
          id="topic"
          label="Thème"
          {...register('topic')}
          error={errors.topic?.message}
          className="border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500"
        />
        <Input
          id="level"
          label="Niveau"
          {...register('level')}
          error={errors.level?.message}
          className="border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500"
        />
        <Input
          id="pedagogy_type"
          label="Type de pédagogie"
          {...register('pedagogy_type')}
          error={errors.pedagogy_type?.message}
          className="border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500"
        />
        <Select
          id="duration"
          label="Durée"
          {...register('duration')}
          options={[
            { value: '60', label: '60 minutes' },
            { value: '120', label: '120 minutes' }
          ]}
          error={errors.duration?.message}
          className="border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500"
        />

        <Button type="submit" loading={loading} className="w-full">
          Générer la séance
        </Button>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </form>

      {generatedContent && (
        <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Séance générée
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(generatedContent)}
            >
              Copier
            </Button>
          </div>
          {/* ✅ Utilisation de ReactMarkdown pour parser le markdown */}
          <div className="prose prose-sm max-w-none dark:prose-invert
                         prose-headings:text-gray-900 dark:prose-headings:text-gray-100
                         prose-p:text-gray-700 dark:prose-p:text-gray-300
                         prose-strong:text-gray-900 dark:prose-strong:text-gray-100
                         prose-ul:text-gray-700 dark:prose-ul:text-gray-300
                         prose-ol:text-gray-700 dark:prose-ol:text-gray-300">
            <ReactMarkdown>{generatedContent}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default LessonGeneratorPage;


