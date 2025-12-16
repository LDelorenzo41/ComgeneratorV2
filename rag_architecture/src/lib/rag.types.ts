// src/lib/rag.types.ts
// Types TypeScript pour le module RAG

// ============================================================================
// DOCUMENTS
// ============================================================================

export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'error';

export interface RagDocument {
  id: string;
  user_id: string;
  title: string;
  source_type: string;
  storage_path: string;
  mime_type: string;
  file_size: number | null;
  status: DocumentStatus;
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CHUNKS
// ============================================================================

export interface RagChunk {
  id: string;
  document_id: string;
  user_id: string;
  chunk_index: number;
  content: string;
  content_hash: string;
  token_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

export type ChatMode = 'corpus_only' | 'corpus_plus_ai';

export interface RagConversation {
  id: string;
  user_id: string;
  title: string;
  mode: ChatMode;
  document_filter_id: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface RagMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  sources: SourceChunk[];
  tokens_used: number;
  created_at: string;
}

// ============================================================================
// SOURCES
// ============================================================================

export interface SourceChunk {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
}

// ============================================================================
// API REQUESTS / RESPONSES
// ============================================================================

// Upload Sign
export interface UploadSignRequest {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface UploadSignResponse {
  documentId: string;
  storagePath: string;
  uploadUrl: string;
}

// Ingest
export interface IngestRequest {
  documentId: string;
}

export interface IngestResponse {
  success: boolean;
  documentId: string;
  chunksCreated: number;
  totalCharacters: number;
}

// Chat
export interface ChatRequest {
  message: string;
  mode: ChatMode;
  conversationId?: string;
  documentId?: string;
  topK?: number;
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
  conversationId: string;
  tokensUsed: number;
  mode: ChatMode;
}

export interface ChatError {
  error: string;
  noDocuments?: boolean;
}

// ============================================================================
// UI STATE
// ============================================================================

export interface UploadProgress {
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number; // 0-100
  fileName?: string;
  error?: string;
}

export interface ChatUIMessage {
  id: string;
  role: MessageRole;
  content: string;
  sources?: SourceChunk[];
  timestamp: Date;
  isLoading?: boolean;
}

// ============================================================================
// MIME TYPES
// ============================================================================

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export const MIME_TYPE_LABELS: Record<AllowedMimeType, string> = {
  'application/pdf': 'PDF',
  'text/plain': 'Texte',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/msword': 'DOC',
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ============================================================================
// HELPERS
// ============================================================================

export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

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
    processing: 'Traitement en cours',
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
