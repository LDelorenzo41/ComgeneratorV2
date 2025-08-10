import React from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { ExternalLink, RefreshCw, AlertCircle, Newspaper, Check, ChevronDown, X, Sparkles, Rss, Filter, Calendar, Globe, TrendingUp } from 'lucide-react';
import type { Article, RssFeed, UserRssPreference } from '../lib/types';

// ---------- Utils ----------
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const callEdgeFunction = async () => {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-rss`,
    {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      }
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  return response;
};

// ---------- Composant principal ----------
export function ResourcesPage() {
  const { user } = useAuthStore();
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [refreshStatus, setRefreshStatus] = React.useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = React.useState<Date | null>(null);

  // Catalogue + préférences
  const [catalog, setCatalog] = React.useState<RssFeed[]>([]);
  const [prefs, setPrefs] = React.useState<UserRssPreference[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [selection, setSelection] = React.useState<string[]>([]);

  // ----- Chargement du catalogue -----
  const fetchCatalog = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('rss_feeds')
      .select('id, name, category, url, source_domain, is_active')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    setCatalog(data as RssFeed[]);
  }, []);

  // ----- Chargement des préférences user -----
  const fetchPrefs = React.useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_rss_preferences')
      .select('user_id, position, feed_id')
      .eq('user_id', user.id)
      .order('position', { ascending: true });

    if (error) throw error;

    const rows = (data || []) as UserRssPreference[];
    // Hydrate feeds
    const feedsMap = new Map(catalog.map(f => [f.id, f]));
    const enriched = rows.map(r => ({ ...r, feed: feedsMap.get(r.feed_id) }));
    setPrefs(enriched);

    // Initialise la sélection dans le picker
    setSelection(enriched.map(p => p.feed_id));
  }, [user, catalog]);

  // ----- Chargement des articles -----
  const fetchArticles = React.useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      if (forceRefresh) {
        setRefreshStatus('Actualisation des articles...');
        try {
          const response = await callEdgeFunction();
          const result = await response.json();
          if (!result.success) {
            throw new Error(result.message || 'Erreur lors de l\'actualisation');
          }
          setRefreshStatus(result.message || 'Articles mis à jour avec succès');
          setLastRefreshTime(new Date());
          await delay(3000);
        } catch (edgeError: any) {
          console.error('Edge Function error:', edgeError);
          throw edgeError;
        }
      }

      const { data: articlesData, error: fetchError } = await supabase
        .from('articles')
        .select('*')
        .not('feed_id', 'is', null)
        .order('pub_date', { ascending: false });

      if (fetchError) throw fetchError;

      const list = (articlesData || []) as Article[];
      console.log('Articles récupérés depuis Supabase:', list.length);
      console.log('Exemple d\'articles:', list.slice(0, 3).map(a => ({ title: a.title, feed_id: a.feed_id, source: a.source })));
      
      const sorted = [...list].sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime());
      setArticles(sorted);

      if (sorted.length === 0) {
        setRefreshStatus('Aucun article disponible');
      } else {
        setRefreshStatus(`${sorted.length} articles disponibles`);
        if (!lastRefreshTime) setLastRefreshTime(new Date());
      }
    } catch (err: any) {
      console.error('Erreur:', err);
      setError(
        err.message === 'JWT expired'
          ? 'Votre session a expiré. Veuillez vous reconnecter.'
          : err.message || 'Une erreur est survenue lors de la récupération des articles'
      );
      setRefreshStatus(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setTimeout(() => setRefreshStatus(null), 3000);
    }
  }, [lastRefreshTime]);

  // ----- Sauvegarde des préférences -----
  const savePrefs = async () => {
  if (!user) return;
  
  try {
    const selected = selection.slice(0, 3);
    
    // Supprimer d'abord TOUTES les préférences existantes de l'utilisateur
    const { error: deleteAllError } = await supabase
      .from('user_rss_preferences')
      .delete()
      .eq('user_id', user.id);

    if (deleteAllError) {
      console.error('Erreur lors de la suppression des anciennes préférences:', deleteAllError);
      alert('Erreur lors de la suppression des anciennes préférences.');
      return;
    }

    // Ensuite, insérer les nouvelles préférences seulement si il y en a
    if (selected.length > 0) {
      const rows = selected.map((feedId, idx) => ({
        user_id: user.id,
        position: idx + 1,
        feed_id: feedId
      }));

      const { error: insertError } = await supabase
        .from('user_rss_preferences')
        .insert(rows);

      if (insertError) {
        console.error('Erreur lors de l\'insertion des nouvelles préférences:', insertError);
        alert('Erreur lors de la sauvegarde des nouvelles préférences.');
        return;
      }
    }

    // Recharger les préférences et fermer le picker
    await fetchPrefs();
    setPickerOpen(false);
    
  } catch (error) {
    console.error('Erreur générale lors de la sauvegarde:', error);
    alert('Une erreur inattendue est survenue lors de la sauvegarde.');
  }
};

  // ----- Handlers UI -----
  const toggleSelection = (id: string) => {
    setSelection(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const clearSelection = () => setSelection([]);

  const handleRefresh = () => {
    if (!isRefreshing) {
      setIsRefreshing(true);
      fetchArticles(true);
    }
  };

  // ----- Effects -----
  React.useEffect(() => {
    fetchCatalog().catch(err => {
      console.error(err);
      setError('Impossible de charger le catalogue des flux.');
    });
  }, [fetchCatalog]);

  React.useEffect(() => {
    if (catalog.length > 0) {
      fetchPrefs().catch(err => {
        console.error(err);
        setError('Impossible de charger vos préférences de flux.');
      });
    }
  }, [catalog, fetchPrefs]);

  React.useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Feeds à afficher (3 colonnes)
  const feedsToShow: (RssFeed | null)[] = [1, 2, 3].map(pos => {
    const pref = prefs.find(p => p.position === pos);
    return pref?.feed || null;
  });

  // ✅ FONCTION SIMPLIFIÉE : Articles filtrés par feed_id
  const getArticlesForFeed = (feed: RssFeed | null) => {
    if (!feed) return [];
    const filtered = articles.filter(a => a.feed_id === feed.id);
    console.log(`Feed "${feed.name}" (${feed.id}): ${filtered.length} articles trouvés`);
    console.log('Articles pour ce flux:', filtered.map(a => ({ title: a.title, feed_id: a.feed_id })));
    return filtered.slice(0, 20);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) throw new Error('Date invalide');
      return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      console.error('Erreur de formatage de date:', e);
      return 'Date non disponible';
    }
  };

  // Grouper les flux par catégorie pour le picker
  const catalogByCategory = catalog.reduce((acc, feed) => {
    const category = feed.category || 'Autres';
    if (!acc[category]) acc[category] = [];
    acc[category].push(feed);
    return acc;
  }, {} as Record<string, RssFeed[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Hero Header */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 mix-blend-multiply"></div>
            <div className="relative">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mr-4">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Actualités éducatives
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
                Ressources pédagogiques
              </h1>
              <p className="text-xl text-blue-100 max-w-3xl">
                Restez informé des dernières actualités éducatives. Choisissez jusqu'à 3 flux RSS personnalisés 
                et consultez les articles organisés en colonnes selon vos préférences.
              </p>
            </div>
          </div>

          {/* Barre d'actions modernisée */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Sélecteur multi amélioré */}
              <div className="relative">
                <button
                  onClick={() => setPickerOpen(v => !v)}
                  className="group inline-flex items-center px-6 py-3 rounded-xl border-2 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-medium transition-all duration-300 hover:shadow-lg"
                >
                  <Filter className="h-5 w-5 mr-2" />
                  Choisir mes 3 flux
                  <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                </button>

                {pickerOpen && (
                  <div className="absolute z-20 mt-3 w-[420px] max-h-[500px] overflow-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <Rss className="h-5 w-5 text-blue-600 mr-2" />
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Catalogue des flux</div>
                        </div>
                        <button 
                          onClick={() => setPickerOpen(false)} 
                          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                        <div className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                          <strong>Sélection actuelle :</strong> {selection.length} / 3
                        </div>
                        {selection.length >= 3 && (
                          <div className="text-xs text-amber-700 dark:text-amber-300 flex items-center">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Limite atteinte - désélectionnez un flux pour en choisir un autre
                          </div>
                        )}
                      </div>

                      <div className="mb-4">
                        <button
                          onClick={clearSelection}
                          className="text-sm underline text-blue-600 hover:text-blue-500 font-medium"
                        >
                          Réinitialiser la sélection
                        </button>
                      </div>

                      <div className="space-y-4">
                        {Object.entries(catalogByCategory).map(([category, feeds]) => (
                          <div key={category}>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 px-2">
                              {category}
                            </h4>
                            <div className="space-y-1">
                              {feeds.map(feed => {
                                const checked = selection.includes(feed.id);
                                const disabled = !checked && selection.length >= 3;
                                return (
                                  <button
                                    key={feed.id}
                                    onClick={() => toggleSelection(feed.id)}
                                    disabled={disabled}
                                    className={`w-full text-left px-3 py-3 rounded-xl border-2 transition-all duration-200 ${
                                      checked 
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                                        : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                                        checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
                                      }`}>
                                        {checked && <Check className="h-3 w-3 text-white" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                          {feed.name}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                          {feed.source_domain || new URL(feed.url).hostname}
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          onClick={() => setPickerOpen(false)}
                          className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={savePrefs}
                          className="px-6 py-2 text-sm rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200"
                          disabled={selection.length === 0}
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {refreshStatus && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Globe className="h-4 w-4 mr-2" />
                    {refreshStatus}
                  </div>
                )}
                {/* Bouton Actualiser supprimé - mise à jour automatique au chargement */}
              </div>
            </div>
          </div>

          {/* Erreurs modernisées */}
          {error && (
            <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-l-4 border-red-500 p-6 rounded-xl">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-red-500 mr-3 flex-shrink-0" />
                <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Contenu - Grille d'articles */}
          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {[0, 1, 2].map(i => (
                <div key={i} className="space-y-6">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="animate-pulse">
                      <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-2xl"></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {feedsToShow.map((feed, idx) => {
                const list = getArticlesForFeed(feed);
                const feedColors = [
                  'from-blue-500 to-indigo-500',
                  'from-green-500 to-emerald-500', 
                  'from-purple-500 to-pink-500'
                ];
                return (
                  <section key={idx} className="space-y-6">
                    {/* Header de colonne modernisé */}
                    <div className={`bg-gradient-to-r ${feedColors[idx]} p-6 rounded-2xl text-white`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-bold">
                            {feed ? feed.name : `Flux ${idx + 1}`}
                          </h2>
                          {feed && (
                            <p className="text-white/80 text-sm mt-1">
                              {list.length} article{list.length > 1 ? 's' : ''} disponible{list.length > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                          <Rss className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    {(!feed || list.length === 0) ? (
                      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700 shadow-lg">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Newspaper className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          {feed ? 'Aucun article' : 'Flux non configuré'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {feed 
                            ? 'Aucun article trouvé pour ce flux.' 
                            : 'Cliquez sur "Choisir mes 3 flux" pour configurer cette colonne.'
                          }
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {list.map(article => (
                          <article key={article.id} className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <div className="p-6">
                              <div className="flex items-start gap-4">
                                {article.image_url && (
                                  <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                                    <img
                                      src={article.image_url}
                                      alt={article.title}
                                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {article.title}
                                  </h3>
                                  {article.description && (
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                      {article.description}
                                    </p>
                                  )}
                                  <div className="mt-4 flex items-center justify-between">
                                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-4">
                                      <div className="flex items-center">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {formatDate(article.pub_date)}
                                      </div>
                                      <div className="flex items-center">
                                        <Globe className="h-3 w-3 mr-1" />
                                        {article.source}
                                      </div>
                                    </div>
                                    <a
                                      href={article.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                    >
                                      Lire
                                      <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}