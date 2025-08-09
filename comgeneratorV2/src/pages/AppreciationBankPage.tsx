import React from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { 
  ClipboardCopy, 
  Trash2, 
  Search, 
  Filter, 
  Calendar,
  Database,
  Target,
  CheckCircle,
  AlertCircle,
  XCircle,
  Star,
  Eye,
  Copy,
  RotateCcw,
  Archive
} from 'lucide-react';

interface Appreciation {
  id: string;
  tag: string;
  created_at: string;
  detailed: string;
  summary?: string;
}

const tagToTitle: Record<string, string> = {
  tres_bien: 'Très bien',
  bien: 'Bien',
  moyen: 'Moyen',
  insuffisant: 'Insuffisant',
};

const tagToColor: Record<string, { bg: string; border: string; icon: React.ReactNode; gradient: string }> = {
  tres_bien: { 
    bg: 'bg-green-50 dark:bg-green-900/20', 
    border: 'border-green-200 dark:border-green-800',
    icon: <CheckCircle className="w-5 h-5 text-green-600" />,
    gradient: 'from-green-500 to-emerald-500'
  },
  bien: { 
    bg: 'bg-blue-50 dark:bg-blue-900/20', 
    border: 'border-blue-200 dark:border-blue-800',
    icon: <Star className="w-5 h-5 text-blue-600" />,
    gradient: 'from-blue-500 to-indigo-500'
  },
  moyen: { 
    bg: 'bg-orange-50 dark:bg-orange-900/20', 
    border: 'border-orange-200 dark:border-orange-800',
    icon: <AlertCircle className="w-5 h-5 text-orange-600" />,
    gradient: 'from-orange-500 to-red-500'
  },
  insuffisant: { 
    bg: 'bg-red-50 dark:bg-red-900/20', 
    border: 'border-red-200 dark:border-red-800',
    icon: <XCircle className="w-5 h-5 text-red-600" />,
    gradient: 'from-red-500 to-pink-500'
  },
};

export function AppreciationBankPage() {
  const { user } = useAuthStore();
  const [appreciations, setAppreciations] = React.useState<Appreciation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedTag, setSelectedTag] = React.useState<string | 'all'>('all');
  const [sortBy, setSortBy] = React.useState<'date' | 'tag'>('date');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());

  const fetchAppreciations = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('appreciations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erreur lors de la récupération des appréciations:", error);
      setLoading(false);
      return;
    }

    setAppreciations(data || []);
    setLoading(false);
  };

  React.useEffect(() => {
    fetchAppreciations();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette appréciation ?')) {
      return;
    }

    const { error } = await supabase
      .from('appreciations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erreur lors de la suppression:", error);
      return;
    }

    setAppreciations((prev) => prev.filter((item) => item.id !== id));
    
    // Success feedback
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 transform translate-x-0';
    successDiv.innerHTML = '🗑️ Appréciation supprimée !';
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.style.transform = 'translateX(100%)';
      successDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(successDiv), 300);
    }, 2000);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      
      // Success feedback
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 transform translate-x-0';
      successDiv.innerHTML = '📋 Appréciation copiée !';
      document.body.appendChild(successDiv);
      
      setTimeout(() => {
        successDiv.style.transform = 'translateX(100%)';
        successDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(successDiv), 300);
      }, 2000);
    } catch (err) {
      console.error("Erreur lors de la copie:", err);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Filtrage et recherche
  const filteredAppreciations = React.useMemo(() => {
    let filtered = appreciations;

    // Filtre par tag
    if (selectedTag !== 'all') {
      filtered = filtered.filter(app => app.tag === selectedTag);
    }

    // Recherche textuelle
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(app => 
        app.detailed.toLowerCase().includes(search) ||
        (app.summary && app.summary.toLowerCase().includes(search)) ||
        tagToTitle[app.tag].toLowerCase().includes(search)
      );
    }

    // Tri
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        return a.tag.localeCompare(b.tag);
      }
    });

    return filtered;
  }, [appreciations, searchTerm, selectedTag, sortBy]);

  // Regroupement par tag pour la vue grid
  const grouped = React.useMemo(() => {
    const groups = {
      tres_bien: [],
      bien: [],
      moyen: [],
      insuffisant: [],
    } as Record<string, Appreciation[]>;

    filteredAppreciations.forEach((app) => {
      if (groups[app.tag]) {
        groups[app.tag].push(app);
      }
    });

    return groups;
  }, [filteredAppreciations]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getTruncatedText = (text: string, maxLength: number = 150) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Database className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Chargement de vos appréciations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header moderne */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Archive className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Ma banque d'appréciations
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Retrouvez et gérez toutes vos appréciations sauvegardées, organisées par niveau de performance
          </p>
          
          {/* Stats */}
          <div className="inline-flex items-center bg-white dark:bg-gray-800 px-6 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <Database className="w-5 h-5 text-purple-500 mr-3" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="font-bold text-purple-600 dark:text-purple-400">{appreciations.length}</span> appréciations sauvegardées
            </span>
          </div>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            
            {/* Recherche */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher dans vos appréciations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
              />
            </div>

            {/* Filtre par tag */}
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value as string | 'all')}
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
            >
              <option value="all">Tous les niveaux</option>
              {Object.entries(tagToTitle).map(([tag, title]) => (
                <option key={tag} value={tag}>{title}</option>
              ))}
            </select>

            {/* Tri */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'tag')}
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
            >
              <option value="date">Trier par date</option>
              <option value="tag">Trier par niveau</option>
            </select>

            {/* Toggle vue */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid' 
                    ? 'bg-white dark:bg-gray-800 text-purple-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Target className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-gray-800 text-purple-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Résultats de recherche */}
          {searchTerm && (
            <div className="mt-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <span className="text-sm text-blue-800 dark:text-blue-200">
                <strong>{filteredAppreciations.length}</strong> résultat(s) pour "{searchTerm}"
              </span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedTag('all');
                }}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Contenu principal */}
        {filteredAppreciations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Archive className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'Aucun résultat' : 'Aucune appréciation'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchTerm 
                ? 'Essayez de modifier vos critères de recherche'
                : 'Commencez par générer des appréciations pour les voir apparaître ici'
              }
            </p>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedTag('all');
                }}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          
          /* Vue Grid par catégories */
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8">
            {Object.entries(grouped).map(([tag, items]) => {
              const config = tagToColor[tag];
              if (items.length === 0) return null;
              
              return (
                <div key={tag} className="space-y-4">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className={`w-10 h-10 bg-gradient-to-br ${config.gradient} rounded-xl flex items-center justify-center`}>
                      {config.icon}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {tagToTitle[tag]}
                      <span className="ml-2 text-sm font-normal text-gray-500">({items.length})</span>
                    </h2>
                  </div>
                  
                  <div className="space-y-4">
                    {items.map((app) => (
                      <div
                        key={app.id}
                        className={`${config.bg} ${config.border} border-2 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center space-x-2">
                            {config.icon}
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              {formatDate(app.created_at)}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed mb-4">
                          {expandedItems.has(app.id) ? app.detailed : getTruncatedText(app.detailed)}
                        </p>
                        
                        <div className="flex justify-between items-center">
                          <button
                            onClick={() => toggleExpanded(app.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium"
                          >
                            {expandedItems.has(app.id) ? 'Réduire' : 'Voir plus'}
                          </button>
                          
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleCopy(app.detailed)}
                              className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                              title="Copier"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(app.id)}
                              className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          
          /* Vue Liste */
          <div className="space-y-4">
            {filteredAppreciations.map((app) => {
              const config = tagToColor[app.tag];
              return (
                <div
                  key={app.id}
                  className={`${config.bg} ${config.border} border-2 rounded-2xl p-6 hover:shadow-lg transition-all duration-300`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 bg-gradient-to-br ${config.gradient} rounded-lg flex items-center justify-center`}>
                        {config.icon}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {tagToTitle[app.tag]}
                        </span>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(app.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleCopy(app.detailed)}
                        className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                        title="Copier"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(app.id)}
                        className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                    {expandedItems.has(app.id) ? app.detailed : getTruncatedText(app.detailed, 200)}
                  </p>
                  
                  {app.detailed.length > 200 && (
                    <button
                      onClick={() => toggleExpanded(app.id)}
                      className="mt-3 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium"
                    >
                      {expandedItems.has(app.id) ? 'Réduire' : 'Voir plus'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

