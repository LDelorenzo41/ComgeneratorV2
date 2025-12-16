// src/components/chatbot/ChatInterface.tsx
// Interface de chat complète pour le RAG

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Trash2, Settings, BookOpen, Sparkles } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { sendChatMessage } from '../../lib/ragApi';
import type { ChatUIMessage, ChatMode, RagDocument, SourceChunk } from '../../lib/rag.types';

interface ChatInterfaceProps {
  documents: RagDocument[];
  onNeedDocuments?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  documents,
  onNeedDocuments,
}) => {
  // States
  const [messages, setMessages] = useState<ChatUIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('corpus_only');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Documents prêts uniquement
  const readyDocuments = documents.filter((d) => d.status === 'ready');
  const hasDocuments = readyDocuments.length > 0;

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Ajuster la hauteur du textarea
  const adjustTextareaHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + 'px';
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // Envoyer un message
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (!hasDocuments) {
      onNeedDocuments?.();
      return;
    }

    const userMessage: ChatUIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    // Ajouter le message utilisateur et un placeholder pour la réponse
    const loadingMessage: ChatUIMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        message: userMessage.content,
        mode,
        conversationId: conversationId || undefined,
        documentId: selectedDocumentId || undefined,
        topK: 5,
      });

      // Mettre à jour l'ID de conversation
      if (!conversationId) {
        setConversationId(response.conversationId);
      }

      // Remplacer le message loading par la vraie réponse
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: response.answer,
                sources: response.sources,
                isLoading: false,
              }
            : msg
        )
      );
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

      // Remplacer le message loading par un message d'erreur
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: `Désolé, une erreur s'est produite : ${errorMessage}`,
                isLoading: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Gérer la touche Entrée
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Effacer la conversation
  const handleClear = () => {
    if (messages.length === 0) return;
    if (confirm('Effacer la conversation ?')) {
      setMessages([]);
      setConversationId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header avec options */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between">
          {/* Sélecteur de mode */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('corpus_only')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'corpus_only'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Corpus uniquement
            </button>
            <button
              onClick={() => setMode('corpus_plus_ai')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'corpus_plus_ai'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Corpus + IA
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings
                  ? 'bg-gray-100 dark:bg-gray-700'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              } text-gray-500 dark:text-gray-400`}
              title="Paramètres"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              disabled={messages.length === 0}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Effacer la conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panneau de settings */}
        {showSettings && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filtrer par document
            </label>
            <select
              value={selectedDocumentId || ''}
              onChange={(e) => setSelectedDocumentId(e.target.value || null)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Tous les documents</option>
              {readyDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Info mode */}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {mode === 'corpus_only' ? (
            <>
              <BookOpen className="w-3 h-3 inline mr-1" />
              Réponses basées uniquement sur vos documents. Si l'information n'est pas
              trouvée, le chatbot vous l'indiquera.
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 inline mr-1" />
              Réponses basées sur vos documents avec compléments IA (clairement signalés).
            </>
          )}
        </p>
      </div>

      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-indigo-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Posez une question
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              {hasDocuments
                ? `Interrogez vos ${readyDocuments.length} document${readyDocuments.length > 1 ? 's' : ''} indexé${readyDocuments.length > 1 ? 's' : ''}.`
                : "Uploadez d'abord des documents pour commencer."}
            </p>

            {/* Suggestions de questions */}
            {hasDocuments && (
              <div className="mt-6 space-y-2">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  Exemples de questions
                </p>
                {[
                  'De quoi parlent mes documents ?',
                  'Fais un résumé du contenu principal',
                  'Quels sont les points clés ?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputValue(suggestion)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Zone de saisie */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-3">
        {!hasDocuments ? (
          <button
            onClick={onNeedDocuments}
            className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
          >
            Uploader des documents pour commencer
          </button>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              rows={1}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              style={{ minHeight: '44px', maxHeight: '150px' }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="flex-shrink-0 p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
