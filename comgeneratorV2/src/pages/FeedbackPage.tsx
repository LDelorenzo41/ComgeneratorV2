import React from 'react';
import { ClipboardList, ChevronLeft, ChevronRight, Send, Loader2 } from 'lucide-react';
import { FeedbackStepper } from '../components/feedback/FeedbackStepper';
import { FeedbackProfileSection } from '../components/feedback/FeedbackProfileSection';
import { FeedbackFeatureSection } from '../components/feedback/FeedbackFeatureSection';
import { FeedbackUXSection } from '../components/feedback/FeedbackUXSection';
import { FeedbackPricingSection } from '../components/feedback/FeedbackPricingSection';
import { FeedbackGeneralSection } from '../components/feedback/FeedbackGeneralSection';
import { FeedbackThankYou } from '../components/feedback/FeedbackThankYou';
import { useFeedbackStore } from '../lib/feedbackStore';
import { submitFeedback } from '../lib/feedbackApi';
import { FEEDBACK_SECTIONS } from '../types/feedback';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { tokenUpdateEvent, TOKEN_UPDATED } from '../components/layout/Header';
import { useHasSubmittedFeedback } from '../hooks/useHasSubmittedFeedback';
import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  appreciations: 'Génération automatique d\'appréciations personnalisées pour les élèves, avec gestion de matières et critères.',
  syntheses: 'Upload de bulletins PDF, extraction OCR et synthèse automatique par l\'IA.',
  communications: 'Rédaction de messages professionnels (parents, collègues) et réponses assistées par l\'IA.',
  seances: 'Création de séances pédagogiques structurées avec export PDF et choix du type de pédagogie.',
  scenarios: 'Planification de séquences pédagogiques multi-séances avec objectifs et évaluations.',
  banques: 'Sauvegarde, recherche et réutilisation de vos appréciations, séances, scénarios et réponses chatbot.',
  veille: 'Fil d\'actualités éducatives (RSS) : Café Pédagogique, Éduscol, VousNousIls, etc.',
  chatbot: 'Chatbot personnel basé sur vos propres documents (RAG) avec corpus officiel et personnel.',
};

const STEP_LABELS = [
  'Votre profil',
  ...FEEDBACK_SECTIONS.map(s => s.label),
  'UX / Design',
  'Tarification',
  'Satisfaction Générale',
];

const TOTAL_STEPS = STEP_LABELS.length;

const FEEDBACK_REWARD_TOKENS = 30000;

export function FeedbackPage() {
  const {
    currentStep,
    setCurrentStep,
    profile,
    ratings,
    comments,
    generalTexts,
    isSubmitting,
    setIsSubmitting,
    isSubmitted,
    setIsSubmitted,
    reset,
  } = useFeedbackStore();

  const { user } = useAuthStore();
  const { hasSubmitted, isLoading: isCheckingFeedback } = useHasSubmittedFeedback();
  const [error, setError] = React.useState<string | null>(null);

  // Pas de reset au montage → on reprend là où le user en était (persisté dans localStorage)

  const validateProfileStep = (): string | null => {
    if (!profile.tester_email || !profile.tester_email.trim()) {
      return 'L\'adresse email est obligatoire.';
    }
    if (!profile.matiere || !profile.matiere.trim()) {
      return 'La matière enseignée est obligatoire.';
    }
    if (!profile.niveau) {
      return 'Le niveau d\'enseignement est obligatoire.';
    }
    if (profile.anciennete === null || profile.anciennete === undefined) {
      return 'Les années d\'expérience sont obligatoires.';
    }
    return null;
  };

  const handleNext = () => {
    setError(null);

    // Validation à l'étape profil (step 0)
    if (currentStep === 0) {
      const validationError = validateProfileStep();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setError(null);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Créditer les tokens de récompense
  const creditRewardTokens = async () => {
    if (!user) return;

    try {
      const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          tokens: (profileData?.tokens || 0) + FEEDBACK_REWARD_TOKENS,
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Notifier le Header pour mettre à jour le solde affiché
      tokenUpdateEvent.dispatchEvent(new CustomEvent(TOKEN_UPDATED));
    } catch (err) {
      console.error('Erreur lors du crédit des tokens de récompense:', err);
    }
  };

  const handleSubmit = async () => {
    // Validation profil (au cas où le user revient en arrière et modifie)
    const validationError = validateProfileStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Préparer les ratings
      const allRatings: { section: string; question_key: string; rating: number }[] = [];
      Object.entries(ratings).forEach(([section, questions]) => {
        Object.entries(questions).forEach(([questionKey, rating]) => {
          if (rating > 0) {
            allRatings.push({ section, question_key: questionKey, rating });
          }
        });
      });

      // Préparer les commentaires
      const allComments: { section: string; comment: string }[] = [];
      Object.entries(comments).forEach(([section, comment]) => {
        if (comment.trim()) {
          allComments.push({ section, comment: comment.trim() });
        }
      });

      // Ajouter les textes libres de la section générale comme commentaires
      if (generalTexts.fonctionnalite_preferee.trim()) {
        allComments.push({ section: 'general_preferee', comment: generalTexts.fonctionnalite_preferee.trim() });
      }
      if (generalTexts.fonctionnalite_manquante.trim()) {
        allComments.push({ section: 'general_manquante', comment: generalTexts.fonctionnalite_manquante.trim() });
      }
      if (generalTexts.bugs.trim()) {
        allComments.push({ section: 'general_bugs', comment: generalTexts.bugs.trim() });
      }
      if (generalTexts.commentaire_final.trim()) {
        allComments.push({ section: 'general', comment: generalTexts.commentaire_final.trim() });
      }

      const result = await submitFeedback(
        {
          tester_name: profile.tester_name,
          tester_email: profile.tester_email,
          matiere: profile.matiere,
          niveau: profile.niveau,
          anciennete: profile.anciennete,
          a_achete_tokens: profile.a_achete_tokens,
          prevoit_acheter: profile.prevoit_acheter,
          raison_achat: profile.raison_achat,
          completed: true,
        },
        allRatings,
        allComments
      );

      if (result.success) {
        // Créditer les tokens de récompense
        await creditRewardTokens();
        setIsSubmitted(true);
        // Nettoyer le localStorage (le reset du store s'en charge)
        reset();
        // Remettre isSubmitted après le reset
        setIsSubmitted(true);
      } else {
        setError(result.error || 'Une erreur est survenue lors de l\'envoi.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur inattendue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Garde : feedback déjà soumis (accès direct par URL)
  if (!isCheckingFeedback && hasSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Vous avez déjà donné votre avis
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Merci pour votre participation ! Vos retours nous sont précieux.
          </p>
          <Link
            to="/landing"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <FeedbackThankYou />
        </div>
      </div>
    );
  }

  const isLastStep = currentStep === TOTAL_STEPS - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium mb-3">
            <ClipboardList className="w-4 h-4" />
            Retours Testeurs ProfAssist
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Aidez-nous à améliorer ProfAssist
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Ce questionnaire prend entre 5 et 10 minutes. Vos réponses sont anonymes.
          </p>
        </div>

        {/* Carte principale */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
          <FeedbackStepper
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            stepLabels={STEP_LABELS}
          />

          {/* Contenu de l'étape */}
          <div className="min-h-[300px]">
            {currentStep === 0 && <FeedbackProfileSection />}

            {currentStep >= 1 && currentStep <= 8 && (
              <FeedbackFeatureSection
                sectionKey={FEEDBACK_SECTIONS[currentStep - 1].key}
                featureName={FEEDBACK_SECTIONS[currentStep - 1].label}
                featureDescription={FEATURE_DESCRIPTIONS[FEEDBACK_SECTIONS[currentStep - 1].key]}
              />
            )}

            {currentStep === 9 && <FeedbackUXSection />}
            {currentStep === 10 && <FeedbackPricingSection />}
            {currentStep === 11 && <FeedbackGeneralSection />}
          </div>

          {/* Erreur */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </button>

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Envoyer mes retours
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}