// src/components/chatbot/DocumentList.tsx
// Liste des documents uploadés avec statut et actions

import React, { useState } from 'react';
import {
  FileText,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { RagDocument } from '../../lib/rag.types';
import {
  formatFileSize,
  getStatusLabel,
  getStatusColor,
  MIME_TYPE_LABELS,
} from '../../lib/rag.types';
import type { AllowedMimeType } from '../../lib/rag.types';
import { deleteDocument, ingestDocument } from '../../lib/ragApi';

interface DocumentListProps {
  documents: RagDocument[];
  onRefresh: () => void;
  isLoading?: boolean;
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onRefresh,
  isLoading = false,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDelete = async (doc: RagDocument) => {
    if (!confirm(`Supprimer le document "${doc.title}" ?`)) {
      return;
    }

    try {
      setDeletingId(doc.id);
      await deleteDocument(doc.id);
      onRefresh();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReprocess = async (doc: RagDocument) => {
    try {
      setReprocessingId(doc.id);
      await ingestDocument({ documentId: doc.id });
      onRefresh();
    } catch (error) {
      console.error('Reprocess error:', error);
      alert('Erreur lors du retraitement');
    } finally {
      setReprocessingId(null);
    }
  };

  const getStatusIcon = (status: RagDocument['status']) => {
    switch (status) {
      case 'uploaded':
        return <Clock className="w-4 h-4" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'ready':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getMimeTypeLabel = (mimeType: string): string => {
    return MIME_TYPE_LABELS[mimeType as AllowedMimeType] || 'Fichier';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">
          Chargement des documents...
        </span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Aucun document uploadé
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Uploadez des documents pour commencer à utiliser le chatbot
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header avec bouton refresh */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {documents.length} document{documents.length > 1 ? 's' : ''}
        </h3>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Liste des documents */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Ligne principale */}
            <div
              className="flex items-center p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
              onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
            >
              {/* Icône fichier */}
              <div className="flex-shrink-0 mr-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>

              {/* Infos du document */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {doc.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getMimeTypeLabel(doc.mime_type)}
                  </span>
                  {doc.file_size && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(doc.file_size)}
                      </span>
                    </>
                  )}
                  {doc.chunk_count > 0 && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {doc.chunk_count} section{doc.chunk_count > 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Badge statut */}
              <div className="flex-shrink-0 ml-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}
                >
                  {getStatusIcon(doc.status)}
                  {getStatusLabel(doc.status)}
                </span>
              </div>

              {/* Chevron expand */}
              <div className="flex-shrink-0 ml-2 text-gray-400">
                {expandedId === doc.id ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>

            {/* Zone expandée */}
            {expandedId === doc.id && (
              <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700">
                {/* Message d'erreur si présent */}
                {doc.error_message && (
                  <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                    <strong>Erreur:</strong> {doc.error_message}
                  </div>
                )}

                {/* Métadonnées */}
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div>
                    <span className="font-medium">Créé le:</span>{' '}
                    {new Date(doc.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {doc.mime_type}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2">
                  {/* Retraiter (si erreur ou uploaded) */}
                  {(doc.status === 'error' || doc.status === 'uploaded') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReprocess(doc);
                      }}
                      disabled={reprocessingId === doc.id}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 disabled:opacity-50"
                    >
                      {reprocessingId === doc.id ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-1.5" />
                      )}
                      Retraiter
                    </button>
                  )}

                  {/* Supprimer */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc);
                    }}
                    disabled={deletingId === doc.id}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50 disabled:opacity-50"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-1.5" />
                    )}
                    Supprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentList;
