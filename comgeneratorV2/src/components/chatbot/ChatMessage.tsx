// src/components/chatbot/ChatMessage.tsx
import React, { useState } from 'react';
import { User, Bot, ChevronDown, ChevronUp, FileText, BookmarkPlus } from 'lucide-react';
import type { ChatUIMessage, SourceChunk } from '../../lib/rag.types';
import { SaveAnswerModal } from './SaveAnswerModal';

interface ChatMessageProps {
  message: ChatUIMessage;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [showSources, setShowSources] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const isUser = message.role === 'user';
  const isLoading = message.isLoading;

  const canSave = !isUser && !isLoading && message.content && message.content.trim().length > 0;

  return (
    <>
      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser
              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Contenu */}
        <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`rounded-2xl px-4 py-2 ${
              isUser
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-sm'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm opacity-70">Réflexion...</span>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            )}
          </div>

          {/* Actions pour les messages assistant */}
          {canSave && (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setShowSaveModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                title="Enregistrer cette réponse dans votre banque"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Mettre en banque
              </button>
            </div>
          )}

          {/* Sources */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-2 w-full">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <FileText className="w-3 h-3" />
                {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
                {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showSources && (
                <div className="mt-2 space-y-2">
                  {message.sources.map((source, index) => (
                    <SourceCard key={`${source.chunkId}-${index}`} source={source} index={index} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timestamp */}
          <span className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Modal de sauvegarde */}
      <SaveAnswerModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        initialContent={message.content}
      />
    </>
  );
};

// Composant Source - SCORE PLAFONNÉ À 100%
const SourceCard: React.FC<{ source: SourceChunk; index: number }> = ({ source, index }) => {
  const [expanded, setExpanded] = useState(false);
  // 🔴 CORRECTION : Plafonner le score à 100%
  const scorePercent = Math.min(Math.round(source.score * 100), 100);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
      <div
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
            {source.documentTitle}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              scorePercent >= 80
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : scorePercent >= 60
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {scorePercent}%
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700">
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
            {source.excerpt}
          </p>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;


