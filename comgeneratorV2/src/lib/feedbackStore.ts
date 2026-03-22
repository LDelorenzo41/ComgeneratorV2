import { create } from 'zustand';

interface FeedbackFormState {
  // Étape courante
  currentStep: number;
  setCurrentStep: (step: number) => void;

  // Profil testeur
  profile: {
    tester_name: string;
    tester_email: string;
    matiere: string;
    niveau: string;
    anciennete: number | null;
    a_achete_tokens: boolean | null;
    prevoit_acheter: string;
    raison_achat: string;
  };
  setProfile: (profile: Partial<FeedbackFormState['profile']>) => void;

  // Ratings : section -> question_key -> rating (1-5)
  ratings: Record<string, Record<string, number>>;
  setRating: (section: string, questionKey: string, rating: number) => void;

  // Commentaires : section -> comment
  comments: Record<string, string>;
  setComment: (section: string, comment: string) => void;

  // Textes libres pour la section générale
  generalTexts: {
    fonctionnalite_preferee: string;
    fonctionnalite_manquante: string;
    bugs: string;
    commentaire_final: string;
  };
  setGeneralText: (key: keyof FeedbackFormState['generalTexts'], value: string) => void;

  // Soumission
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  isSubmitted: boolean;
  setIsSubmitted: (v: boolean) => void;

  // Reset
  reset: () => void;
}

const initialProfile = {
  tester_name: '',
  tester_email: '',
  matiere: '',
  niveau: '',
  anciennete: null as number | null,
  a_achete_tokens: null as boolean | null,
  prevoit_acheter: '',
  raison_achat: '',
};

const initialGeneralTexts = {
  fonctionnalite_preferee: '',
  fonctionnalite_manquante: '',
  bugs: '',
  commentaire_final: '',
};

export const useFeedbackStore = create<FeedbackFormState>((set) => ({
  currentStep: 0,
  setCurrentStep: (step) => set({ currentStep: step }),

  profile: { ...initialProfile },
  setProfile: (partial) =>
    set((state) => ({ profile: { ...state.profile, ...partial } })),

  ratings: {},
  setRating: (section, questionKey, rating) =>
    set((state) => ({
      ratings: {
        ...state.ratings,
        [section]: {
          ...(state.ratings[section] || {}),
          [questionKey]: rating,
        },
      },
    })),

  comments: {},
  setComment: (section, comment) =>
    set((state) => ({
      comments: { ...state.comments, [section]: comment },
    })),

  generalTexts: { ...initialGeneralTexts },
  setGeneralText: (key, value) =>
    set((state) => ({
      generalTexts: { ...state.generalTexts, [key]: value },
    })),

  isSubmitting: false,
  setIsSubmitting: (v) => set({ isSubmitting: v }),
  isSubmitted: false,
  setIsSubmitted: (v) => set({ isSubmitted: v }),

  reset: () =>
    set({
      currentStep: 0,
      profile: { ...initialProfile },
      ratings: {},
      comments: {},
      generalTexts: { ...initialGeneralTexts },
      isSubmitting: false,
      isSubmitted: false,
    }),
}));