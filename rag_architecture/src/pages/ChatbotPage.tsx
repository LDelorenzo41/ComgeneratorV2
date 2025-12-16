// src/pages/ChatbotPage.tsx
// Page principale du chatbot RAG

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  FileText,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import DocumentUploader from '../components/chatbot/DocumentUploader';
import DocumentList from '../components/chatbot/DocumentList';
import ChatInterface from '../components/chatbot/ChatInterface';
import { getDocuments, getRagStats } from '../lib/ragApi';
import type { RagDocument } from '../lib/rag.types';

type TabType = 'chat' | 'documents';

const ChatbotPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // États
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    readyDocuments: 0,
    totalChunks: 0,
    totalConversations: 0,
  });

  // Redirection si non connecté
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Charger les documents
  const loadDocuments = useCallback(async () => {
    try {
      setIsLoadingDocs(true);
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  // Charger les stats
  const loadStats = useCallback(async () => {
    try {
      const statsData = await getRagStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    loadDocuments();
    loadStats();
  }, [loadDocuments, loadStats]);

  // Gérer l'upload terminé
  const handleUploadComplete = useCallback(
    (documentId: string, chunksCreated: number) => {
      loadDocuments();
      loadStats();
    },
    [loadDocuments, loadStats]
  );

  // Basculer vers l'onglet documents quand le chat a besoin de documents
  const handleNeedDocuments = useCallback(() => {
    setActiveTab('documents');
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header />

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-80' : 'w-0'
          } flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 overflow-hidden`}
        >
          <div className="h-full flex flex-col w-80">
            {/* En-tête sidebar */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Mon Chatbot
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Interrogez vos documents
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Documents</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {stats.readyDocuments}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Sections</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {stats.totalChunks}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'chat'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'documents'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Documents
                </button>
              </div>
            </div>

            {/* Contenu selon l'onglet */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'documents' ? (
                <div className="space-y-4">
                  <DocumentUploader
                    onUploadComplete={handleUploadComplete}
                    onError={(error) => console.error('Upload error:', error)}
                  />
                  <DocumentList
                    documents={documents}
                    onRefresh={loadDocuments}
                    isLoading={isLoadingDocs}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Liste rapide des documents */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Documents indexés
                    </h3>
                    {isLoadingDocs ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      </div>
                    ) : documents.filter((d) => d.status === 'ready').length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Aucun document
                        </p>
                        <button
                          onClick={() => setActiveTab('documents')}
                          className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Uploader des documents
                        </button>
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {documents
                          .filter((d) => d.status === 'ready')
                          .slice(0, 5)
                          .map((doc) => (
                            <li
                              key={doc.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="truncate">{doc.title}</span>
                              <span className="text-xs text-gray-400">
                                ({doc.chunk_count})
                              </span>
                            </li>
                          ))}
                        {documents.filter((d) => d.status === 'ready').length > 5 && (
                          <li>
                            <button
                              onClick={() => setActiveTab('documents')}
                              className="w-full text-left px-2 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              +{documents.filter((d) => d.status === 'ready').length - 5} autres...
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Bouton toggle sidebar */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex-shrink-0 w-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-600 transition-colors"
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {/* Zone principale de chat */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
          <ChatInterface
            documents={documents}
            onNeedDocuments={handleNeedDocuments}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ChatbotPage;
