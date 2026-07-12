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
  RotateCcw,
  CheckCircle,
  Target,
  Settings,
  CreditCard
} from 'lucide-react';

const appreciationSchema = z.object({
  subject: z.string().min(1, 'Veuillez sélectionner une matière'),
  studentName: z.string().min(1, 'Le prénom de l\'élève est requis'),
  criteria: z.array(z.object({
    name: z.string(),
    value: z.number().min(0).max(7),
  })),
  personalNotes: z.string().optional(),
  tone: z.enum(['bienveillant', 'normal', 'severe'] as const),
  addressMode: z.enum(['tutoiement', 'vouvoiement', 'impersonnel'] as const),  // ✅ AJOUT
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
  const [tag, setTag] = React.useState('');
  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [editableDetailed, setEditableDetailed] = React.useState('');
  const [editableSummary, setEditableSummary] = React.useState('');
  const [lastUsedTokens, setLastUsedTokens] = React.useState<number | null>(null);
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
      addressMode: 'tutoiement',  // ✅ AJOUT : valeur par défaut
      personalNotes: '',
      minLength: 150,
      maxLength: 300
    }
  });

  const { register, control, handleSubmit, watch, setValue, reset } = form;
  const selectedSubject = watch('subject');

  // Presets de longueur ("Personnalisée" rouvre les champs min/max exacts)
  type LengthPreset = 'courte' | 'moyenne' | 'detaillee' | 'custom';
  const LENGTH_PRESETS: Record<Exclude<LengthPreset, 'custom'>, { min: number; max: number; label: string; hint: string }> = {
    courte: { min: 100, max: 150, label: 'Courte', hint: '≈ 150 caractères' },
    moyenne: { min: 150, max: 300, label: 'Moyenne', hint: '≈ 300 caractères' },
    detaillee: { min: 300, max: 500, label: 'Détaillée', hint: '≈ 500 caractères' }
  };
  const [lengthPreset, setLengthPreset] = React.useState<LengthPreset>('moyenne');
  const applyLengthPreset = (preset: LengthPreset) => {
    setLengthPreset(preset);
    if (preset !== 'custom') {
      setValue('minLength', LENGTH_PRESETS[preset].min);
      setValue('maxLength', LENGTH_PRESETS[preset].max);
    }
  };


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
      }
    }
  }, [selectedSubject, subjects, setValue]);

  const handleGenerateClick = async (data: FormData) => {
    // ✅ MODIFICATION : Nouvelle logique de vérification des tokens
    if (tokenCount === 0) {
      setError('Crédits insuffisants pour générer une appréciation.');
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
          importance: subject.criteria[i].importance ?? 2
        })),
        personalNotes: data.personalNotes || '',
        minLength: data.minLength,
        maxLength: data.maxLength,
        tone: data.tone,
        addressMode: data.addressMode  // ✅ AJOUT
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
      setLastUsedTokens(usedTokens);
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
    setLengthPreset('moyenne');
    setResult(null);
    setLastUsedTokens(null);
    setError(null);
    setTag('');
    setSaveError(null);
    setSaveSuccess(null);
  };

  return (
    <div>
        {/* Formulaire principal modernisé */}
        <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 mb-8 ${
          tokenCount === 0 ? 'opacity-50' : ''
        }`}>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Paramètres de l'appréciation
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

            {/* Longueur : presets + réglage fin conservé */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Longueur de l'appréciation
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Longueur de l'appréciation">
                {(Object.keys(LENGTH_PRESETS) as Array<Exclude<LengthPreset, 'custom'>>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={tokenCount === 0}
                    aria-pressed={lengthPreset === key}
                    onClick={() => applyLengthPreset(key)}
                    className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      lengthPreset === key
                        ? 'bg-blue-600 border-blue-600 text-white shadow'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400'
                    }`}
                  >
                    {LENGTH_PRESETS[key].label}
                    <span className={`block text-xs font-normal ${lengthPreset === key ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                      {LENGTH_PRESETS[key].hint}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  disabled={tokenCount === 0}
                  aria-pressed={lengthPreset === 'custom'}
                  onClick={() => applyLengthPreset('custom')}
                  className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    lengthPreset === 'custom'
                      ? 'bg-blue-600 border-blue-600 text-white shadow'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400'
                  }`}
                >
                  Personnalisée
                  <span className={`block text-xs font-normal ${lengthPreset === 'custom' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    min / max exacts
                  </span>
                </button>
              </div>
            </div>

            {/* Réglage fin min/max : affiché avec le preset "Personnalisée" */}
            <div className={`grid md:grid-cols-2 gap-6 ${lengthPreset === 'custom' ? '' : 'hidden'}`}>
              <div className="space-y-2">
                <label htmlFor="minLength" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <BarChart3 className="w-4 h-4 inline mr-2" />
                  Longueur minimale (caractères)
                </label>
                <Controller
                  name="minLength"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="number"
                      id="minLength"
                      {...field}
                      disabled={tokenCount === 0} // ✅ AJOUT : Désactivation si 0 tokens
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      min="50"
                      max="500"
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  )}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="maxLength" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <BarChart3 className="w-4 h-4 inline mr-2" />
                  Longueur maximale (caractères)
                </label>
                <Controller
                  name="maxLength"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="number"
                      id="maxLength"
                      {...field}
                      disabled={tokenCount === 0} // ✅ AJOUT : Désactivation si 0 tokens
                      onChange={(e) => field.onChange(Number(e.target.value))}
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
                          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
                            {criterion.name}
                            {(() => {
                              const importance = subjects.find(s => s.id === selectedSubject)?.criteria[index]?.importance;
                              if (importance === 3) return <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" title="Ce critère pèse davantage dans l'appréciation">★ Crucial</span>;
                              if (importance === 2) return <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title="Ce critère pèse davantage dans l'appréciation">Important</span>;
                              return null;
                            })()}
                          </label>
                          <RatingBar
                            value={criterion.value}
                            onChange={tokenCount === 0 ? () => {} : (value) => {
                              const newCriteria = [...field.value];
                              newCriteria[index] = { ...criterion, value };
                              field.onChange(newCriteria);
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
                disabled={tokenCount === 0}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="bienveillant">Bienveillant</option>
                <option value="normal">Normal</option>
                <option value="severe">Sévère</option>
              </select>
            </div>
            {/* ✅ AJOUT : Mode d'adresse */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <MessageCircle className="w-4 h-4 inline mr-2" />
                Mode d'adresse
              </label>
              <select
                {...register('addressMode')}
                disabled={tokenCount === 0}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="tutoiement">Tutoiement</option>
                <option value="vouvoiement">Vouvoiement</option>
                <option value="impersonnel">Formulation impersonnelle</option>
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
                disabled={tokenCount === 0}
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
                      Générer les appréciations
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
                {lastUsedTokens !== null && (
                  <span className="block mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Consommation réelle : <strong className="text-gray-700 dark:text-gray-300">{lastUsedTokens.toLocaleString('fr-FR')} crédits</strong>
                  </span>
                )}
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
  );
}