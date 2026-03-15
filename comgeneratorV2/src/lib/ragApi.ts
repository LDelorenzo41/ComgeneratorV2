// src/lib/ragApi.ts
// Service API pour le module RAG Chatbot
// Avec support des documents globaux et utilisateur
// + Double quota bêta: stockage permanent + import mensuel

import { supabase } from './supabase';
import type { RagDocument, RagFolder, ChatResponse, CorpusSelection, SearchFilters } from './rag.types';
import { tokenUpdateEvent, TOKEN_UPDATED } from '../components/layout/Header';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ============================================================================
// CONSTANTES BETA
// ============================================================================

const BETA_STORAGE_LIMIT = 100000;        // 100k tokens max stockés
const BETA_MONTHLY_IMPORT_LIMIT = 100000; // 100k tokens/mois d'import

// ============================================================================
// TYPES
// ============================================================================

export type DocumentScope = 'global' | 'user';

export interface DocumentsResult {
  globalDocuments: RagDocument[];
  userDocuments: RagDocument[];
  totalGlobal: number;
  totalUser: number;
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
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Erreur ${response.status}`);
  }
  return data as T;
}

// ============================================================================
// BETA RESET CHECK
// ============================================================================

/**
 * Vérifie et réinitialise le quota mensuel si nécessaire
 * Appelé automatiquement avant de récupérer les stats
 */
async function checkAndResetBetaQuota(): Promise<void> {
  try {
    await callEdgeFunction<{ wasReset: boolean }>('rag-beta-check', {});
  } catch (error) {
    // Silencieux en cas d'erreur - on continue quand même
    console.warn('Beta check failed (non-blocking):', error);
  }
}

// ============================================================================
// DOCUMENTS - LECTURE
// ============================================================================

/**
 * Récupère tous les documents (globaux + utilisateur)
 */
export async function getAllDocuments(): Promise<DocumentsResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { globalDocuments: [], userDocuments: [], totalGlobal: 0, totalUser: 0 };
  }

  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error('Erreur lors de la récupération des documents');

  const allDocs: RagDocument[] = data || [];
  
  const globalDocuments = allDocs.filter(d => d.scope === 'global');
  const userDocuments = allDocs.filter(d => d.scope === 'user' && d.user_id === user.id);

  return {
    globalDocuments,
    userDocuments,
    totalGlobal: globalDocuments.length,
    totalUser: userDocuments.length,
  };
}

/**
 * Récupère uniquement les documents de l'utilisateur
 */
export async function getUserDocuments(): Promise<RagDocument[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .select('*')
    .eq('user_id', user.id)
    .eq('scope', 'user')
    .order('created_at', { ascending: false });

  if (error) throw new Error('Erreur lors de la récupération des documents');
  return data || [];
}

/**
 * Récupère uniquement les documents globaux
 */
export async function getGlobalDocuments(): Promise<RagDocument[]> {
  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .select('*')
    .eq('scope', 'global')
    .eq('status', 'ready')
    .order('title', { ascending: true });

  if (error) throw new Error('Erreur lors de la récupération des documents globaux');
  return data || [];
}

/**
 * Compatibilité avec l'ancien code - retourne tous les documents accessibles
 */
export async function getDocuments(): Promise<RagDocument[]> {
  const result = await getAllDocuments();
  return [...result.globalDocuments, ...result.userDocuments];
}

// ============================================================================
// DOCUMENTS - SUPPRESSION
// ============================================================================

/**
 * Supprime un document (user ou global si admin)
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Non authentifié');
  }

  const { data: doc } = await (supabase as any)
    .from('rag_documents')
    .select('storage_path, scope, user_id')
    .eq('id', documentId)
    .single();

  if (!doc) {
    throw new Error('Document non trouvé');
  }

  if (doc.scope === 'global') {
    const isAdmin = await checkIsAdmin(user.id);
    if (!isAdmin) {
      throw new Error('Les documents PROFASSIST ne peuvent pas être supprimés');
    }
  } else {
    if (doc.user_id !== user.id) {
      throw new Error('Non autorisé');
    }
  }

  if (doc.storage_path) {
    await supabase.storage.from('rag-documents').remove([doc.storage_path]);
  }

  const { error } = await (supabase as any).from('rag_documents').delete().eq('id', documentId);
  if (error) throw new Error('Erreur lors de la suppression');
}

/**
 * Vérifie si l'utilisateur courant est admin
 */
export async function checkIsAdmin(userId?: string): Promise<boolean> {
  try {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      uid = user.id;
    }

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('is_admin')
      .eq('user_id', uid)
      .single();

    if (profile?.is_admin === true) {
      return true;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const adminEmails = import.meta.env.VITE_ADMIN_EMAILS?.split(',').map((e: string) => e.trim()) || [];
    if (user?.email && adminEmails.includes(user.email)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}


// ============================================================================
// UPLOAD & INGEST
// ============================================================================

interface UploadSignResponse {
  documentId: string;
  storagePath: string;
  uploadUrl: string;
}

interface IngestResponse {
  chunksCreated: number;
  betaTokensUsed?: number;
  scope: DocumentScope;
}

/**
 * Upload et ingestion d'un document utilisateur
 */
export async function uploadAndIngestDocument(
  file: File,
  onProgress?: (status: string, progress: number) => void
): Promise<{ documentId: string; chunksCreated: number; betaTokensUsed?: number }> {
  onProgress?.('Préparation...', 0);

  const signResponse = await callEdgeFunction<UploadSignResponse>('rag-upload-sign', {
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  });

  onProgress?.('Upload en cours...', 20);

  const uploadResponse = await fetch(signResponse.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('Erreur lors de l\'upload');
  }

  onProgress?.('Traitement du document...', 50);

  const ingestResponse = await callEdgeFunction<IngestResponse>('rag-ingest', {
    documentId: signResponse.documentId,
    scope: 'user',
  });

  onProgress?.('Terminé', 100);

  return {
    documentId: signResponse.documentId,
    chunksCreated: ingestResponse.chunksCreated,
    betaTokensUsed: ingestResponse.betaTokensUsed,
  };
}

/**
 * Upload et ingestion d'un document GLOBAL (admin uniquement)
 */
export async function uploadAndIngestGlobalDocument(
  file: File,
  adminSecret?: string,
  onProgress?: (status: string, progress: number) => void
): Promise<{ documentId: string; chunksCreated: number }> {
  onProgress?.('Préparation document global...', 0);

  const extraHeaders: Record<string, string> = {};
  if (adminSecret) {
    extraHeaders['x-admin-secret'] = adminSecret;
  }

  const signResponse = await callEdgeFunction<UploadSignResponse>(
    'rag-upload-sign', 
    {
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      scope: 'global',
    },
    extraHeaders
  );

  onProgress?.('Upload en cours...', 20);

  const uploadResponse = await fetch(signResponse.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('Erreur lors de l\'upload');
  }

  onProgress?.('Indexation du document global...', 50);

  const ingestResponse = await callEdgeFunction<IngestResponse>(
    'rag-ingest', 
    {
      documentId: signResponse.documentId,
      scope: 'global',
    },
    extraHeaders
  );

  onProgress?.('Document global prêt', 100);

  return {
    documentId: signResponse.documentId,
    chunksCreated: ingestResponse.chunksCreated,
  };
}

// ============================================================================
// CHAT
// ============================================================================

// 🆕 Interface mise à jour avec filtres optionnels
export async function sendChatMessage(request: {
  message: string;
  corpusSelection: CorpusSelection;
  searchMode?: 'fast' | 'precise';
  conversationId?: string;
  documentId?: string;
  topK?: number;
  // 🆕 Filtres optionnels
  filters?: SearchFilters;
}): Promise<ChatResponse> {
  // Construire le payload pour le backend
  const backendRequest: Record<string, unknown> = {
    message: request.message,
    mode: request.corpusSelection.useAI ? 'corpus_plus_ai' : 'corpus_only',
    usePersonalCorpus: request.corpusSelection.usePersonalCorpus,
    useProfAssistCorpus: request.corpusSelection.useProfAssistCorpus,
    useAI: request.corpusSelection.useAI,
    searchMode: request.searchMode,
    conversationId: request.conversationId,
    documentId: request.documentId,
    topK: request.topK,
  };

  // Ajouter les filtres uniquement s'ils sont définis et non vides
  if (request.filters?.levels && request.filters.levels.length > 0) {
    backendRequest.levels = request.filters.levels;
  }
  if (request.filters?.subjects && request.filters.subjects.length > 0) {
    backendRequest.subjects = request.filters.subjects;
  }
  // Ajouter les folderIds si définis
  if (request.corpusSelection.folderIds && request.corpusSelection.folderIds.length > 0) {
    backendRequest.folderIds = request.corpusSelection.folderIds;
  }

  const response = await callEdgeFunction<ChatResponse | { error: string }>('rag-chat', backendRequest);
  if ('error' in response) {
    throw new Error(response.error);
  }
  
  tokenUpdateEvent.dispatchEvent(new CustomEvent(TOKEN_UPDATED));
  
  return response;
}

// ============================================================================
// REANALYZE DOCUMENT (Admin only)
// ============================================================================

/**
 * Ré-analyse un document existant avec l'IA pour mettre à jour ses métadonnées
 */
export async function reanalyzeDocument(documentId: string): Promise<{ success: boolean }> {
  const response = await callEdgeFunction<{ success: boolean } | { error: string }>('rag-ingest', {
    reanalyze: true,
    documentId,
  });
  
  if ('error' in response) {
    throw new Error(response.error);
  }
  
  return response;
}

// ============================================================================
// STATS
// ============================================================================

export interface RagStats {
  totalDocuments: number;
  readyDocuments: number;
  totalChunks: number;
  globalDocuments: number;
  userDocuments: number;
}

export async function getRagStats(): Promise<RagStats> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const queries = [
    (supabase as any).from('rag_documents').select('*', { count: 'exact', head: true }),
    (supabase as any).from('rag_documents').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    (supabase as any).from('rag_chunks').select('*', { count: 'exact', head: true }),
    (supabase as any).from('rag_documents').select('*', { count: 'exact', head: true }).eq('scope', 'global').eq('status', 'ready'),
  ];

  if (user) {
    queries.push(
      (supabase as any).from('rag_documents').select('*', { count: 'exact', head: true }).eq('scope', 'user').eq('user_id', user.id).eq('status', 'ready')
    );
  }

  const results = await Promise.all(queries);

  return {
    totalDocuments: results[0].count || 0,
    readyDocuments: results[1].count || 0,
    totalChunks: results[2].count || 0,
    globalDocuments: results[3].count || 0,
    userDocuments: user ? (results[4]?.count || 0) : 0,
  };
}

// ============================================================================
// BETA USAGE - DOUBLE QUOTA (stockage + import mensuel)
// MODIFIÉ: appelle checkAndResetBetaQuota() avant de lire les stats
// ============================================================================

export interface BetaUsageStats {
  // Stockage permanent (documents actuellement stockés)
  storageTokensUsed: number;
  storageTokensLimit: number;
  storagePercentUsed: number;
  // Import mensuel (volume importé ce mois)
  monthlyTokensUsed: number;
  monthlyTokensLimit: number;
  monthlyPercentUsed: number;
  // Date de réinitialisation du quota mensuel
  resetDate: string | null;
}

/**
 * Récupère les statistiques d'utilisation bêta avec double quota:
 * - Stockage permanent: tokens actuellement stockés (max 100k)
 * - Import mensuel: tokens importés ce mois (max 100k/mois)
 * 
 * IMPORTANT: Vérifie et réinitialise automatiquement le quota mensuel si nécessaire
 */
export async function getBetaUsageStats(): Promise<BetaUsageStats> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return {
      storageTokensUsed: 0,
      storageTokensLimit: BETA_STORAGE_LIMIT,
      storagePercentUsed: 0,
      monthlyTokensUsed: 0,
      monthlyTokensLimit: BETA_MONTHLY_IMPORT_LIMIT,
      monthlyPercentUsed: 0,
      resetDate: null,
    };
  }

  // 🆕 AJOUT: Vérifier et réinitialiser le quota mensuel si nécessaire
  await checkAndResetBetaQuota();

  // 1. Calculer le stockage actuel (somme des tokens des chunks personnels)
  const { data: chunksData, error: chunksError } = await (supabase as any)
    .from('rag_chunks')
    .select('token_count')
    .eq('user_id', user.id)
    .eq('scope', 'user');

  if (chunksError) {
    console.warn('Error fetching chunks for storage calculation:', chunksError);
  }

  const storageTokensUsed = (chunksData || []).reduce(
    (sum: number, chunk: { token_count?: number }) => sum + (chunk.token_count || 0),
    0
  );

  // 2. Récupérer le quota mensuel d'import depuis le profil (APRÈS le reset éventuel)
  const { data: profile, error: profileError } = await (supabase as any)
    .from('profiles')
    .select('rag_beta_tokens_used, rag_beta_tokens_limit, rag_beta_reset_date')
    .eq('user_id', user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.warn('Error fetching profile for beta stats:', profileError);
  }

  const monthlyTokensUsed = profile?.rag_beta_tokens_used || 0;
  const monthlyTokensLimit = profile?.rag_beta_tokens_limit || BETA_MONTHLY_IMPORT_LIMIT;
  const resetDate = profile?.rag_beta_reset_date || null;

  // Calculer les pourcentages (plafonnés à 100%)
  const storagePercentUsed = Math.min(
    100,
    Math.round((storageTokensUsed / BETA_STORAGE_LIMIT) * 100)
  );
  
  const monthlyPercentUsed = Math.min(
    100,
    Math.round((monthlyTokensUsed / monthlyTokensLimit) * 100)
  );

  return {
    storageTokensUsed,
    storageTokensLimit: BETA_STORAGE_LIMIT,
    storagePercentUsed,
    monthlyTokensUsed,
    monthlyTokensLimit,
    monthlyPercentUsed,
    resetDate,
  };
}

// ============================================================================
// FOLDERS (Dossiers personnels)
// ============================================================================

/**
 * Récupère tous les dossiers de l'utilisateur
 */
export async function getFolders(): Promise<RagFolder[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from('rag_folders')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  if (error) throw new Error('Erreur lors de la récupération des dossiers');
  return data || [];
}

/**
 * Crée un nouveau dossier
 */
export async function createFolder(name: string): Promise<RagFolder> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await (supabase as any)
    .from('rag_folders')
    .insert({ user_id: user.id, name: name.trim() })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Un dossier avec ce nom existe déjà');
    }
    throw new Error('Erreur lors de la création du dossier');
  }
  return data;
}

/**
 * Renomme un dossier
 */
export async function renameFolder(folderId: string, name: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('rag_folders')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', folderId);

  if (error) {
    if (error.code === '23505') {
      throw new Error('Un dossier avec ce nom existe déjà');
    }
    throw new Error('Erreur lors du renommage du dossier');
  }
}

/**
 * Supprime un dossier (les documents deviennent "non classés")
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('rag_folders')
    .delete()
    .eq('id', folderId);

  if (error) throw new Error('Erreur lors de la suppression du dossier');
}

/**
 * Déplace un document dans un dossier (ou hors dossier si folderId = null)
 */
export async function moveDocumentToFolder(documentId: string, folderId: string | null): Promise<void> {
  const { error } = await (supabase as any)
    .from('rag_documents')
    .update({ folder_id: folderId })
    .eq('id', documentId);

  if (error) throw new Error('Erreur lors du déplacement du document');
}




