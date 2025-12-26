import { Database } from './database.types';

export interface Subject {
  id: string;
  name: string;
  userId: string;
  criteria: Criterion[];
  createdAt: string;
  updatedAt: string;
}

export interface Criterion {
  id: string;
  name: string;
  importance: number;
}

export interface AppreciationResult {
  detailed: string;
  summary: string;
  usedTokens: number;
}

export type AppreciationTone = 'bienveillant' | 'normal' | 'severe';

// ✅ AJOUT : Type pour le mode d'adresse
export type AddressMode = 'tutoiement' | 'vouvoiement' | 'impersonnel';

export type AppreciationTag = 'tres_bien' | 'bien' | 'moyen' | 'insuffisant';

export interface AppreciationFormFields {
  subject: string;
  studentName: string;
  criteria: Array<{
    id: string;
    name: string;
    value: number;
    importance: number;
  }>;
  personalNotes: string;
  minLength: number;
  maxLength: number;
  tone: AppreciationTone;
  addressMode: AddressMode;  // ✅ AJOUT
}

export interface SavedAppreciation {
  id: string;
  detailed: string;
  summary: string;
  tag: AppreciationTag;
  createdAt: string;
}

// Interface pour les flux RSS
export interface RssFeed {
  id: string;
  name: string;
  category: string | null;
  url: string;
  source_domain: string | null;
  is_active: boolean;
}

// Interface pour les préférences utilisateur
export interface UserRssPreference {
  user_id: string;
  position: number;
  feed_id: string;
  feed?: RssFeed;
}

// Mise à jour pour inclure image_url et champs optionnels + feed_id obligatoire
export interface Article {
  id: string;
  title: string;
  description?: string | null;
  link: string;
  source?: string | null;
  pub_date: string;
  created_at?: string | null;
  image_url?: string | null;
  feed_id: string; // ← MODIFIÉ : maintenant obligatoire (non nullable)
}

export interface BlogArticle {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Types pour la banque de réponses chatbot
// ============================================

export type ChatbotAnswerCategory = 
  | 'Cadre officiel'
  | 'Conseil pédagogique'
  | 'Exemple concret'
  | 'Formulation institutionnelle';

export interface ChatbotAnswer {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: ChatbotAnswerCategory;
  subject: string | null;
  level: string | null;
  created_at: string;
}

export interface ChatbotAnswerInsert {
  title: string;
  content: string;
  category: ChatbotAnswerCategory;
  subject?: string | null;
  level?: string | null;
}
