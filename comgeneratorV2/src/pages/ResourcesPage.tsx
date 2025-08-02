import React from 'react';
import { useAuthStore } from '../lib/store';
import { Article } from '../lib/types';
import { ExternalLink, RefreshCw, AlertCircle, Newspaper } from 'lucide-react';
import { supabase } from '../lib/supabase';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callEdgeFunction = async () => {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-rss`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Impossible de contacter le serveur. Veuillez vérifier votre connexion internet.');
  }

  return response;
};

export function ResourcesPage() {
  const { user } = useAuthStore();
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [refreshStatus, setRefreshStatus] = React.useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = React.useState<Date | null>(null);

  const fetchArticles = React.useCallback(async (forceRefresh = false) => {
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
          
          // Attendre que les articles soient insérés
          await delay(3000);
        } catch (edgeError: any) {
          console.error('Edge Function error:', edgeError);
          throw edgeError;
        }
      }

      // Récupérer les articles depuis Supabase, triés par date de publication
      const { data: articlesData, error: fetchError } = await supabase
        .from('articles')
        .select('*')
        .order('pub_date', { ascending: false });

      if (fetchError) throw fetchError;

      if (!articlesData || articlesData.length === 0) {
        setArticles([]);
        setRefreshStatus('Aucun article disponible');
      } else {
        // Trier les articles par date de publication
        const sortedArticles = [...articlesData].sort((a, b) => {
          return new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime();
        });
        
        setArticles(sortedArticles);
        setRefreshStatus(`${sortedArticles.length} articles disponibles`);
        if (!lastRefreshTime) {
          setLastRefreshTime(new Date());
        }
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
      if (!error) {
        setTimeout(() => setRefreshStatus(null), 3000);
      }
    }
  }, [lastRefreshTime, error]);

  React.useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleRefresh = () => {
    if (!isRefreshing) {
      setIsRefreshing(true);
      fetchArticles(true);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        throw new Error('Date invalide');
      }
      return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Erreur de formatage de date:', error);
      return 'Date non disponible';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Ressources pédagogiques
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Restez informé des dernières actualités et ressources en éducation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Actualités de l'éducation
              </h2>
              <div className="flex items-center gap-4">
                {refreshStatus && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {refreshStatus}
                  </span>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={loading || isRefreshing}
                  className="flex items-center text-blue-600 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-5 w-5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Actualisation...' : 'Actualiser'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-12">
                <Newspaper className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  Aucun article
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Aucun article n'est disponible pour le moment.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {articles.map((article) => (
                  <article key={article.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                    <div className="flex h-40">
                      {article.image_url && (
                        <div className="flex-shrink-0 w-32">
                          <img
                            src={article.image_url}
                            alt={article.title}
                            className="h-32 w-32 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                            {article.title}
                          </h3>
                          {article.description && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {article.description}
                            </p>
                          )}
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(article.pub_date)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {article.source}
                            </span>
                          </div>
                          <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-sm text-blue-600 hover:text-blue-500"
                          >
                            Lire l'article
                            <ExternalLink className="h-4 w-4 ml-1" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Articles de blog
            </h2>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <p className="text-gray-600 dark:text-gray-400">
                Cette section contiendra bientôt des articles de blog pertinents pour les enseignants.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}