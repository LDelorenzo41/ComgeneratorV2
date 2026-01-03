// src/lib/rag.types.ts
// Types pour le module RAG Chatbot

export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'error';
export type ChatMode = 'corpus_only' | 'corpus_plus_ai';
export type MessageRole = 'user' | 'assistant' | 'system';
export type DocumentScope = 'global' | 'user';
export type SearchMode = 'fast' | 'precise';

// Options de sélection des corpus (switches)
export interface CorpusSelection {
  usePersonalCorpus: boolean;
  useProfAssistCorpus: boolean;
  useAI: boolean;
}

// Valeurs par défaut
export const DEFAULT_CORPUS_SELECTION: CorpusSelection = {
  usePersonalCorpus: true,
  useProfAssistCorpus: false,
  useAI: false,
};

// 🆕 Filtres optionnels pour la recherche RAG
export interface SearchFilters {
  levels?: string[];
  subjects?: string[];
}

// 🆕 Listes de valeurs suggérées (non exhaustives)
export const AVAILABLE_LEVELS = [
  'cycle 1',
  'cycle 2',
  'cycle 3',
  'cycle 4',
  'collège',
  'lycée',
  'voie professionnelle',
  'voie générale',
  'CAP',
  'BTS',
] as const;

export const AVAILABLE_SUBJECTS = [
  'EPS',
  'Mathématiques',
  'SVT',
  'Physique-Chimie',
  'Français',
  'Langues',
  'Histoire-Géographie',
  'Arts plastiques',
  'Musique',
  'Technologie',
  'EMC',
] as const;

// 🆕 Types de documents
export const DOCUMENT_TYPES = {
  programme: { label: 'Programme', icon: '📋', color: 'blue' },
  ressource: { label: 'Ressource', icon: '📖', color: 'green' },
  guide: { label: 'Guide', icon: '📝', color: 'amber' },
  circulaire: { label: 'Circulaire', icon: '📜', color: 'orange' },
  evaluation: { label: 'Évaluation', icon: '📊', color: 'cyan' },
  mise_en_oeuvre: { label: 'Mise en œuvre', icon: '🛠️', color: 'indigo' },
  referentiel: { label: 'Référentiel', icon: '📑', color: 'purple' },
  autre: { label: 'Autre', icon: '📄', color: 'gray' },
} as const;

export type DocumentType = keyof typeof DOCUMENT_TYPES;

// 🆕 Labels des niveaux pour affichage
export const LEVEL_LABELS: Record<string, string> = {
  maternelle: 'Maternelle',
  cycle_1: 'Cycle 1',
  cycle_2: 'Cycle 2',
  cycle_3: 'Cycle 3',
  cycle_4: 'Cycle 4',
  college: 'Collège',
  lycee_general: 'Lycée général',
  lycee_technologique: 'Lycée techno.',
  lycee_professionnel: 'Lycée pro.',
};

export interface RagDocument {
  id: string;
  user_id: string;
  title: string;
  source_type: string;
  storage_path: string | null;
  mime_type: string;
  file_size: number | null;
  status: DocumentStatus;
  error_message: string | null;
  chunk_count: number;
  scope: DocumentScope;
  created_at: string;
  updated_at: string;
  // 🆕 Métadonnées IA
  summary?: string | null;
  keywords?: string[] | null;
  levels?: string[] | null;
  subjects?: string[] | null;
  document_type?: DocumentType | null;
  language?: string | null;
}

export interface SourceChunk {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
  scope?: DocumentScope;
}

export interface ChatUIMessage {
  id: string;
  role: MessageRole;
  content: string;
  sources?: SourceChunk[];
  timestamp: Date;
  isLoading?: boolean;
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
  conversationId: string;
  tokensUsed: number;
  mode: ChatMode;
}

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getStatusLabel(status: DocumentStatus): string {
  const labels: Record<DocumentStatus, string> = {
    uploaded: 'En attente',
    processing: 'Traitement...',
    ready: 'Prêt',
    error: 'Erreur',
  };
  return labels[status];
}

export function getStatusColor(status: DocumentStatus): string {
  const colors: Record<DocumentStatus, string> = {
    uploaded: 'text-yellow-600 bg-yellow-100',
    processing: 'text-blue-600 bg-blue-100',
    ready: 'text-green-600 bg-green-100',
    error: 'text-red-600 bg-red-100',
  };
  return colors[status];
}

export function getScopeLabel(scope: DocumentScope): string {
  return scope === 'global' ? 'Document officiel' : 'Document personnel';
}

export function getScopeColor(scope: DocumentScope): string {
  return scope === 'global' 
    ? 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30' 
    : 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
}




