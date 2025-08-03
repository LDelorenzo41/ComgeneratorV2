import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { generateAppreciation } from '../../lib/api';
import { AppreciationResult } from './AppreciationResult';
import type { AppreciationResult as AppreciationResultType } from '../../lib/types';
import { RatingBar } from './RatingBar';
import { subjectUpdateEvent, SUBJECT_UPDATED } from './SubjectList';
import { tokenUpdateEvent, TOKEN_UPDATED } from '../layout/Header';

const appreciationSchema = z.object({
  subject: z.string().min(1, 'Veuillez sélectionner une matière'),
  studentName: z.string().min(1, 'Le prénom de l\'élève est requis'),
  criteria: z.array(z.object({
    name: z.string(),
    value: z.number().min(0).max(7),
  })),
  personalNotes: z.string().optional(),
  tone: z.enum(['bienveillant', 'normal', 'severe'] as const),
  minLength: z.number().min(50).max(500),
  maxLength: z.number().min(100).max(1000)
}).refine((data) => data.maxLength > data.minLength, {
  message: "La longueur maximale doit être supérieure à la longueur minimale",
  path: ["maxLength"],
});

type FormData = z.infer<typeof appreciationSchema>;

interface Subject {
  id: string;
  name: string;
  criteria: Array<{
    id: string;
    name: string;
    importance: number;
  }>;
}

interface AppreciationFormProps {
  onTokensUpdated?: () => void;
}

export function AppreciationForm({ onTokensUpdated }: AppreciationFormProps) {
  const { user } = useAuthStore();
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AppreciationResultType | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isGenerateClicked, setIsGenerateClicked] = React.useState(false);
  const [tag, setTag] = React.useState('');
  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(appreciationSchema),
    defaultValues: {
      subject: '',
      studentName: '',
      criteria: [],
      tone: 'normal',
      personalNotes: '',
      minLength: 150,
      maxLength: 300
    }
  });

  const { register, control, handleSubmit, watch, setValue, reset } = form;
  const selectedSubject = watch('subject');

  const saveAppreciation = React.useCallback(
    async (tagValue: string, generated?: AppreciationResultType) => {
      if (!user) return;
      const dataToSave = generated || result;
      if (!dataToSave) return;
      setSaveError(null);
      setSaveSuccess(null);
      try {
        const { error: insertError } = await supabase.from('appreciations').insert({
          user_id: user.id,
          detailed: dataToSave.detailed,
          summary: dataToSave.summary,
          tag: tagValue,
          created_at: new Date().toISOString(),
        });
        if (insertError) throw insertError;
        setSaveSuccess('Appréciation sauvegardée avec succès.');
      } catch (err) {
        console.error("Erreur lors de l'enregistrement de l'appréciation:", err);
        setSaveError("Erreur lors de l'enregistrement de l'appréciation.");
      }
    },
    [user, result]
  );

  const handleTagChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setTag(value);
    if (result) {
      await saveAppreciation(value);
    }
  };

  const fetchSubjects = React.useCallback(async () => {
    if (!user) return;
    try {
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select(`
          id,
          name,
          criteria (
            id,
            name,
            importance
          )
        `)
        .eq('user_id', user.id);

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des matières:', error);
      setError('Erreur lors de la récupération des matières. Veuillez réessayer.');
    }
  }, [user]);

  React.useEffect(() => {
    const handleSubjectUpdate = () => {
      fetchSubjects();
    };

    subjectUpdateEvent.addEventListener(SUBJECT_UPDATED, handleSubjectUpdate);
    return () => {
      subjectUpdateEvent.removeEventListener(SUBJECT_UPDATED, handleSubjectUpdate);
    };
  }, [fetchSubjects]);

  React.useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  React.useEffect(() => {
    if (selectedSubject) {
      const subject = subjects.find(s => s.id === selectedSubject);
      if (subject) {
        setValue('criteria', subject.criteria.map(c => ({
          ...c,
          value: 0
        })));
        setIsGenerateClicked(false);
      }
    }
  }, [selectedSubject, subjects, setValue]);

  const handleGenerateClick = async (data: FormData) => {
    if (!isGenerateClicked) {
      setIsGenerateClicked(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const subject = subjects.find(s => s.id === data.subject);
      if (!subject) throw new Error('Matière non trouvée');

      if (!data.criteria.some(c => c.value > 0)) {
        throw new Error('Veuillez évaluer au moins un critère');
      }

      const generatedResult = await generateAppreciation({
        subject: subject.name,
        studentName: data.studentName,
        criteria: data.criteria.map((c, i) => ({
          ...c,
          id: subject.criteria[i].id,
          importance: 2
        })),
        personalNotes: data.personalNotes || '',
        minLength: data.minLength,
        maxLength: data.maxLength,
        tone: data.tone
      });
      const usedTokens = generatedResult.usedTokens;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user!.id)
        .single();

      if (profileError) {
        throw new Error("Impossible de vérifier votre solde de tokens");
      }

      if ((profile?.tokens ?? 0) < usedTokens) {
        throw new Error('Solde de tokens insuffisant');
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ tokens: (profile.tokens || 0) - usedTokens })
        .eq('user_id', user!.id);

      if (updateError) {
        throw new Error('Échec de la mise à jour du solde de tokens');
      }

      // Notifier la mise à jour des tokens
      tokenUpdateEvent.dispatchEvent(new CustomEvent(TOKEN_UPDATED));

      onTokensUpdated?.();
      setResult(generatedResult);
      if (tag) {
        await saveAppreciation(tag, generatedResult);
      }
    } catch (error: any) {
      console.error('Erreur lors de la génération:', error);
      setError(error.message || 'Une erreur est survenue lors de la génération. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    reset();
    setResult(null);
    setError(null);
    setIsGenerateClicked(false);
    setTag('');
    setSaveError(null);
    setSaveSuccess(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(handleGenerateClick)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Matière
          </label>
          <select
            {...register('subject')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sélectionnez une matière</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Prénom de l'élève
          </label>
          <input
            type="text"
            {...register('studentName')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Longueur minimale (caractères)
            </label>
            <Controller
              name="minLength"
              control={control}
              render={({ field }) => (
                <input
                  type="number"
                  {...field}
                  onChange={(e) => {
                    field.onChange(Number(e.target.value));
                    setIsGenerateClicked(false);
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  min="50"
                  max="500"
                />
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Longueur maximale (caractères)
            </label>
            <Controller
              name="maxLength"
              control={control}
              render={({ field }) => (
                <input
                  type="number"
                  {...field}
                  onChange={(e) => {
                    field.onChange(Number(e.target.value));
                    setIsGenerateClicked(false);
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  min="100"
                  max="1000"
                />
              )}
            />
          </div>
        </div>

        <Controller
          name="criteria"
          control={control}
          render={({ field }) => (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Critères d'évaluation</h3>
              {field.value.map((criterion, index) => (
                <div key={criterion.id || index} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    {criterion.name}
                  </label>
                  <RatingBar
                    value={criterion.value}
                    onChange={(value) => {
                      const newCriteria = [...field.value];
                      newCriteria[index] = { ...criterion, value };
                      field.onChange(newCriteria);
                      setIsGenerateClicked(false);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Ton de l'appréciation
          </label>
          <select
            {...register('tone')}
            onChange={(e) => {
              register('tone').onChange(e);
              setIsGenerateClicked(false);
            }}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="bienveillant">Bienveillant</option>
            <option value="normal">Normal</option>
            <option value="severe">Sévère</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Notes personnelles
          </label>
          <textarea
            {...register('personalNotes')}
            onChange={(e) => {
              register('personalNotes').onChange(e);
              setIsGenerateClicked(false);
            }}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                Génération en cours...
              </>
            ) : (
              <>
                <Send className="-ml-1 mr-2 h-5 w-5" />
                {isGenerateClicked ? "Confirmer la génération" : "Générer les appréciations"}
              </>
            )}
          </button>
          {result && (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </form>

      {result && (
        <>
          <AppreciationResult detailed={result.detailed} summary={result.summary} />
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Tag
              </label>
              <select
                value={tag}
                onChange={handleTagChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Sélectionnez un tag</option>
                <option value="positif">Positif</option>
                <option value="neutre">Neutre</option>
                <option value="negatif">Négatif</option>
              </select>
            </div>
            {saveError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{saveError}</div>
              </div>
            )}
            {saveSuccess && (
              <div className="rounded-md bg-green-50 p-4">
                <div className="text-sm text-green-700">{saveSuccess}</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}