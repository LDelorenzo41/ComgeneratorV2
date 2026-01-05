import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Loader2, Trash2, User, Building2, Sparkles, Info, 
  AlertTriangle, ChevronDown, ChevronUp, Filter, X, GraduationCap, BookOpen
} from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { sendChatMessage } from '../../lib/ragApi';
import type { ChatUIMessage, RagDocument, CorpusSelection, SearchFilters } from '../../lib/rag.types';
import { DEFAULT_CORPUS_SELECTION, AVAILABLE_LEVELS, AVAILABLE_SUBJECTS } from '../../lib/rag.types';

interface ChatInterfaceProps {
  documents: RagDocument[];
  onNeedDocuments?: () => void;
}

// Composant Switch réutilisable
const ToggleSwitch: React.FC<{
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  disabled?: boolean;
}> = ({ enabled, onChange, label, icon, colorClass, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!enabled)}
    disabled={disabled}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
      disabled 
        ? 'opacity-50 cursor-not-allowed' 
        : 'cursor-pointer'
    } ${
      enabled
        ? `${colorClass} ring-1`
        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
    }`}
  >
    <div className={`relative w-8 h-4 rounded-full transition-colors ${
      enabled ? 'bg-current opacity-30' : 'bg-gray-300 dark:bg-gray-600'
    }`}>
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
        enabled ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </div>
    {icon}
    <span className="hidden sm:inline">{label}</span>
  </button>
);

// Composant Tag cliquable pour les filtres
const FilterTag: React.FC<{
  value: string;
  selected: boolean;
  onClick: () => void;
}> = ({ value, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
      selected
        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
    }`}
  >
    {value}
    {selected && <X className="w-3 h-3 ml-1 inline" />}
  </button>
);

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ documents, onNeedDocuments }) => {
  const [messages, setMessages] = useState<ChatUIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [corpusSelection, setCorpusSelection] = useState<CorpusSelection>(DEFAULT_CORPUS_SELECTION);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const readyDocuments = documents.filter((d) => d.status === 'ready');
  const hasPersonalDocs = readyDocuments.some(d => d.scope === 'user');
  const hasProfAssistDocs = readyDocuments.some(d => d.scope === 'global');
  
  const hasActiveSource = corpusSelection.usePersonalCorpus || corpusSelection.useProfAssistCorpus || corpusSelection.useAI;
  const hasCorpusSelected = corpusSelection.usePersonalCorpus || corpusSelection.useProfAssistCorpus;
  
  const canSearch = (
    (corpusSelection.usePersonalCorpus && hasPersonalDocs) ||
    (corpusSelection.useProfAssistCorpus && hasProfAssistDocs) ||
    (corpusSelection.useAI && !hasCorpusSelected)
  );

  const activeFiltersCount = selectedLevels.length + selectedSubjects.length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) 
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  const clearFilters = () => {
    setSelectedLevels([]);
    setSelectedSubjects([]);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (!hasActiveSource) {
      return;
    }

    if (hasCorpusSelected && !canSearch) {
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
      const filters: SearchFilters = {};
      if (selectedLevels.length > 0) {
        filters.levels = selectedLevels;
      }
      if (selectedSubjects.length > 0) {
        filters.subjects = selectedSubjects;
      }

      const response = await sendChatMessage({
        message: userMessage.content,
        corpusSelection,
        conversationId: conversationId || undefined,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });

      if (!conversationId) {
        setConversationId(response.conversationId);
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? { 
                ...msg, 
                content: response.answer, 
                sources: response.sources, 
                isLoading: false,
                mode: response.mode,
              }
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

  const updateCorpusSelection = (key: keyof CorpusSelection, value: boolean) => {
    setCorpusSelection(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-3">
        {/* Switches de sélection des corpus */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Sources :</span>
            
            <ToggleSwitch
              enabled={corpusSelection.usePersonalCorpus}
              onChange={(v) => updateCorpusSelection('usePersonalCorpus', v)}
              label="Corpus perso"
              icon={<User className="w-4 h-4" />}
              colorClass="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 ring-blue-300 dark:ring-blue-700"
              disabled={!hasPersonalDocs}
            />
            
            <ToggleSwitch
              enabled={corpusSelection.useProfAssistCorpus}
              onChange={(v) => updateCorpusSelection('useProfAssistCorpus', v)}
              label="Corpus ProfAssist"
              icon={<Building2 className="w-4 h-4" />}
              colorClass="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 ring-purple-300 dark:ring-purple-700"
              disabled={!hasProfAssistDocs}
            />
            
            <ToggleSwitch
              enabled={corpusSelection.useAI}
              onChange={(v) => updateCorpusSelection('useAI', v)}
              label="IA"
              icon={<Sparkles className="w-4 h-4" />}
              colorClass="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 ring-amber-300 dark:ring-amber-700"
            />
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

        {/* Message d'explication contextuel */}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {!hasActiveSource ? (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Activez au moins une source pour poser une question.
            </span>
          ) : corpusSelection.useAI && !hasCorpusSelected ? (
            'Réponses basées uniquement sur les connaissances de l\'IA.'
          ) : corpusSelection.useAI ? (
            'Réponses basées sur les corpus sélectionnés + compléments IA si nécessaire.'
          ) : (
            'Réponses basées uniquement sur les corpus sélectionnés.'
          )}
        </p>

        {/* Message pour le Corpus ProfAssist en construction */}
        {corpusSelection.useProfAssistCorpus && (
          <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
            Corpus en cours de construction. Consultez la liste des documents actuellement disponibles.
          </p>
        )}

        {/* Filtres avancés */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtres avancés</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-full text-xs font-medium">
                {activeFiltersCount}
              </span>
            )}
            {showFilters ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showFilters && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Niveau(x)</span>
                  <span className="text-xs text-gray-400">(optionnel)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_LEVELS.map((level) => (
                    <FilterTag
                      key={level}
                      value={level}
                      selected={selectedLevels.includes(level)}
                      onClick={() => toggleLevel(level)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Discipline(s)</span>
                  <span className="text-xs text-gray-400">(optionnel)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_SUBJECTS.map((subject) => (
                    <FilterTag
                      key={subject}
                      value={subject}
                      selected={selectedSubjects.includes(subject)}
                      onClick={() => toggleSubject(subject)}
                    />
                  ))}
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Réinitialiser les filtres
                </button>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                Ces filtres aident à cibler la recherche. Le chatbot fonctionne parfaitement sans.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Posez votre question
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              {hasCorpusSelected 
                ? 'Je cherche dans les corpus sélectionnés pour vous répondre.'
                : corpusSelection.useAI 
                  ? 'Je répondrai avec mes connaissances générales.'
                  : 'Sélectionnez au moins une source ci-dessus.'}
            </p>
            {hasCorpusSelected && !canSearch && (
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
        {activeFiltersCount > 0 && (
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">Filtres :</span>
            {selectedLevels.map(level => (
              <span key={level} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-full text-xs">
                {level}
              </span>
            ))}
            {selectedSubjects.map(subject => (
              <span key={subject} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-full text-xs">
                {subject}
              </span>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasActiveSource ? "Posez votre question..." : "Activez une source..."}
              disabled={isLoading || !hasActiveSource}
              rows={1}
              className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '160px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || !hasActiveSource}
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






