// src/components/chatbot/ChatMessage.tsx
import React, { useState } from 'react';
import { User, Bot, ChevronDown, ChevronUp, FileText, BookmarkPlus } from 'lucide-react';
import type { ChatUIMessage, SourceChunk } from '../../lib/rag.types';
import { SaveAnswerModal } from './SaveAnswerModal';

interface ChatMessageProps {
  message: ChatUIMessage;
}

// Composant pour rendre le markdown en HTML
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const parseMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let keyIndex = 0;

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={`list-${keyIndex++}`} className={listType === 'ul' ? 'list-disc list-inside my-2 space-y-1' : 'list-decimal list-inside my-2 space-y-1'}>
            {listItems.map((item, i) => (
              <li key={i}>{parseInline(item)}</li>
            ))}
          </ListTag>
        );
        listItems = [];
        listType = null;
      }
    };

    const parseInline = (text: string): React.ReactNode => {
      // Parse bold (**text** ou __text__)
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let inlineKey = 0;

      while (remaining.length > 0) {
        // Bold: **text** ou __text__
        const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)\2(.*)$/s);
        if (boldMatch) {
          if (boldMatch[1]) {
            parts.push(parseItalic(boldMatch[1], inlineKey++));
          }
          parts.push(<strong key={`bold-${inlineKey++}`}>{parseItalic(boldMatch[3], inlineKey++)}</strong>);
          remaining = boldMatch[4];
          continue;
        }

        // Si pas de bold trouvé, parser italic sur le reste
        parts.push(parseItalic(remaining, inlineKey++));
        break;
      }

      return parts.length === 1 ? parts[0] : parts;
    };

    const parseItalic = (text: string, keyBase: number): React.ReactNode => {
      // Parse italic (*text* ou _text_) - attention à ne pas confondre avec **
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let italicKey = 0;

      while (remaining.length > 0) {
        // Italic: *text* ou _text_ (mais pas ** ou __)
        const italicMatch = remaining.match(/^(.*?)(?<!\*)(\*|_)(?!\1)(.+?)\2(?!\2)(.*)$/s);
        if (italicMatch) {
          if (italicMatch[1]) {
            parts.push(<span key={`text-${keyBase}-${italicKey++}`}>{italicMatch[1]}</span>);
          }
          parts.push(<em key={`italic-${keyBase}-${italicKey++}`}>{italicMatch[3]}</em>);
          remaining = italicMatch[4];
          continue;
        }

        parts.push(<span key={`text-${keyBase}-${italicKey++}`}>{remaining}</span>);
        break;
      }

      return parts.length === 1 ? parts[0] : parts;
    };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Headers
      const h4Match = trimmedLine.match(/^####\s+(.+)$/);
      if (h4Match) {
        flushList();
        elements.push(
          <h4 key={`h4-${keyIndex++}`} className="font-semibold text-sm mt-3 mb-1">
            {parseInline(h4Match[1])}
          </h4>
        );
        continue;
      }

      const h3Match = trimmedLine.match(/^###\s+(.+)$/);
      if (h3Match) {
        flushList();
        elements.push(
          <h3 key={`h3-${keyIndex++}`} className="font-bold text-base mt-3 mb-2">
            {parseInline(h3Match[1])}
          </h3>
        );
        continue;
      }

      const h2Match = trimmedLine.match(/^##\s+(.+)$/);
      if (h2Match) {
        flushList();
        elements.push(
          <h2 key={`h2-${keyIndex++}`} className="font-bold text-lg mt-3 mb-2">
            {parseInline(h2Match[1])}
          </h2>
        );
        continue;
      }

      const h1Match = trimmedLine.match(/^#\s+(.+)$/);
      if (h1Match) {
        flushList();
        elements.push(
          <h1 key={`h1-${keyIndex++}`} className="font-bold text-xl mt-3 mb-2">
            {parseInline(h1Match[1])}
          </h1>
        );
        continue;
      }

      // Ordered list (1. item)
      const olMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listItems.push(olMatch[1]);
        continue;
      }

      // Unordered list (- item ou * item)
      const ulMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
      if (ulMatch) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listItems.push(ulMatch[1]);
        continue;
      }

      // Ligne vide
      if (trimmedLine === '') {
        flushList();
        elements.push(<div key={`br-${keyIndex++}`} className="h-2" />);
        continue;
      }

      // Paragraphe normal
      flushList();
      elements.push(
        <p key={`p-${keyIndex++}`} className="my-1">
          {parseInline(trimmedLine)}
        </p>
      );
    }

    flushList();
    return elements;
  };

  return <div className="text-sm">{parseMarkdown(content)}</div>;
};

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
            ) : isUser ? (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MarkdownRenderer content={message.content} />
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



