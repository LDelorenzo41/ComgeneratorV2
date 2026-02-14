// src/pages/AdminDashboardPage.tsx
// Dashboard Admin avec KPIs complets : Monétisation, Stockage, Edge Functions
// VERSION CORRIGÉE - 2026-01-30

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  FileText,
  CreditCard,
  TrendingUp,
  Database,
  Mail,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Calendar,
  Coins,
  BookOpen,
  MessageSquare,
  Gift,
  HardDrive,
  Clock,
  UserCheck,
  Sparkles,
  ShoppingCart,
  AlertCircle,
  Zap,
  Bot,
  FileSearch
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { checkIsAdmin } from '../lib/ragApi';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardData {
  timestamp: string;
  users: {
    total: number;
    new_today: number;
    new_this_week: number;
    new_this_month: number;
    new_this_year: number;
  };
  active_users: {
    today: number;
    this_week: number;
    this_month: number;
  };
  content: {
    appreciations: {
      total: number;
      today: number;
      this_week: number;
      this_month: number;
    };
    lessons: {
      total: number;
      today: number;
      this_week: number;
      this_month: number;
    };
    lessons_bank: number;
    scenarios_bank: {
      total: number;
      today: number;
      this_week: number;
      this_month: number;
    };
  };
  monetization: {
    total_transactions: number;
    total_revenue_eur: number;
    revenue_today_eur: number;
    revenue_this_week_eur: number;
    revenue_this_month_eur: number;
    transactions_today: number;
    transactions_this_week: number;
    transactions_this_month: number;
    promo_redemptions: number;
  };
  engagement: {
    users_with_appreciations: number;
    users_with_lessons: number;
    users_with_scenarios: number;
  };
  rag: {
    total_documents: number;
    ready_documents: number;
    total_chunks: number;
    total_tokens: number;
  };
  newsletter: {
    subscribers: number;
    failures: number;
    total_sent: number;
  };
  storage: {
    used_bytes: number;
    limit_bytes: number;
    used_mb: number;
    limit_mb: number;
    percent_used: number;
  };
  edge_functions: {
    rag_chat: {
      total: number;
      today: number;
      this_week: number;
      this_month: number;
    };
    synthesis: {
      total: number;
      today: number;
      this_week: number;
      this_month: number;
    };
  };
}

// ============================================================================
// COMPOSANTS UI
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'indigo' | 'pink' | 'orange' | 'cyan';
  subtitle?: string;
  trend?: { today: number; week: number; month: number };
  badge?: { text: string; color: 'green' | 'yellow' | 'red' };
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    icon: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    icon: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  yellow: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    icon: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  indigo: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    icon: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
  pink: {
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    icon: 'text-pink-600 dark:text-pink-400',
    border: 'border-pink-200 dark:border-pink-800',
  },
  orange: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    icon: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
  },
  cyan: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    icon: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-200 dark:border-cyan-800',
  },
};

function StatCard({ title, value, icon, color, subtitle, trend, badge }: StatCardProps) {
  const colors = colorClasses[color];
  
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${colors.border} p-5`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            {badge && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                badge.color === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                badge.color === 'yellow' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
              }`}>
                {badge.text}
              </span>
            )}
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="flex items-center text-green-600 dark:text-green-400">
                <TrendingUp className="w-3 h-3 mr-1" />
                +{trend.today} aujourd'hui
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-blue-600 dark:text-blue-400">+{trend.week} sem.</span>
              <span className="text-gray-400">|</span>
              <span className="text-purple-600 dark:text-purple-400">+{trend.month} mois</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors.bg}`}>
          <div className={colors.icon}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  color: string;
}

function Section({ title, icon, children, color }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${color}`}>
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );
}

// Composant barre de progression pour le stockage
interface StorageBarProps {
  usedMB: number;
  limitMB: number;
  percentUsed: number;
}

function StorageBar({ usedMB, limitMB, percentUsed }: StorageBarProps) {
  const getBarColor = () => {
    if (percentUsed >= 90) return 'bg-red-500';
    if (percentUsed >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusColor = () => {
    if (percentUsed >= 90) return 'text-red-600 dark:text-red-400';
    if (percentUsed >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getStatusText = () => {
    if (percentUsed >= 90) return 'Critique';
    if (percentUsed >= 70) return 'Attention';
    return 'OK';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <HardDrive className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stockage Supabase</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Plan gratuit : 500 MB (DB + Storage)</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${getStatusColor()}`}>
          {percentUsed >= 70 && <AlertCircle className="w-4 h-4" />}
          <span className="font-semibold">{getStatusText()}</span>
        </div>
      </div>
      
      {/* Barre de progression */}
      <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        <div 
          className={`absolute left-0 top-0 h-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {percentUsed.toFixed(1)}%
          </span>
        </div>
      </div>
      
      {/* Détails */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          Utilisé: <span className="font-semibold text-gray-900 dark:text-white">{usedMB.toFixed(2)} MB</span>
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          Limite: <span className="font-semibold text-gray-900 dark:text-white">{limitMB} MB</span>
        </span>
      </div>
      
      {/* Recommandation si proche de la limite */}
      {percentUsed >= 70 && (
        <div className={`mt-4 p-3 rounded-lg ${
          percentUsed >= 90 
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
            : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
        }`}>
          <p className={`text-sm ${
            percentUsed >= 90 
              ? 'text-red-700 dark:text-red-300' 
              : 'text-yellow-700 dark:text-yellow-300'
          }`}>
            {percentUsed >= 90 
              ? 'Stockage critique ! Pensez a upgrader vers le plan Pro de Supabase.'
              : 'Stockage utilise a plus de 70%. Surveillez evolution.'
            }
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Vérifier le statut admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      const adminStatus = await checkIsAdmin();
      setIsAdmin(adminStatus);
      if (adminStatus) {
        await fetchDashboardData();
      }
      setIsLoading(false);
    };
    checkAdminStatus();
  }, []);

  // Récupérer les données du dashboard
  const fetchDashboardData = async () => {
    try {
      setError(null);
      const { data: result, error: rpcError } = await supabase.rpc('get_admin_dashboard');
      
      if (rpcError) throw rpcError;
      
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        setData(result as unknown as DashboardData);
        setLastUpdated(new Date());
      } else {
        throw new Error('Format de données invalide');
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement du dashboard:', err);
      setError(err.message || 'Erreur lors du chargement des données');
    }
  };

  // Rafraîchir les données
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData();
    setIsRefreshing(false);
  };

  // États de chargement
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Accès refusé
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acces refuse</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Cette page est reservee aux administrateurs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Admin</h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Pilotez votre application ProfAssist
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <Clock className="w-4 h-4 mr-1" />
                  {lastUpdated.toLocaleTimeString('fr-FR')}
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Rafraichir
              </button>
            </div>
          </div>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" />
            <span className="text-red-800 dark:text-red-300">{error}</span>
          </div>
        )}

        {data && (
          <div className="space-y-8">
            
            {/* ========== STOCKAGE SUPABASE ========== */}
            {data.storage && (
              <StorageBar 
                usedMB={data.storage.used_mb}
                limitMB={data.storage.limit_mb}
                percentUsed={data.storage.percent_used}
              />
            )}

            {/* ========== MONETISATION ========== */}
            <Section 
              title="Monetisation" 
              icon={<CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />}
              color="bg-green-100 dark:bg-green-900/30"
            >
              <StatCard
                title="Revenus totaux"
                value={`${data.monetization.total_revenue_eur.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`}
                icon={<Coins className="w-6 h-6" />}
                color="green"
                subtitle={`${data.monetization.total_transactions} transactions au total`}
              />
              <StatCard
                title="Aujourd'hui"
                value={`${data.monetization.revenue_today_eur.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`}
                icon={<ShoppingCart className="w-6 h-6" />}
                color="green"
                badge={data.monetization.transactions_today > 0 
                  ? { text: `${data.monetization.transactions_today} achat(s)`, color: 'green' } 
                  : undefined
                }
              />
              <StatCard
                title="Cette semaine"
                value={`${data.monetization.revenue_this_week_eur.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`}
                icon={<TrendingUp className="w-6 h-6" />}
                color="green"
                badge={data.monetization.transactions_this_week > 0 
                  ? { text: `${data.monetization.transactions_this_week} achat(s)`, color: 'green' } 
                  : undefined
                }
              />
              <StatCard
                title="Ce mois"
                value={`${data.monetization.revenue_this_month_eur.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`}
                icon={<Calendar className="w-6 h-6" />}
                color="green"
                badge={data.monetization.transactions_this_month > 0 
                  ? { text: `${data.monetization.transactions_this_month} achat(s)`, color: 'green' } 
                  : undefined
                }
              />
              <StatCard
                title="Codes promo utilises"
                value={data.monetization.promo_redemptions}
                icon={<Gift className="w-6 h-6" />}
                color="yellow"
              />
            </Section>

            {/* ========== USAGE EDGE FUNCTIONS ========== */}
            {data.edge_functions && (
              <Section 
                title="Usage des fonctionnalites IA" 
                icon={<Zap className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />}
                color="bg-cyan-100 dark:bg-cyan-900/30"
              >
                <StatCard
                  title="RAG Chat"
                  value={data.edge_functions.rag_chat.total}
                  icon={<Bot className="w-6 h-6" />}
                  color="cyan"
                  subtitle="Interrogations du chatbot"
                  trend={{
                    today: data.edge_functions.rag_chat.today,
                    week: data.edge_functions.rag_chat.this_week,
                    month: data.edge_functions.rag_chat.this_month,
                  }}
                />
                <StatCard
                  title="Syntheses bulletin"
                  value={data.edge_functions.synthesis.total}
                  icon={<FileSearch className="w-6 h-6" />}
                  color="cyan"
                  subtitle="Creations de syntheses"
                  trend={{
                    today: data.edge_functions.synthesis.today,
                    week: data.edge_functions.synthesis.this_week,
                    month: data.edge_functions.synthesis.this_month,
                  }}
                />
              </Section>
            )}

            {/* ========== UTILISATEURS ========== */}
            <Section 
              title="Utilisateurs" 
              icon={<Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              color="bg-blue-100 dark:bg-blue-900/30"
            >
              <StatCard
                title="Total utilisateurs"
                value={data.users.total}
                icon={<Users className="w-6 h-6" />}
                color="blue"
                trend={{
                  today: data.users.new_today,
                  week: data.users.new_this_week,
                  month: data.users.new_this_month,
                }}
              />
              <StatCard
                title="Actifs aujourd'hui"
                value={data.active_users.today}
                icon={<UserCheck className="w-6 h-6" />}
                color="green"
                subtitle={`${data.active_users.this_week} cette semaine - ${data.active_users.this_month} ce mois`}
              />
              <StatCard
                title="Nouveaux cette annee"
                value={data.users.new_this_year}
                icon={<Calendar className="w-6 h-6" />}
                color="purple"
              />
            </Section>

            {/* ========== CONTENU ========== */}
            <Section 
              title="Contenu genere" 
              icon={<FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
              color="bg-indigo-100 dark:bg-indigo-900/30"
            >
              <StatCard
                title="Appreciations"
                value={data.content.appreciations.total}
                icon={<MessageSquare className="w-6 h-6" />}
                color="indigo"
                trend={{
                  today: data.content.appreciations.today,
                  week: data.content.appreciations.this_week,
                  month: data.content.appreciations.this_month,
                }}
              />
              <StatCard
                title="Seances pedagogiques"
                value={data.content.lessons.total}
                icon={<BookOpen className="w-6 h-6" />}
                color="purple"
                trend={{
                  today: data.content.lessons.today,
                  week: data.content.lessons.this_week,
                  month: data.content.lessons.this_month,
                }}
              />
              <StatCard
                title="Scenarios"
                value={data.content.scenarios_bank.total}
                icon={<Sparkles className="w-6 h-6" />}
                color="pink"
                trend={{
                  today: data.content.scenarios_bank.today,
                  week: data.content.scenarios_bank.this_week,
                  month: data.content.scenarios_bank.this_month,
                }}
              />
              <StatCard
                title="Lessons Bank"
                value={data.content.lessons_bank}
                icon={<Database className="w-6 h-6" />}
                color="blue"
                subtitle="Seances sauvegardees"
              />
            </Section>

            {/* ========== ENGAGEMENT ========== */}
            <Section 
              title="Engagement" 
              icon={<TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
              color="bg-purple-100 dark:bg-purple-900/30"
            >
              <StatCard
                title="Avec appreciations"
                value={data.engagement.users_with_appreciations}
                icon={<MessageSquare className="w-6 h-6" />}
                color="purple"
                subtitle="utilisateurs"
              />
              <StatCard
                title="Avec seances"
                value={data.engagement.users_with_lessons}
                icon={<BookOpen className="w-6 h-6" />}
                color="indigo"
                subtitle="utilisateurs"
              />
              <StatCard
                title="Avec scenarios"
                value={data.engagement.users_with_scenarios}
                icon={<Sparkles className="w-6 h-6" />}
                color="pink"
                subtitle="utilisateurs"
              />
            </Section>

            {/* ========== RAG & NEWSLETTER ========== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* RAG */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <Database className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">RAG Chatbot</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Documents</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.rag.total_documents}</p>
                    <p className="text-xs text-green-600 dark:text-green-400">{data.rag.ready_documents} prets</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Chunks</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.rag.total_chunks.toLocaleString()}</p>
                  </div>
                  <div className="col-span-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tokens totaux</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.rag.total_tokens.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ~ {(data.rag.total_tokens * 4 / 1024 / 1024).toFixed(2)} MB estimes
                    </p>
                  </div>
                </div>
              </div>

              {/* Newsletter */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                    <Mail className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Newsletter</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Abonnes</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.newsletter.subscribers}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Envois totaux</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.newsletter.total_sent}</p>
                  </div>
                  <div className="col-span-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Echecs d'envoi</p>
                    <p className={`text-2xl font-bold ${data.newsletter.failures > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {data.newsletter.failures}
                    </p>
                    {data.newsletter.failures > 0 && (
                      <p className="text-xs text-red-500 dark:text-red-400">A investiguer</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Donnees calculees en temps reel - Derniere mise a jour : {lastUpdated?.toLocaleString('fr-FR')}
        </div>
      </div>
    </div>
  );
}


