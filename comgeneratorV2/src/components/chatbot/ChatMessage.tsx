// src/components/chatbot/ChatMessage.tsx
import React, { useState, useMemo } from 'react';
import { User, Bot, ChevronDown, ChevronUp, FileText, BookmarkPlus, Sparkles, Info } from 'lucide-react';
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
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let inlineKey = 0;

      while (remaining.length > 0) {
        const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)\2(.*)$/s);
        if (boldMatch) {
          if (boldMatch[1]) {
            parts.push(<span key={`text-${inlineKey++}`}>{boldMatch[1]}</span>);
          }
          parts.push(<strong key={`bold-${inlineKey++}`}>{boldMatch[3]}</strong>);
          remaining = boldMatch[4];
          continue;
        }

        parts.push(<span key={`text-${inlineKey++}`}>{remaining}</span>);
        break;
      }

      return parts.length === 1 ? parts[0] : parts;
    };

    for (const line of lines) {
      const trimmedLine = line.trim();

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

      const olMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listItems.push(olMatch[1]);
        continue;
      }

      const ulMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
      if (ulMatch) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listItems.push(ulMatch[1]);
        continue;
      }

      if (trimmedLine === '') {
        flushList();
        elements.push(<div key={`br-${keyIndex++}`} className="h-2" />);
        continue;
      }

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

/**
 * Extrait les numéros de sources citées dans le texte
 */
function extractCitedSourceIndices(content: string): number[] {
  const regex = /\[Source\s*(\d+)\]/gi;
  const indices = new Set<number>();
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    indices.add(parseInt(match[1], 10));
  }
  
  return Array.from(indices).sort((a, b) => a - b);
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [showSources, setShowSources] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const isUser = message.role === 'user';
  const isLoading = message.isLoading;

  const canSave = !isUser && !isLoading && message.content && message.content.trim().length > 0;

  // Vérifier si l'IA a contribué (mode corpus_plus_ai ou ai_only)
  const aiContributed = message.mode === 'corpus_plus_ai' || message.mode === 'ai_only';
  const isAiOnly = message.mode === 'ai_only';

  // Filtrer les sources pour n'afficher que celles citées
  const citedSources = useMemo(() => {
    if (!message.sources || message.sources.length === 0 || !message.content) {
      return [];
    }
    
    const citedIndices = extractCitedSourceIndices(message.content);
    
    return citedIndices
      .filter(index => index >= 1 && index <= message.sources!.length)
      .map(index => ({
        ...message.sources![index - 1],
        displayIndex: index,
      }));
  }, [message.sources, message.content]);

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

          {/* Notice IA - Affichée si l'IA a contribué */}
          {!isUser && !isLoading && aiContributed && (
            <div className={`mt-2 flex items-start gap-2 p-2 rounded-lg text-xs ${
              isAiOnly 
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}>
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                {isAiOnly 
                  ? "Cette réponse est basée sur les connaissances générales de l'IA, sans document source."
                  : "L'IA a contribué à enrichir cette réponse. Certaines informations peuvent compléter les documents sources."
                }
              </span>
            </div>
          )}

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

          {/* Sources citées uniquement */}
          {!isUser && citedSources.length > 0 && (
            <div className="mt-2 w-full">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <FileText className="w-3 h-3" />
                {citedSources.length} source{citedSources.length > 1 ? 's' : ''} utilisée{citedSources.length > 1 ? 's' : ''}
                {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showSources && (
                <div className="mt-2 space-y-2">
                  {citedSources.map((source) => (
                    <SourceCard 
                      key={source.chunkId} 
                      source={source} 
                      displayIndex={source.displayIndex} 
                    />
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

// Composant Source simplifié - sans score
const SourceCard: React.FC<{ source: SourceChunk & { displayIndex?: number }; displayIndex: number }> = ({ source, displayIndex }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
      <div
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center justify-center">
            {displayIndex}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[220px]">
            {source.documentTitle}
          </span>
        </div>
        <div className="flex items-center gap-2">
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





