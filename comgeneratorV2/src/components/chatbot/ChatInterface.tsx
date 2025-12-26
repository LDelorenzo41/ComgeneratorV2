import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Trash2, BookOpen, Sparkles, Zap, Target, Info } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { sendChatMessage } from '../../lib/ragApi';
import type { ChatUIMessage, ChatMode, RagDocument } from '../../lib/rag.types';

type SearchMode = 'fast' | 'precise';

interface ChatInterfaceProps {
  documents: RagDocument[];
  onNeedDocuments?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ documents, onNeedDocuments }) => {
  const [messages, setMessages] = useState<ChatUIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('corpus_only');
  const [searchMode, setSearchMode] = useState<SearchMode>('precise');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSearchModeInfo, setShowSearchModeInfo] = useState(false);

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
        searchMode,  // 🆕 Passer le mode de recherche
        conversationId: conversationId || undefined,
        topK: searchMode === 'precise' ? 8 : 5,
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
        {/* Ligne 1 : Mode de réponse */}
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

        {/* Ligne 2 : Mode de recherche (Rapide / Précis) */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Recherche :</span>
              <button
                onClick={() => setSearchMode('fast')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  searchMode === 'fast'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-700'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
                title="Moins de tokens, réponses plus rapides"
              >
                <Zap className="w-3.5 h-3.5" />
                Rapide
              </button>
              <button
                onClick={() => setSearchMode('precise')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  searchMode === 'precise'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
                title="Plus de tokens, meilleure précision pour questions complexes"
              >
                <Target className="w-3.5 h-3.5" />
                Précis
              </button>
              <button
                onClick={() => setShowSearchModeInfo(!showSearchModeInfo)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {searchMode === 'fast' ? '~1000-2000' : '~3000-5000'} tokens/question
            </span>
          </div>
          
          {/* Info box pour le mode de recherche */}
          {showSearchModeInfo && (
            <div className="mt-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs space-y-1.5">
              <div className="flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-green-700 dark:text-green-400">Rapide</span>
                  <span className="text-gray-600 dark:text-gray-300"> - Recherche directe. Idéal pour questions simples et économiser vos tokens.</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Target className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-amber-700 dark:text-amber-400">Précis</span>
                  <span className="text-gray-600 dark:text-gray-300"> - Recherche approfondie avec reformulation et reclassement. Recommandé pour questions complexes ou comparatives.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Posez votre question
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Je cherche dans vos documents et les programmes officiels pour vous répondre.
            </p>
            {!hasDocuments && (
              <button
                onClick={onNeedDocuments}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Ajouter des documents
              </button>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              disabled={isLoading || !hasDocuments}
              rows={1}
              className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || !hasDocuments}
            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
export default ChatInterface;

