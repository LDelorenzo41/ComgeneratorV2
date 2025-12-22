import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Trash2, BookOpen, Sparkles } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { sendChatMessage } from '../../lib/ragApi';
import type { ChatUIMessage, ChatMode, RagDocument } from '../../lib/rag.types';

interface ChatInterfaceProps {
  documents: RagDocument[];
  onNeedDocuments?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ documents, onNeedDocuments }) => {
  const [messages, setMessages] = useState<ChatUIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('corpus_only');
  const [conversationId, setConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const readyDocuments = documents.filter((d) => d.status === 'ready');
  const hasDocuments = readyDocuments.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        topK: 5,
      });

      if (!conversationId) {
        setConversationId(response.conversationId);
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? { ...msg, content: response.answer, sources: response.sources, isLoading: false }
            : msg
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? { ...msg, content: `Erreur : ${errorMessage}`, isLoading: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (messages.length === 0) return;
    if (confirm('Effacer la conversation ?')) {
      setMessages([]);
      setConversationId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('corpus_only')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'corpus_only'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Corpus seul
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

          <button
            onClick={handleClear}
            disabled={messages.length === 0}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-50"
            title="Effacer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {mode === 'corpus_only'
            ? 'Réponses basées uniquement sur vos documents.'
            : 'Réponses basées sur vos documents + compléments IA signalés.'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Posez une question
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {hasDocuments
                ? `${readyDocuments.length} document${readyDocuments.length > 1 ? 's' : ''} indexé${readyDocuments.length > 1 ? 's' : ''}`
                : "Uploadez d'abord des documents"}
            </p>
          </div>
        ) : (
          messages.map((message) => <ChatMessage key={message.id} message={message} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-3">
        {!hasDocuments ? (
          <button
            onClick={onNeedDocuments}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
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
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="flex-shrink-0 p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
