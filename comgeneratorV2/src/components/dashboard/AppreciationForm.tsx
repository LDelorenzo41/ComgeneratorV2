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
import useTokenBalance from '../../hooks/useTokenBalance'; // ✅ AJOUT
import { 
  PenTool, 
  User, 
  BarChart3, 
  MessageCircle, 
  Volume2, 
  FileText, 
  Sparkles,
  RotateCcw,
  CheckCircle,
  Target,
  Settings,
  AlertCircle, // ✅ AJOUT
  CreditCard // ✅ AJOUT
} from 'lucide-react';
import { Link } from 'react-router-dom'; // ✅ AJOUT

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
  tokensAvailable?: number; // ✅ PROP pour recevoir le nombre de tokens
}

export function AppreciationForm({ onTokensUpdated, tokensAvailable }: AppreciationFormProps) {
  const { user } = useAuthStore();
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AppreciationResultType | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isGenerateClicked, setIsGenerateClicked] = React.useState(false);
  const [tag, setTag] = React.useState('');
  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [editableDetailed, setEditableDetailed] = React.useState('');
  const [editableSummary, setEditableSummary] = React.useState('');
  const [subjectsRefreshKey, setSubjectsRefreshKey] = React.useState(0);
  
  // ✅ MODIFICATION : Remplacement de la logique locale par useTokenBalance
  const tokenBalance = useTokenBalance();
  const [tokenCount, setTokenCount] = React.useState<number>(0);

  // ✅ AJOUT : Synchronisation des tokens
  React.useEffect(() => {
    setTokenCount(tokenBalance ?? 0);
  }, [tokenBalance]);

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
    async (tagValue: string, _generated?: AppreciationResultType) => {
      if (!user) return;

      const dataToSave = {
        detailed: editableDetailed,
        summary: editableSummary
      };

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
    [editableDetailed, editableSummary, user]
  );

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
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);
      console.log('Matières récupérées:', subjectsData);
    } catch (error) {
      console.error('Erreur lors de la récupération des matières:', error);
      setError('Erreur lors de la récupération des matières. Veuillez réessayer.');
    }
  }, [user]);

  React.useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects, subjectsRefreshKey]);

  React.useEffect(() => {
    const handleSubjectUpdate = () => {
      console.log('Événement SUBJECT_UPDATED reçu - refresh des matières');
      setSubjectsRefreshKey(prev => prev + 1);
      fetchSubjects();
    };

    subjectUpdateEvent.addEventListener(SUBJECT_UPDATED, handleSubjectUpdate);
    
    return () => {
      subjectUpdateEvent.removeEventListener(SUBJECT_UPDATED, handleSubjectUpdate);
    };
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
    // ✅ MODIFICATION : Nouvelle logique de vérification des tokens
    if (tokenCount === 0) {
      setError('Crédits insuffisants pour générer une appréciation.');
      return;
    }

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

      // ✅ MODIFICATION : Nouvelle logique de mise à jour des tokens
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tokens')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              tokens: Math.max(0, (profile.tokens || 0) - usedTokens) 
            })
            .eq('user_id', user.id);

          if (!updateError) {
            tokenUpdateEvent.dispatchEvent(new CustomEvent(TOKEN_UPDATED));
          }
        }
      }

      onTokensUpdated?.();
      setResult(generatedResult);
      setEditableDetailed(generatedResult.detailed);
      setEditableSummary(generatedResult.summary);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header avec compteur de tokens */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
              <PenTool className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Générateur d'appréciations
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Créez des appréciations personnalisées et pertinentes basées sur vos critères d'évaluation
          </p>
          
          {/* Compteur de tokens modernisé avec alerte si 0 tokens */}
          {tokenBalance !== null && (
            <div className={`inline-flex items-center px-6 py-3 rounded-xl shadow-lg border ${
              tokenCount === 0 
                ? 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}>
              {tokenCount === 0 ? (
                <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
              ) : (
                <Sparkles className="w-5 h-5 text-blue-500 mr-3" />
              )}
              <span className={`text-sm font-medium ${
                tokenCount === 0 
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {tokenCount === 0 ? (
                  <>
                    <span className="font-bold">Crédits épuisés !</span>
                    <Link 
                      to="/buy-tokens" 
                      className="ml-2 underline hover:no-underline"
                    >
                      Recharger →
                    </Link>
                  </>
                ) : (
                  <>
                    Crédits restants : <span className="font-bold text-blue-600 dark:text-blue-400">{tokenCount.toLocaleString()}</span> tokens
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {/* ✅ AJOUT : Alerte tokens épuisés */}
        {tokenCount === 0 && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-3xl p-8 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-4">
                Génération indisponible
              </h2>
              <p className="text-red-600 dark:text-red-400 mb-6 max-w-2xl mx-auto">
                Vous avez utilisé tous vos tokens. Pour continuer à générer des appréciations, veuillez recharger votre compte.
              </p>
              <Link
                to="/buy-tokens"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <CreditCard className="w-5 h-5 mr-3" />
                Recharger mes crédits
              </Link>
            </div>
          </div>
        )}

        {/* Formulaire principal modernisé */}
        <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 mb-8 ${
          tokenCount === 0 ? 'opacity-50' : ''
        }`}>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Paramètres de l'appréciation
              {/* ✅ AJOUT : Badge "Indisponible" si 0 tokens */}
              {tokenCount === 0 && (
                <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  Indisponible
                </span>
              )}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {tokenCount === 0 
                ? 'Rechargez vos crédits pour générer une appréciation personnalisée'
                : 'Configurez les détails pour générer une appréciation personnalisée'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit(handleGenerateClick)} className="space-y-8">
            
            {/* Matière et Élève */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <Target className="w-4 h-4 inline mr-2" />
                  Matière
                </label>
                <select
                  {...register('subject')}
                  key={`subject-select-${subjectsRefreshKey}`}
                  disabled={tokenCount === 0} // ✅ AJOUT : Désactivation si 0 tokens
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Sélectionnez une matière</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                {subjects.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1 flex items-center">
                    <span className="mr-1">ℹ️</span>
                    Aucune matière disponible. Créez une matière ci-dessus.
                  </p>
                )}
                {form.formState.errors.subject && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <span className="mr-1">⚠️</span>
                    {form.formState.errors.subject.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Prénom de l'élève
                </label>
                <input
                  type="text"
                  {...register('studentName')}
                  disabled={tokenCount === 0} // ✅ AJOUT : Désactivation si 0 tokens
                  placeholder="Ex: Marie, Lucas, Emma..."
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {form.formState.errors.studentName && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <span className="mr-1">⚠️</span>
                    {form.formState.errors.studentName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Longueurs */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <BarChart3 className="w-4 h-4 inline mr-2" />
                  Longueur minimale (caractères)
                </label>
                <Controller
                  name="minLength"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="number"
                      {...field}
                      disabled={tokenCount === 0} // ✅ AJOUT : Désactivation si 0 tokens
                      onChange={(e) => {
                        field.onChange(Number(e.target.value));
                        setIsGenerateClicked(false);
                      }}
                      min="50"
                      max="500"
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  )}
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <BarChart3 className="w-4 h-4 inline mr-2" />
                  Longueur maximale (caractères)
                </label>
                <Controller
                  name="maxLength"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="number"
                      {...field}
                      disabled={tokenCount === 0} // ✅ AJOUT : Désactivation si 0 tokens
                      onChange={(e) => {
                        field.onChange(Number(e.target.value));
                        setIsGenerateClicked(false);
                      }}
                      min="100"
                      max="1000"
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  )}
                />
              </div>
            </div>

            {/* Critères d'évaluation */}
            <Controller
              name="criteria"
              control={control}
              render={({ field }) => (
                <div className="space-y-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                      <Settings className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      Critères d'évaluation
                    </h3>
                  </div>
                  
                  {field.value.length > 0 ? (
                    <div className="grid gap-6">
                      {field.value.map((criterion, index) => (
                        <div key={index} className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 p-6 rounded-2xl border border-gray-200 dark:border-gray-600">
                          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
                            {criterion.name}
                          </label>
                          <RatingBar
                            value={criterion.value}
                            onChange={tokenCount === 0 ? () => {} : (value) => {
                              const newCriteria = [...field.value];
                              newCriteria[index] = { ...criterion, value };
                              field.onChange(newCriteria);
                              setIsGenerateClicked(false);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                      <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 font-medium">
                        Sélectionnez une matière pour voir les critères d'évaluation
                      </p>
                    </div>
                  )}
                </div>
              )}
            />

            {/* Ton de l'appréciation */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <Volume2 className="w-4 h-4 inline mr-2" />
                Ton de l'appréciation
              </label>
              <select
                {...register('tone')}
                disabled={tokenCount === 0} // ✅ AJOUT : Désactivation si 0 tokens
                onChange={(e) => {
                  register('tone').onChange(e);
                  setIsGenerateClicked(false);
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="bienveillant">Bienveillant</option>
                <option value="normal">Normal</option>
                <option value="severe">Sévère</option>
              </select>
            </div>

            {/* Notes personnelles */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Notes personnelles (optionnel)
              </label>
              <textarea
                {...register('personalNotes')}
                disabled={tokenCount === 0} // ✅ AJOUT : Désactivation si 0 tokens
                onChange={(e) => {
                  register('personalNotes').onChange(e);
                  setIsGenerateClicked(false);
                }}
                rows={4}
                placeholder="Ajoutez des observations particulières, des points à mentionner..."
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Erreur */}
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-red-700 dark:text-red-300 font-medium">❌ {error}</p>
              </div>
            )}

            {/* Boutons d'action */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                disabled={loading || tokenCount === 0} // ✅ MODIFICATION : Désactivation si 0 tokens
                className="flex-1 group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                <span className="relative flex items-center justify-center">
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5 mr-3" />
                      Génération en cours...
                    </>
                  ) : tokenCount === 0 ? ( // ✅ MODIFICATION : Condition pour crédits épuisés
                    <>
                      <CreditCard className="w-5 h-5 mr-3" />
                      Crédits épuisés
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-3" />
                      {isGenerateClicked ? "Confirmer la génération" : "Générer les appréciations"}
                    </>
                  )}
                </span>
              </button>
              
              {result && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl border-2 border-gray-300 dark:border-gray-500 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
                >
                  <RotateCcw className="w-5 h-5 mr-2 inline" />
                  Réinitialiser
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Résultats générés */}
        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Appréciations générées
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Vos appréciations sont prêtes ! Vous pouvez les éditer si nécessaire
              </p>
            </div>

            <AppreciationResult
              detailed={editableDetailed}
              summary={editableSummary}
              setDetailed={setEditableDetailed}
              setSummary={setEditableSummary}
            />

            {/* Messages de feedback */}
            <div className="mt-6 space-y-4">
              {saveError && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-red-700 dark:text-red-300 font-medium">❌ {saveError}</p>
                </div>
              )}
              {saveSuccess && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <p className="text-green-700 dark:text-green-300 font-medium">✅ {saveSuccess}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}