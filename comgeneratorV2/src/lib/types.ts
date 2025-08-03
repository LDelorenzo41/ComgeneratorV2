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
}

export interface SavedAppreciation {
  id: string;
  detailed: string;
  summary: string;
  tag: AppreciationTag;
  createdAt: string;
}

export interface Article {
  id: string;
  title: string;
  description: string | null;
  link: string;
  source: string;
  pub_date: string;
  created_at: string;
}

export interface BlogArticle {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}
