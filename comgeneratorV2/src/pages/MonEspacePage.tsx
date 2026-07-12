import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import useTokenBalance from '../hooks/useTokenBalance';
import { rssService, RSSArticle } from '../lib/rssService';
import { FEATURES } from '../lib/features';
import {
  Sparkles,
  PenTool,
  FileText,
  BookOpen,
  ClipboardList,
  Send,
  Bot,
  Newspaper,
  Gift,
  ExternalLink,
  Database,
  CreditCard
} from 'lucide-react';
import { RedeemCodeModal } from '../components/modals/RedeemCodeModal';

interface RecentItem {
  id: string;
  kind: 'appreciation' | 'lesson' | 'scenario';
  title: string;
  meta: string;
  link: string;
  createdAt: string;
}

interface YearStats {
  appreciations: number;
  lessons: number;
  scenarios: number;
}

// Coûts moyens observés (voir guide de consommation de la page d'achat)
const TOKENS_PER_APPRECIATION = 3000;
const TOKENS_PER_LESSON = 10000;

function getSeasonalBanner(): { emoji: string; title: string; text: string; ctaLabel: string; ctaLink: string } {
  const month = new Date().getMonth(); // 0 = janvier
  if (month === 8 || month === 9) {
    return {
      emoji: '🎒',
      title: 'C\'est la rentrée.',
      text: 'Préparez vos séquences et vos séances pour la nouvelle année.',
      ctaLabel: 'Créer un scénario',
      ctaLink: '/scenario-pedagogique'
    };
  }
  if (month === 10 || month === 11 || month === 2 || month === 5) {
    return {
      emoji: '📝',
      title: 'Période de bulletins.',
      text: 'Gagnez du temps sur vos appréciations de fin de trimestre.',
      ctaLabel: 'Générer une appréciation',
      ctaLink: '/dashboard'
    };
  }
  return {
    emoji: '✨',
    title: 'Bienvenue dans votre espace.',
    text: 'Retrouvez vos outils et reprenez votre travail là où vous l\'avez laissé.',
    ctaLabel: 'Générer une appréciation',
    ctaLink: '/dashboard'
  };
}

function getDisplayName(email: string): string {
  const name = email.split('@')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Aujourd\'hui';
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function MonEspacePage() {
  const { user } = useAuthStore();
  const tokenCount = useTokenBalance();
  const [recentItems, setRecentItems] = React.useState<RecentItem[]>([]);
  const [stats, setStats] = React.useState<YearStats | null>(null);
  const [articles, setArticles] = React.useState<RSSArticle[]>([]);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = React.useState(false);

  const banner = React.useMemo(() => getSeasonalBanner(), []);
  const isOutOfTokens = (tokenCount ?? 0) === 0;

  // Éléments récents + compteurs de l'année (les erreurs sont silencieuses : la page reste utilisable)
  React.useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const yearStart = new Date();
      // Année scolaire : à partir du 1er septembre précédent
      yearStart.setMonth(8, 1);
      yearStart.setHours(0, 0, 0, 0);
      if (new Date().getMonth() < 8) {
        yearStart.setFullYear(yearStart.getFullYear() - 1);
      }
      const yearStartIso = yearStart.toISOString();

      try {
        const [appRes, lessonRes, scenarioRes, appCount, lessonCount, scenarioCount] = await Promise.all([
          supabase.from('appreciations').select('id, tag, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(2),
          supabase.from('lessons_bank').select('id, subject, topic, level, duration, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(2),
          (supabase as any).from('scenarios_bank').select('id, matiere, niveau, theme, nombre_seances, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(2),
          supabase.from('appreciations').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', yearStartIso),
          supabase.from('lessons_bank').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', yearStartIso),
          (supabase as any).from('scenarios_bank').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', yearStartIso)
        ]);

        const items: RecentItem[] = [];
        (appRes.data || []).forEach((a: any) => items.push({
          id: a.id,
          kind: 'appreciation',
          title: 'Appréciation enregistrée',
          meta: formatRelativeDate(a.created_at),
          link: '/appreciation-bank',
          createdAt: a.created_at
        }));
        (lessonRes.data || []).forEach((l: any) => items.push({
          id: l.id,
          kind: 'lesson',
          title: `${l.topic || l.subject}`,
          meta: `${formatRelativeDate(l.created_at)}${l.level ? ` · ${l.level}` : ''}${l.duration ? ` · ${l.duration} min` : ''}`,
          link: '/lessons-bank',
          createdAt: l.created_at
        }));
        (scenarioRes.data || []).forEach((s: any) => items.push({
          id: s.id,
          kind: 'scenario',
          title: `${s.theme || s.matiere}`,
          meta: `${formatRelativeDate(s.created_at)}${s.niveau ? ` · ${s.niveau}` : ''}${s.nombre_seances ? ` · ${s.nombre_seances} séances` : ''}`,
          link: '/scenarios-bank',
          createdAt: s.created_at
        }));

        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRecentItems(items.slice(0, 3));

        setStats({
          appreciations: appCount.count ?? 0,
          lessons: lessonCount.count ?? 0,
          scenarios: scenarioCount.count ?? 0
        });
      } catch (error) {
        console.error('Erreur lors du chargement de Mon espace:', error);
      }
    };

    fetchData();
  }, [user]);

  // Actualités : deux flux généralistes seulement, en échec silencieux
  React.useEffect(() => {
    const fetchNews = async () => {
      try {
        const feeds = rssService.getAllFeeds().filter(f =>
          f.name.includes('Café pédagogique') || f.name.includes('Éduscol')
        ).slice(0, 2);
        const results = await Promise.allSettled(feeds.map(f => rssService.fetchFeed(f)));
        const all = results
          .filter((r): r is PromiseFulfilledResult<RSSArticle[]> => r.status === 'fulfilled')
          .flatMap(r => r.value);
        all.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        setArticles(all.slice(0, 3));
      } catch {
        // Pas d'actualités : la section est simplement masquée
      }
    };
    fetchNews();
  }, []);

  const kindStyles: Record<RecentItem['kind'], { label: string; classes: string }> = {
    appreciation: { label: 'Appréciation', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    lesson: { label: 'Séance', classes: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
    scenario: { label: 'Scénario', classes: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' }
  };

  const quickActions = [
    { label: 'Générer une appréciation', link: '/dashboard', icon: PenTool, color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40' },
    { label: 'Synthèse de bulletin', link: '/synthese', icon: FileText, color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40' },
    { label: 'Créer une séance', link: '/generate-lesson', icon: BookOpen, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40' },
    ...(FEATURES.SCENARIO_ENABLED ? [{ label: 'Créer un scénario', link: '/scenario-pedagogique', icon: ClipboardList, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40' }] : []),
    { label: 'Écrire aux familles', link: '/communication?mode=create', icon: Send, color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40' },
    ...(FEATURES.CHATBOT_ENABLED ? [{ label: 'Interroger mon chatbot', link: '/chatbot', icon: Bot, color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40' }] : [])
  ];

  const estimatedHoursSaved = stats
    ? Math.round((stats.appreciations * 10 + stats.lessons * 45 + stats.scenarios * 60) / 60)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Salutation */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Bonjour {user?.email ? getDisplayName(user.email) : ''} 👋
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>

        {/* Bandeau contextuel */}
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-blue-100/80 to-transparent dark:from-blue-900/40 dark:to-transparent border border-blue-200 dark:border-blue-800 rounded-2xl px-5 py-4 mb-6">
          <p className="text-gray-800 dark:text-gray-100 flex-1 min-w-[220px]">
            <span className="mr-2">{banner.emoji}</span>
            <strong>{banner.title}</strong> {banner.text}
          </p>
          <Link
            to={banner.ctaLink}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {banner.ctaLabel}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Colonne gauche : crédits + bilan */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                Mes crédits
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Sans abonnement · sans expiration</p>

              {tokenCount !== null ? (
                <>
                  <p className={`text-3xl font-bold ${isOutOfTokens ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {tokenCount.toLocaleString('fr-FR')}
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-2">tokens</span>
                  </p>
                  {!isOutOfTokens && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      ≈ {Math.floor(tokenCount / TOKENS_PER_APPRECIATION)} appréciations détaillées<br />
                      ou {Math.floor(tokenCount / TOKENS_PER_LESSON)} séances complètes
                    </p>
                  )}
                  {isOutOfTokens && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                      Crédits épuisés : rechargez pour continuer à utiliser les outils.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-gray-400 dark:text-gray-500">Chargement…</p>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                <Link
                  to="/buy-tokens"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Recharger
                </Link>
                <button
                  onClick={() => setIsRedeemModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-green-700 dark:text-green-400 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  J'ai un code
                </button>
              </div>
            </div>

            {stats && (stats.appreciations > 0 || stats.lessons > 0 || stats.scenarios > 0) && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Mon année avec ProfAssist</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Depuis le 1er septembre</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/60 rounded-xl px-3 py-2">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.appreciations}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">appréciations</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/60 rounded-xl px-3 py-2">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.lessons}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">séances</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/60 rounded-xl px-3 py-2">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.scenarios}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">scénarios</p>
                  </div>
                  {estimatedHoursSaved !== null && estimatedHoursSaved > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2">
                      <p className="text-xl font-bold text-green-700 dark:text-green-400">≈ {estimatedHoursSaved} h</p>
                      <p className="text-xs text-green-700/80 dark:text-green-400/80">de travail gagnées*</p>
                    </div>
                  )}
                </div>
                {estimatedHoursSaved !== null && estimatedHoursSaved > 0 && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 italic">* Estimation indicative</p>
                )}
              </div>
            )}
          </div>

          {/* Colonne droite : reprise, actions rapides, actus */}
          <div className="lg:col-span-2 space-y-6">

            {recentItems.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-500" />
                  Reprendre où j'en étais
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {recentItems.map((item: RecentItem) => (
                    <Link
                      key={`${item.kind}-${item.id}`}
                      to={item.link}
                      className="block bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                    >
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2 ${kindStyles[item.kind].classes}`}>
                        {kindStyles[item.kind].label}
                      </span>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.meta}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Actions rapides</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {quickActions.map(action => (
                  <Link
                    key={action.link + action.label}
                    to={action.link}
                    className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${action.color}`}>
                      <action.icon className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {articles.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-green-600 dark:text-green-400" />
                    Actualités pédagogiques
                  </h2>
                  <Link to="/resources" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    Tout voir →
                  </Link>
                </div>
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {articles.map(article => (
                    <li key={article.link}>
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-2 py-3 text-sm"
                      >
                        <div className="flex-1">
                          <p className="text-xs font-bold text-green-700 dark:text-green-400">{article.source}</p>
                          <p className="text-gray-800 dark:text-gray-100 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                            {article.title}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <RedeemCodeModal isOpen={isRedeemModalOpen} onClose={() => setIsRedeemModalOpen(false)} />
    </div>
  );
}
