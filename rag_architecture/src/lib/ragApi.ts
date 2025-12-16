// src/lib/ragApi.ts
// Service API pour le module RAG

import { supabase } from './supabase';
import type {
  RagDocument,
  RagConversation,
  RagMessage,
  UploadSignRequest,
  UploadSignResponse,
  IngestRequest,
  IngestResponse,
  ChatRequest,
  ChatResponse,
  ChatError,
} from './rag.types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

if (!SUPABASE_URL) {
  console.error('VITE_SUPABASE_URL is not defined');
}

// ============================================================================
// HELPERS
// ============================================================================

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Non authentifié');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Erreur ${response.status}`);
  }

  return data as T;
}

// ============================================================================
// DOCUMENTS
// ============================================================================

/**
 * Récupère la liste des documents de l'utilisateur
 */
export async function getDocuments(): Promise<RagDocument[]> {
  const { data, error } = await supabase
    .from('rag_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
    throw new Error('Erreur lors de la récupération des documents');
  }

  return data || [];
}

/**
 * Récupère un document par son ID
 */
export async function getDocument(documentId: string): Promise<RagDocument | null> {
  const { data, error } = await supabase
    .from('rag_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error('Erreur lors de la récupération du document');
  }

  return data;
}

/**
 * Supprime un document
 */
export async function deleteDocument(documentId: string): Promise<void> {
  // Récupérer le chemin du fichier
  const { data: doc } = await supabase
    .from('rag_documents')
    .select('storage_path')
    .eq('id', documentId)
    .single();

  if (doc?.storage_path) {
    // Supprimer le fichier du storage
    await supabase.storage.from('rag-documents').remove([doc.storage_path]);
  }

  // Supprimer le document (les chunks seront supprimés en cascade)
  const { error } = await supabase
    .from('rag_documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    throw new Error('Erreur lors de la suppression du document');
  }
}

// ============================================================================
// UPLOAD & INGEST
// ============================================================================

/**
 * Étape 1: Obtenir une URL signée pour l'upload
 */
export async function getUploadSignedUrl(
  request: UploadSignRequest
): Promise<UploadSignResponse> {
  return callEdgeFunction<UploadSignResponse>('rag-upload-sign', request);
}

/**
 * Étape 2: Uploader le fichier vers l'URL signée
 */
export async function uploadFileToStorage(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

/**
 * Étape 3: Lancer l'ingestion du document
 */
export async function ingestDocument(
  request: IngestRequest
): Promise<IngestResponse> {
  return callEdgeFunction<IngestResponse>('rag-ingest', request);
}

/**
 * Fonction combinée: Upload + Ingest
 */
export async function uploadAndIngestDocument(
  file: File,
  onProgress?: (status: string, progress: number) => void
): Promise<{ documentId: string; chunksCreated: number }> {
  try {
    // Étape 1: Obtenir l'URL signée
    onProgress?.('Préparation...', 0);

    const signResponse = await getUploadSignedUrl({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });

    // Étape 2: Uploader le fichier
    onProgress?.('Upload en cours...', 10);

    await uploadFileToStorage(
      signResponse.uploadUrl,
      file,
      (progress) => onProgress?.('Upload en cours...', 10 + progress * 0.4)
    );

    // Étape 3: Lancer l'ingestion
    onProgress?.('Traitement du document...', 50);

    const ingestResponse = await ingestDocument({
      documentId: signResponse.documentId,
    });

    onProgress?.('Terminé', 100);

    return {
      documentId: ingestResponse.documentId,
      chunksCreated: ingestResponse.chunksCreated,
    };

  } catch (error) {
    console.error('Upload and ingest error:', error);
    throw error;
  }
}

// ============================================================================
// CHAT
// ============================================================================

/**
 * Envoie un message au chatbot RAG
 */
export async function sendChatMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const response = await callEdgeFunction<ChatResponse | ChatError>('rag-chat', request);

  // Vérifier si c'est une erreur
  if ('error' in response) {
    throw new Error(response.error);
  }

  return response;
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * Récupère les conversations de l'utilisateur
 */
export async function getConversations(): Promise<RagConversation[]> {
  const { data, error } = await supabase
    .from('rag_conversations')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error('Erreur lors de la récupération des conversations');
  }

  return data || [];
}

/**
 * Récupère une conversation avec ses messages
 */
export async function getConversationWithMessages(
  conversationId: string
): Promise<{ conversation: RagConversation; messages: RagMessage[] }> {
  // Récupérer la conversation
  const { data: conversation, error: convError } = await supabase
    .from('rag_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    throw new Error('Conversation non trouvée');
  }

  // Récupérer les messages
  const { data: messages, error: msgError } = await supabase
    .from('rag_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgError) {
    throw new Error('Erreur lors de la récupération des messages');
  }

  return {
    conversation,
    messages: messages || [],
  };
}

/**
 * Met à jour le titre d'une conversation
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from('rag_conversations')
    .update({ title })
    .eq('id', conversationId);

  if (error) {
    throw new Error('Erreur lors de la mise à jour du titre');
  }
}

/**
 * Supprime une conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('rag_conversations')
    .delete()
    .eq('id', conversationId);

  if (error) {
    throw new Error('Erreur lors de la suppression de la conversation');
  }
}

// ============================================================================
// STATS
// ============================================================================

/**
 * Récupère les statistiques RAG de l'utilisateur
 */
export async function getRagStats(): Promise<{
  totalDocuments: number;
  readyDocuments: number;
  totalChunks: number;
  totalConversations: number;
}> {
  const [
    { count: totalDocs },
    { count: readyDocs },
    { count: chunks },
    { count: conversations },
  ] = await Promise.all([
    supabase.from('rag_documents').select('*', { count: 'exact', head: true }),
    supabase.from('rag_documents').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    supabase.from('rag_chunks').select('*', { count: 'exact', head: true }),
    supabase.from('rag_conversations').select('*', { count: 'exact', head: true }),
  ]);

  return {
    totalDocuments: totalDocs || 0,
    readyDocuments: readyDocs || 0,
    totalChunks: chunks || 0,
    totalConversations: conversations || 0,
  };
}
