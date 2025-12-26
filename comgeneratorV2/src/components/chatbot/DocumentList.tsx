// src/components/chatbot/DocumentList.tsx
import React, { useState, useEffect } from 'react';
import { 
  FileText, Trash2, RefreshCw, AlertCircle, CheckCircle2, 
  Clock, Loader2, Globe, User, Lock
} from 'lucide-react';
import type { RagDocument } from '../../lib/rag.types';
import { formatFileSize, getStatusLabel, getStatusColor } from '../../lib/rag.types';
import { deleteDocument, checkIsAdmin } from '../../lib/ragApi';

interface DocumentListProps {
  documents: RagDocument[];
  onRefresh: () => void;
  isLoading?: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({ documents, onRefresh, isLoading = false }) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Vérifier si l'utilisateur est admin
  useEffect(() => {
    checkIsAdmin().then(setIsAdmin);
  }, []);

  const globalDocs = documents.filter(d => d.scope === 'global');
  const userDocs = documents.filter(d => d.scope === 'user');

  const handleDelete = async (doc: RagDocument) => {
    // Bloquer si document global et pas admin
    if (doc.scope === 'global' && !isAdmin) {
      alert('Les documents PROFASSIST ne peuvent pas être supprimés.');
      return;
    }

    const confirmMessage = doc.scope === 'global'
      ? `⚠️ ATTENTION: Supprimer le document officiel "${doc.title}" ?\n\nCe document est accessible à TOUS les utilisateurs.`
      : `Supprimer "${doc.title}" ?`;

    if (!confirm(confirmMessage)) return;

    try {
      setDeletingId(doc.id);
      await deleteDocument(doc.id);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusIcon = (status: RagDocument['status']) => {
    switch (status) {
      case 'uploaded': return <Clock className="w-4 h-4" />;
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'ready': return <CheckCircle2 className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Chargement...</span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Aucun document</p>
      </div>
    );
  }

  const DocumentItem: React.FC<{ doc: RagDocument }> = ({ doc }) => {
    const isGlobal = doc.scope === 'global';
    const canDelete = isGlobal ? isAdmin : true;
    
    return (
      <div
        className={`flex items-center p-2 rounded-lg border ${
          isGlobal 
            ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' 
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex-shrink-0 mr-3">
          <div className={`w-8 h-8 rounded flex items-center justify-center ${
            isGlobal 
              ? 'bg-purple-100 dark:bg-purple-900/50' 
              : 'bg-blue-100 dark:bg-blue-900/30'
          }`}>
            {isGlobal ? (
              <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            ) : (
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {doc.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
            {doc.chunk_count > 0 && <span>• {doc.chunk_count} sections</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
            {getStatusIcon(doc.status)}
            {getStatusLabel(doc.status)}
          </span>

          {canDelete ? (
            <button
              onClick={() => handleDelete(doc)}
              disabled={deletingId === doc.id}
              className={`p-1 rounded disabled:opacity-50 ${
                isGlobal
                  ? 'text-purple-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
              }`}
              title={isGlobal ? "Supprimer (Admin)" : "Supprimer"}
            >
              {deletingId === doc.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div 
              className="p-1 text-gray-300 dark:text-gray-600"
              title="Document officiel (non supprimable)"
            >
              <Lock className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {globalDocs.length > 0 && (
            <span className="text-purple-600 dark:text-purple-400">
              {globalDocs.length} officiel{globalDocs.length > 1 ? 's' : ''}
            </span>
          )}
          {globalDocs.length > 0 && userDocs.length > 0 && ' • '}
          {userDocs.length > 0 && (
            <span>{userDocs.length} perso{userDocs.length > 1 ? 's' : ''}</span>
          )}
        </span>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

            <div className="space-y-4 max-h-80 overflow-y-auto">
        {/* Mes documents - EN PREMIER */}
        {userDocs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-blue-500" />
              <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                Mes documents
              </h4>
            </div>
            <div className="space-y-2">
              {userDocs.map((doc) => (
                <DocumentItem key={doc.id} doc={doc} />
              ))}
            </div>
          </div>
        )}

        {/* Corpus ProfAssist - EN SECOND */}
        {globalDocs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-purple-500" />
              <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                Corpus ProfAssist
              </h4>
              {isAdmin && (
                <span className="text-xs text-purple-400">(admin: suppression possible)</span>
              )}
            </div>
            <div className="space-y-2">
              {globalDocs.map((doc) => (
                <DocumentItem key={doc.id} doc={doc} />
              ))}
            </div>
          </div>
        )}

        {globalDocs.length > 0 && userDocs.length === 0 && (
          <div className="text-center py-4 border-t border-gray-200 dark:border-gray-700">
            <User className="w-6 h-6 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ajoutez vos propres documents pour personnaliser votre chatbot
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default DocumentList;


