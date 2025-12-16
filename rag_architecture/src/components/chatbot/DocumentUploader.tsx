// src/components/chatbot/DocumentUploader.tsx
// Composant d'upload de documents pour le RAG

import React, { useCallback, useState } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MIME_TYPE_LABELS,
  formatFileSize,
  isAllowedMimeType,
} from '../../lib/rag.types';
import type { AllowedMimeType } from '../../lib/rag.types';
import { uploadAndIngestDocument } from '../../lib/ragApi';

interface DocumentUploaderProps {
  onUploadComplete?: (documentId: string, chunksCreated: number) => void;
  onError?: (error: string) => void;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  statusText: string;
  fileName?: string;
  error?: string;
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onUploadComplete,
  onError,
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    statusText: '',
  });
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    // Validation du type
    if (!isAllowedMimeType(file.type)) {
      const error = `Type de fichier non supporté: ${file.type}. Formats acceptés: PDF, DOCX, TXT`;
      setUploadState({
        status: 'error',
        progress: 0,
        statusText: error,
        error,
        fileName: file.name,
      });
      onError?.(error);
      return;
    }

    // Validation de la taille
    if (file.size > MAX_FILE_SIZE) {
      const error = `Fichier trop volumineux (${formatFileSize(file.size)}). Taille max: ${formatFileSize(MAX_FILE_SIZE)}`;
      setUploadState({
        status: 'error',
        progress: 0,
        statusText: error,
        error,
        fileName: file.name,
      });
      onError?.(error);
      return;
    }

    try {
      setUploadState({
        status: 'uploading',
        progress: 0,
        statusText: 'Préparation...',
        fileName: file.name,
      });

      const result = await uploadAndIngestDocument(file, (status, progress) => {
        setUploadState((prev) => ({
          ...prev,
          status: progress < 50 ? 'uploading' : 'processing',
          progress,
          statusText: status,
        }));
      });

      setUploadState({
        status: 'complete',
        progress: 100,
        statusText: `Document traité: ${result.chunksCreated} sections créées`,
        fileName: file.name,
      });

      onUploadComplete?.(result.documentId, result.chunksCreated);

      // Reset après 3 secondes
      setTimeout(() => {
        setUploadState({
          status: 'idle',
          progress: 0,
          statusText: '',
        });
      }, 3000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setUploadState({
        status: 'error',
        progress: 0,
        statusText: errorMessage,
        error: errorMessage,
        fileName: file.name,
      });
      onError?.(errorMessage);
    }
  }, [onUploadComplete, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input
    e.target.value = '';
  }, [handleFile]);

  const handleReset = useCallback(() => {
    setUploadState({
      status: 'idle',
      progress: 0,
      statusText: '',
    });
  }, []);

  const isProcessing = uploadState.status === 'uploading' || uploadState.status === 'processing';

  return (
    <div className="w-full">
      {/* Zone de drop */}
      <label
        className={`
          relative flex flex-col items-center justify-center w-full h-40
          border-2 border-dashed rounded-lg cursor-pointer
          transition-colors duration-200
          ${isDragOver
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
          }
          ${isProcessing ? 'pointer-events-none' : ''}
          ${uploadState.status === 'error' ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : ''}
          ${uploadState.status === 'complete' ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : ''}
          bg-gray-50 dark:bg-gray-800
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          className="hidden"
          accept={ALLOWED_MIME_TYPES.join(',')}
          onChange={handleFileSelect}
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {/* Icône selon l'état */}
          {uploadState.status === 'idle' && (
            <Upload className="w-10 h-10 mb-3 text-gray-400 dark:text-gray-500" />
          )}
          {isProcessing && (
            <Loader2 className="w-10 h-10 mb-3 text-indigo-500 animate-spin" />
          )}
          {uploadState.status === 'complete' && (
            <CheckCircle className="w-10 h-10 mb-3 text-green-500" />
          )}
          {uploadState.status === 'error' && (
            <AlertCircle className="w-10 h-10 mb-3 text-red-500" />
          )}

          {/* Texte selon l'état */}
          {uploadState.status === 'idle' && (
            <>
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Cliquez pour uploader</span> ou glissez-déposez
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PDF, DOCX, TXT (max {formatFileSize(MAX_FILE_SIZE)})
              </p>
            </>
          )}

          {isProcessing && (
            <>
              <p className="mb-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                {uploadState.statusText}
              </p>
              {uploadState.fileName && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {uploadState.fileName}
                </p>
              )}
            </>
          )}

          {uploadState.status === 'complete' && (
            <>
              <p className="mb-2 text-sm font-medium text-green-600 dark:text-green-400">
                {uploadState.statusText}
              </p>
              {uploadState.fileName && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {uploadState.fileName}
                </p>
              )}
            </>
          )}

          {uploadState.status === 'error' && (
            <>
              <p className="mb-2 text-sm font-medium text-red-600 dark:text-red-400">
                Erreur
              </p>
              <p className="text-xs text-red-500 dark:text-red-400 text-center px-4">
                {uploadState.error}
              </p>
            </>
          )}
        </div>

        {/* Barre de progression */}
        {isProcessing && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-b-lg overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
        )}

        {/* Bouton reset pour les erreurs */}
        {uploadState.status === 'error' && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleReset();
            }}
            className="absolute top-2 right-2 p-1 rounded-full bg-red-100 dark:bg-red-900/50 text-red-500 hover:bg-red-200 dark:hover:bg-red-900"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </label>

      {/* Formats acceptés */}
      <div className="mt-2 flex items-center justify-center gap-2">
        {Object.entries(MIME_TYPE_LABELS).map(([mime, label]) => (
          <span
            key={mime}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <File className="w-3 h-3 mr-1" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default DocumentUploader;
