// src/components/chatbot/ChatbotFloatingButton.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bot, X, Loader2 } from 'lucide-react';
import ChatInterface from './ChatInterface';
import { getDocuments } from '../../lib/ragApi';
import type { RagDocument } from '../../lib/rag.types';

const STORAGE_KEY = 'chatbot_floating_enabled';
const TOGGLE_EVENT = 'chatbot-floating-toggle';

// ============================================
// Composant Switch (à utiliser dans ChatbotPage)
// ============================================
export const ChatbotFloatingSwitch: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return false;
  });

  const handleToggle = () => {
    const newValue = !isEnabled;
    setIsEnabled(newValue);
    localStorage.setItem(STORAGE_KEY, newValue.toString());
    window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, { detail: newValue }));
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        <Bot className="w-5 h-5 text-indigo-500" />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Bouton d'accès rapide
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Afficher le chatbot sur toutes les pages
          </p>
        </div>
      </div>
      <button
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isEnabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};

// ============================================
// Modal de chat (CORRIGÉ - charge les documents)
// ============================================
const ChatModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Charger les documents du user à l'ouverture
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setIsLoading(true);
        const docs = await getDocuments();
        setDocuments(docs);
      } catch (error) {
        console.error('Error loading documents:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadDocuments();
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                Mon Chatbot
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isLoading ? 'Chargement...' : `${documents.filter(d => d.status === 'ready').length} document(s) indexé(s)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Contenu */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <ChatInterface 
              documents={documents} 
              onNeedDocuments={onClose} // Ferme le modal pour aller uploader
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Bouton flottant principal
// ============================================
export const ChatbotFloatingButton: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return false;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatbotPage, setIsChatbotPage] = useState(false);

  // Écouter les changements de route
  useEffect(() => {
    const checkRoute = () => {
      setIsChatbotPage(window.location.pathname === '/chatbot');
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  // Écouter l'événement de toggle
  useEffect(() => {
    const handleToggle = (event: CustomEvent<boolean>) => {
      setIsEnabled(event.detail);
    };
    window.addEventListener(TOGGLE_EVENT, handleToggle as EventListener);
    return () => {
      window.removeEventListener(TOGGLE_EVENT, handleToggle as EventListener);
    };
  }, []);

  return createPortal(
    <>
      {isEnabled && !isChatbotPage && (
        <>
          <button
  onClick={() => setIsModalOpen(true)}
  className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
  title="Ouvrir le chatbot"
>
  {/* Animation de pulsation */}
  <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-30" />
  
  {/* Icône robot */}
  <Bot className="w-6 h-6 group-hover:scale-110 transition-transform relative z-10" />
  
  {/* Badge vert avec icône document */}
  <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md border-2 border-white">
    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  </span>
</button>

          {isModalOpen && <ChatModal onClose={() => setIsModalOpen(false)} />}
        </>
      )}
    </>,
    document.body
  );
};

export default ChatbotFloatingButton;

