// src/components/chatbot/DocumentUploader.tsx
// Upload de documents avec option admin pour documents globaux

import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle2, Globe, User } from 'lucide-react';
import { uploadAndIngestDocument, uploadAndIngestGlobalDocument } from '../../lib/ragApi';
import { formatFileSize, MAX_FILE_SIZE } from '../../lib/rag.types';
import { isPDF, convertPDFToTextFile } from '../../lib/pdfExtractor';
import { supabase } from '../../lib/supabase';

interface DocumentUploaderProps {
  onUploadComplete: (documentId: string, chunksCreated: number) => void;
  onError?: (error: string) => void;
}

type UploadStatus = 'idle' | 'converting' | 'uploading' | 'processing' | 'complete' | 'error';
type UploadScope = 'user' | 'global';

const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onUploadComplete,
  onError,
}) => {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploadScope, setUploadScope] = useState<UploadScope>('user');

  // Vérifier si l'utilisateur est admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Vérifier via la liste ADMIN_USER_IDS (côté client on ne peut pas accéder aux env vars du serveur)
        // On fait une requête test pour voir si l'utilisateur peut uploader en global
        // Alternative: stocker is_admin dans profiles et le vérifier ici
        
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();

        // Si la colonne is_admin existe et est true
        if (profile?.is_admin === true) {
          setIsAdmin(true);
          return;
        }

        // Sinon, on essaie de détecter via les metadata ou email
        // Pour l'instant, on va utiliser une liste côté client (à adapter)
        const adminEmails = import.meta.env.VITE_ADMIN_EMAILS?.split(',') || [];
        if (user.email && adminEmails.includes(user.email.trim())) {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
      }
    };

    checkAdmin();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);

    try {
      let fileToUpload = file;

      // Si c'est un PDF, extraire le texte côté client
      if (isPDF(file)) {
        setStatus('converting');
        setProgress(10);
        console.log('Converting PDF to text with pdf.js...');
        
        try {
          fileToUpload = await convertPDFToTextFile(file);
          console.log(`PDF converted successfully: ${fileToUpload.size} bytes`);
          setProgress(30);
        } catch (pdfError) {
          throw new Error(
            pdfError instanceof Error 
              ? pdfError.message 
              : 'Erreur lors de la conversion du PDF.'
          );
        }
      } else {
        const allowedTypes = [
          'text/plain',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        
        if (!allowedTypes.includes(file.type)) {
          throw new Error('Type de fichier non supporté. Utilisez PDF, DOCX ou TXT.');
        }
      }

      if (fileToUpload.size > MAX_FILE_SIZE) {
        throw new Error(`Fichier trop volumineux. Maximum: ${formatFileSize(MAX_FILE_SIZE)}`);
      }

      if (fileToUpload.size === 0) {
        throw new Error('Le fichier est vide.');
      }

      setStatus('uploading');

      let result;
      
      if (uploadScope === 'global' && isAdmin) {
        // Upload global (admin)
        result = await uploadAndIngestGlobalDocument(
          fileToUpload,
          undefined, // Pas besoin de secret, on utilise ADMIN_USER_IDS
          (statusText, progressValue) => {
            if (statusText.includes('Upload')) setStatus('uploading');
            else if (statusText.includes('Traitement') || statusText.includes('Indexation')) setStatus('processing');
            setProgress(30 + progressValue * 0.7);
          }
        );
      } else {
        // Upload utilisateur normal
        result = await uploadAndIngestDocument(
          fileToUpload,
          (statusText, progressValue) => {
            if (statusText.includes('Upload')) setStatus('uploading');
            else if (statusText.includes('Traitement')) setStatus('processing');
            setProgress(30 + progressValue * 0.7);
          }
        );
      }

      setStatus('complete');
      setProgress(100);
      onUploadComplete(result.documentId, result.chunksCreated);

      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
        setFileName(null);
      }, 2000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      setStatus('error');
      onError?.(errorMessage);
    }
  }, [onUploadComplete, onError, uploadScope, isAdmin]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const getStatusMessage = () => {
    switch (status) {
      case 'converting': return 'Conversion du PDF...';
      case 'uploading': return 'Upload en cours...';
      case 'processing': return uploadScope === 'global' ? 'Indexation globale...' : 'Traitement du document...';
      case 'complete': return 'Terminé !';
      case 'error': return 'Erreur';
      default: return null;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'converting':
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />;
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const isProcessing = ['converting', 'uploading', 'processing'].includes(status);

  return (
    <div className="w-full space-y-3">
      {/* Toggle Admin (visible uniquement pour les admins) */}
      {isAdmin && (
        <div className="flex items-center justify-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <button
            onClick={() => setUploadScope('user')}
            disabled={isProcessing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              uploadScope === 'user'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <User className="w-4 h-4" />
            Perso
          </button>
          <button
            onClick={() => setUploadScope('global')}
            disabled={isProcessing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              uploadScope === 'global'
                ? 'bg-purple-500 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Globe className="w-4 h-4" />
            ProfAssist
          </button>
        </div>
      )}

      {/* Zone de drop */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
            : uploadScope === 'global'
              ? 'border-purple-300 dark:border-purple-600 hover:border-purple-400 dark:hover:border-purple-500 bg-purple-50/50 dark:bg-purple-900/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
          }
          ${isProcessing ? 'pointer-events-none opacity-75' : 'cursor-pointer'}
        `}
      >
        <input
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={handleInputChange}
          disabled={isProcessing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        <div className="flex flex-col items-center gap-2">
          {status === 'idle' ? (
            <>
              {uploadScope === 'global' ? (
                <Globe className="w-8 h-8 text-purple-400" />
              ) : (
                <Upload className="w-8 h-8 text-gray-400" />
              )}
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className={uploadScope === 'global' ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400'}>
                  Cliquez
                </span> ou glissez-déposez
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PDF, DOCX, TXT (max 10 MB)
              </p>
              {uploadScope === 'global' && (
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">
                  📚 Document officiel (accessible à tous)
                </p>
              )}
            </>
          ) : (
            <>
              {getStatusIcon()}
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {getStatusMessage()}
              </p>
              {fileName && status !== 'error' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-full">
                  {fileName}
                </p>
              )}
              {isProcessing && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      uploadScope === 'global' ? 'bg-purple-600' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {status === 'error' && error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;


