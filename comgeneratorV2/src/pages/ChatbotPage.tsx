// src/pages/ChatbotPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, FileText, MessageSquare, BarChart3, Loader2, Sparkles, Info, X, 
  BookOpen, Database, MessageCircle, Shield, Zap, Gift, Globe, User, HardDrive, Upload, Target, Search
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import useTokenBalance from '../hooks/useTokenBalance';
import DocumentUploader from '../components/chatbot/DocumentUploader';
import { DocumentList } from '../components/chatbot/DocumentList';
import { ChatInterface } from '../components/chatbot/ChatInterface';
import { getDocuments, getRagStats, getBetaUsageStats, BetaUsageStats, RagStats } from '../lib/ragApi';
import type { RagDocument } from '../lib/rag.types';
import { ChatbotFloatingSwitch } from '../components/chatbot/ChatbotFloatingButton';

type TabType = 'chat' | 'documents';

// Modal d'information sur le chatbot
const ChatbotInfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Mon Chatbot Personnel
              </h2>
              <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                Version Bêta
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Introduction */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-gray-700 dark:text-gray-300">
              Votre chatbot personnel vous permet d'interroger vos propres documents grâce à l'intelligence artificielle. 
              Uploadez vos fichiers et posez vos questions !
            </p>
          </div>

          {/* Corpus global vs personnel */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Deux types de documents
              </h3>
            </div>
            <div className="grid gap-3">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h4 className="font-semibold text-purple-700 dark:text-purple-400">
                    Corpus officiel
                  </h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Programmes officiels, textes réglementaires et ressources nationales. 
                  Ces documents sont <strong>inclus pour tous</strong> et ne comptent pas dans votre quota.
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-semibold text-blue-700 dark:text-blue-400">
                    Mes documents
                  </h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Vos progressions, projets pédagogiques et documents personnels. 
                  Ces documents sont <strong>privés</strong> et comptent dans votre quota bêta.
                </p>
              </div>
            </div>
          </div>

          {/* Comment ça marche */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Comment ça marche ?
              </h3>
            </div>
            <ol className="space-y-3 text-gray-600 dark:text-gray-300">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <span><strong>Uploadez vos documents</strong> (PDF, DOCX, TXT) dans l'onglet "Documents"</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <span><strong>Attendez le traitement</strong> (quelques secondes à quelques minutes selon la taille)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <span><strong>Posez vos questions</strong> - le chatbot cherche dans le corpus officiel ET vos documents</span>
              </li>
            </ol>
          </div>

          {/* Modes de chat */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Deux modes de réponse
              </h3>
            </div>
            <div className="grid gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-700 dark:text-green-400 mb-1">
                  🎯 Corpus seul
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Réponses strictement basées sur vos documents. Aucune information externe n'est ajoutée. 
                  Idéal pour des réponses précises et vérifiables.
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-1">
                  🧠 Corpus + IA
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  L'IA cite d'abord vos documents, puis complète avec ses connaissances générales 
                  (clairement identifiées). Idéal pour enrichir les informations.
                </p>
              </div>
            </div>
          </div>

          {/* 🆕 NOUVELLE SECTION : Modes de recherche */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-5 h-5 text-cyan-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Deux modes de recherche
              </h3>
            </div>
            <div className="grid gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h4 className="font-semibold text-green-700 dark:text-green-400">
                      Rapide
                    </h4>
                  </div>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded-full">
                    ~1000-2000 tokens
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Recherche directe dans vos documents sans traitement supplémentaire.
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Réponse rapide et économique</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Idéal pour les questions simples et directes</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Recommandé pour économiser vos tokens</span>
                  </li>
                </ul>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <h4 className="font-semibold text-amber-700 dark:text-amber-400">
                      Précis
                    </h4>
                  </div>
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
                    ~3000-5000 tokens
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Recherche approfondie avec techniques avancées d'IA pour de meilleurs résultats.
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    <span><strong>Reformulation automatique</strong> de votre question pour mieux chercher</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    <span><strong>Recherche hypothétique</strong> (HyDE) pour trouver des passages pertinents</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    <span><strong>Reclassement intelligent</strong> des résultats par pertinence</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    <span>Idéal pour les <strong>questions complexes</strong> ou <strong>comparatives</strong></span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 <strong>Conseil :</strong> Commencez en mode <strong>Rapide</strong>. Si la réponse n'est pas satisfaisante 
                ou pour des questions comme "Quelles différences entre X et Y ?", passez en mode <strong>Précis</strong>.
              </p>
            </div>
          </div>

          {/* Sources et scores de pertinence */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Sources et scores de pertinence
              </h3>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Chaque réponse affiche les <strong>sources</strong> utilisées avec un <strong>score de pertinence (%)</strong> :
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  <span><strong>70-100%</strong> : Très pertinent - l'information recherchée est probablement présente</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  <span><strong>50-70%</strong> : Moyennement pertinent - lien indirect avec votre question</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  <span><strong>&lt;50%</strong> : Peu pertinent - le sujet n'est peut-être pas dans vos documents</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Consommation de tokens - Mise à jour */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Consommation de tokens
              </h3>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Chaque question au chatbot consomme des tokens. Le coût dépend du <strong>mode de recherche</strong> choisi :
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">Rapide</span>
                  </div>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">~1000-2000</p>
                  <p className="text-xs text-gray-500">tokens/question</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Précis</span>
                  </div>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">~3000-5000</p>
                  <p className="text-xs text-gray-500">tokens/question</p>
                </div>
              </div>
              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  💡 <strong>Astuce :</strong> Utilisez le mode <strong>Rapide</strong> par défaut pour économiser vos tokens. 
                  Le mode "Corpus seul" consomme généralement moins que "Corpus + IA".
                </p>
              </div>
            </div>
          </div>

          {/* Offre Bêta - MISE À JOUR */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-pink-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Offre Bêta
              </h3>
            </div>
            <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-pink-200 dark:border-pink-800">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Pendant la phase bêta, l'indexation de vos documents personnels est <strong>offerte</strong> avec un double quota :
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <HardDrive className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                  <span><strong>100 000 tokens de stockage</strong> : capacité maximale de documents personnels que vous pouvez conserver à tout moment</span>
                </li>
                <li className="flex items-start gap-2">
                  <Upload className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <span><strong>100 000 tokens d'import/mois</strong> : volume total d'imports autorisé chaque mois (réinitialisé le 1er du mois)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 mt-1">📚</span>
                  <span>Corpus officiel inclus <strong>gratuitement et sans limite</strong></span>
                </li>
              </ul>
              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-pink-200 dark:border-pink-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  💡 <strong>Astuce :</strong> Supprimez des documents pour libérer de l'espace de stockage. 
                  Le quota d'import mensuel vous permet de renouveler régulièrement vos documents.
                </p>
              </div>
            </div>
          </div>

          {/* Confidentialité */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Confidentialité de vos données
              </h3>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Vos documents personnels sont <strong>privés</strong> et accessibles uniquement par vous</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Les données sont stockées de manière <strong>sécurisée</strong> sur nos serveurs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Vous pouvez <strong>supprimer</strong> vos documents à tout moment</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
          >
            J'ai compris !
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant encart Bêta - MISE À JOUR avec double quota
const BetaUsageCard: React.FC<{ betaStats: BetaUsageStats; isLoading: boolean }> = ({ betaStats, isLoading }) => {
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-orange-500';
    return 'bg-gradient-to-r from-pink-500 to-purple-500';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Bientôt';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };

  const storageAvailable = Math.max(0, betaStats.storageTokensLimit - betaStats.storageTokensUsed);
  const monthlyAvailable = Math.max(0, betaStats.monthlyTokensLimit - betaStats.monthlyTokensUsed);

  return (
    <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-pink-200 dark:border-pink-800 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="w-5 h-5 text-pink-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
          Offre Bêta - Documents personnels
        </h3>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quota de stockage */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-pink-500" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Stockage</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>{betaStats.storageTokensUsed.toLocaleString('fr-FR')} tokens stockés</span>
              <span>{betaStats.storageTokensLimit.toLocaleString('fr-FR')} max</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor(betaStats.storagePercentUsed)} transition-all duration-500`}
                style={{ width: `${Math.min(betaStats.storagePercentUsed, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {betaStats.storagePercentUsed}% utilisé
              </span>
              <span className="text-xs text-green-600 dark:text-green-400">
                {storageAvailable.toLocaleString('fr-FR')} disponible
              </span>
            </div>
          </div>

          {/* Quota mensuel d'import */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Upload className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Import mensuel</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>{betaStats.monthlyTokensUsed.toLocaleString('fr-FR')} tokens importés</span>
              <span>{betaStats.monthlyTokensLimit.toLocaleString('fr-FR')} /mois</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor(betaStats.monthlyPercentUsed)} transition-all duration-500`}
                style={{ width: `${Math.min(betaStats.monthlyPercentUsed, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {betaStats.monthlyPercentUsed}% utilisé
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Réinit. : {formatDate(betaStats.resetDate)}
              </span>
            </div>
          </div>

          {/* Alertes */}
          {(betaStats.storagePercentUsed >= 80 || betaStats.monthlyPercentUsed >= 80) && (
            <div className="mt-3 p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <p className="text-xs text-orange-700 dark:text-orange-300">
                {betaStats.storagePercentUsed >= 80 && betaStats.monthlyPercentUsed >= 80 ? (
                  <>⚠️ Vous approchez de vos limites de stockage et d'import mensuel.</>
                ) : betaStats.storagePercentUsed >= 80 ? (
                  <>⚠️ Vous approchez de votre limite de stockage. Supprimez des documents pour libérer de l'espace.</>
                ) : (
                  <>⚠️ Vous approchez de votre limite mensuelle d'import.</>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ChatbotPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tokenBalance = useTokenBalance();

  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [stats, setStats] = useState<RagStats>({ 
    totalDocuments: 0, 
    readyDocuments: 0, 
    totalChunks: 0,
    globalDocuments: 0,
    userDocuments: 0
  });
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [betaStats, setBetaStats] = useState<BetaUsageStats>({ 
    storageTokensUsed: 0, 
    storageTokensLimit: 100000, 
    storagePercentUsed: 0,
    monthlyTokensUsed: 0, 
    monthlyTokensLimit: 100000, 
    monthlyPercentUsed: 0,
    resetDate: null 
  });
  const [isLoadingBeta, setIsLoadingBeta] = useState(true);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

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

  const loadStats = useCallback(async () => {
    try {
      const data = await getRagStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  const loadBetaStats = useCallback(async () => {
    try {
      setIsLoadingBeta(true);
      const data = await getBetaUsageStats();
      setBetaStats(data);
    } catch (error) {
      console.error('Error loading beta stats:', error);
    } finally {
      setIsLoadingBeta(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
    loadStats();
    loadBetaStats();
  }, [loadDocuments, loadStats, loadBetaStats]);

  const handleUploadComplete = useCallback(() => {
    loadDocuments();
    loadStats();
    loadBetaStats();
  }, [loadDocuments, loadStats, loadBetaStats]);

  // Séparer les documents pour l'affichage dans l'onglet Chat
  const globalDocs = documents.filter(d => d.scope === 'global' && d.status === 'ready');
  const userDocs = documents.filter(d => d.scope === 'user' && d.status === 'ready');

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Mon Chatbot
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded-full">
                  Bêta
                </span>
              </h1>
              <button
                onClick={() => setShowInfoModal(true)}
                className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center justify-center transition-colors group"
                title="Comment ça marche ?"
              >
                <Info className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              </button>
            </div>
          </div>
          
          {/* Compteur de tokens */}
          <div className="flex items-center bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <Sparkles className="w-4 h-4 text-purple-500 mr-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="font-bold text-purple-600 dark:text-purple-400">
                {tokenBalance !== null ? tokenBalance.toLocaleString('fr-FR') : '...'}
              </span> tokens
            </span>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 ml-13">
          Interrogez vos documents avec l'IA
        </p>

        {/* Stats avec distinction global/user */}
        <div className="flex flex-wrap gap-3 mt-4">
          {/* Documents globaux */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Globe className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-purple-700 dark:text-purple-300">
              {stats.globalDocuments} officiel{stats.globalDocuments > 1 ? 's' : ''}
            </span>
          </div>
          {/* Documents utilisateur */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <User className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {stats.userDocuments} perso{stats.userDocuments > 1 ? 's' : ''}
            </span>
          </div>
          {/* Sections totales */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <BarChart3 className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {stats.totalChunks} section{stats.totalChunks > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
            {/* Avertissement version en cours d'amélioration */}
      <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center">
            <span className="text-lg">🛠️</span>
          </div>
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
              À propos de ce chatbot
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
              Ce chatbot est une version en cours d'amélioration. Les documents officiels intégrés seront ajoutés progressivement, 
              et les techniques de recherche et de restitution des réponses seront affinées au fur et à mesure de son utilisation.
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 leading-relaxed">
              Vos retours de terrain sont les bienvenus : demande d'ajout de textes officiels, signalement d'erreurs ou remarques d'usage.
            </p>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mt-2">
              Ensemble, nous construisons un outil au plus proche de vos besoins.
            </p>
          </div>
        </div>
      </div>

      {/* Encart Bêta */}
      <BetaUsageCard betaStats={betaStats} isLoading={isLoadingBeta} />

      {/* Réglages du chatbot */}
      <div className="mb-6">
        <ChatbotFloatingSwitch />
      </div>

      {/* Alerte si tokens faibles */}
      {tokenBalance !== null && tokenBalance < 500 && (
        <div className="mb-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-red-500" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-300">
                {tokenBalance === 0 ? 'Tokens épuisés' : 'Tokens faibles'}
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {tokenBalance === 0 
                  ? 'Vous n\'avez plus de tokens. Rechargez pour continuer à utiliser le chatbot.'
                  : `Il vous reste ${tokenBalance.toLocaleString('fr-FR')} tokens. Pensez à recharger bientôt.`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar - Documents */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            {/* Tabs */}
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1 mb-4">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
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
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <FileText className="w-4 h-4" />
                Documents
              </button>
            </div>

            {/* Tab content */}
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
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Documents indexés
                </h3>
                
                {isLoadingDocs ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : (globalDocs.length === 0 && userDocs.length === 0) ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">Aucun document</p>
                    <button
                      onClick={() => setActiveTab('documents')}
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      Uploader des documents
                    </button>
                  </div>
                ) : (
                                    <div className="space-y-4 max-h-64 overflow-y-auto">
                    {/* Documents personnels - EN PREMIER */}
                    {userDocs.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">
                            Mes documents
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {userDocs.slice(0, 5).map((doc) => (
                            <li
                              key={doc.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{doc.title}</span>
                            </li>
                          ))}
                          {userDocs.length > 5 && (
                            <li className="text-xs text-blue-500 px-2">
                              +{userDocs.length - 5} autres...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Corpus ProfAssist - EN SECOND */}
                    {globalDocs.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Globe className="w-3.5 h-3.5 text-purple-500" />
                          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">
                            Corpus ProfAssist
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {globalDocs.slice(0, 5).map((doc) => (
                            <li
                              key={doc.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-600 dark:text-gray-300 bg-purple-50 dark:bg-purple-900/20"
                            >
                              <Globe className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                              <span className="truncate">{doc.title}</span>
                            </li>
                          ))}
                          {globalDocs.length > 5 && (
                            <li className="text-xs text-purple-500 px-2">
                              +{globalDocs.length - 5} autres...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Lien vers Documents */}
                    <button
                      onClick={() => setActiveTab('documents')}
                      className="w-full text-center text-xs text-blue-600 dark:text-blue-400 hover:underline pt-2"
                    >
                      Gérer mes documents →
                    </button>
                  </div>

                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[600px] flex flex-col">
            <ChatInterface
              documents={documents}
              onNeedDocuments={() => setActiveTab('documents')}
            />
          </div>
        </div>
      </div>

      {/* Modal d'information */}
      <ChatbotInfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />
    </div>
  );
};

export default ChatbotPage;






