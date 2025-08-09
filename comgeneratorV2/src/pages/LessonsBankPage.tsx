import React from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import ReactMarkdown from 'react-markdown';
import { 
  BookOpen, 
  Search, 
  Filter, 
  Calendar,
  Clock,
  Users,
  Target,
  Copy,
  FileDown,
  Trash2,
  Eye,
  RotateCcw,
  Archive,
  Sparkles,
  Settings,
  CheckCircle
} from 'lucide-react';

type LessonBank = {
  id: string;
  subject: string;
  topic: string;
  level: string;
  pedagogy_type: string;
  duration: number;
  content: string;
  created_at: string;
};

const tagColors = {
  subject: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-200', border: 'border-blue-200 dark:border-blue-800' },
  level: { bg: 'bg-gray-50 dark:bg-gray-900/20', text: 'text-gray-700 dark:text-gray-200', border: 'border-gray-200 dark:border-gray-800' },
  pedagogy: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-200', border: 'border-green-200 dark:border-green-800' },
  duration: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-200', border: 'border-orange-200 dark:border-orange-800' }
};

export function LessonsBankPage() {
  const { user } = useAuthStore();
  const [lessons, setLessons] = React.useState<LessonBank[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<'date' | 'subject' | 'duration'>('date');
  const [filterSubject, setFilterSubject] = React.useState<string>('all');
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

  React.useEffect(() => {
    const fetchLessons = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('lessons_bank')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) setLessons(data);
      setLoading(false);
    };
    fetchLessons();
  }, [user]);

  const handleCopy = async (content: string, topic: string) => {
    try {
      await navigator.clipboard.writeText(content);
      
      // Success feedback
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 transform translate-x-0';
      successDiv.innerHTML = `📋 Séance "${topic}" copiée !`;
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

  const handleDelete = async (id: string, topic: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la séance "${topic}" ?`)) {
      return;
    }

    const { error } = await supabase
      .from('lessons_bank')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erreur lors de la suppression:", error);
      return;
    }

    setLessons((prev) => prev.filter((item) => item.id !== id));
    
    // Success feedback
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 transform translate-x-0';
    successDiv.innerHTML = '🗑️ Séance supprimée !';
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.style.transform = 'translateX(100%)';
      successDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(successDiv), 300);
    }, 2000);
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

  // Filtrage et tri
  const filteredLessons = React.useMemo(() => {
    let filtered = lessons;

    // Filtre par recherche textuelle
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((l) =>
        [l.subject, l.topic, l.level, l.pedagogy_type, l.content]
          .join(' ')
          .toLowerCase()
          .includes(searchLower)
      );
    }

    // Filtre par matière
    if (filterSubject !== 'all') {
      filtered = filtered.filter(l => l.subject === filterSubject);
    }

    // Tri
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'subject':
          return a.subject.localeCompare(b.subject);
        case 'duration':
          return b.duration - a.duration;
        default:
          return 0;
      }
    });

    return filtered;
  }, [lessons, search, filterSubject, sortBy]);

  // Extraction des matières uniques pour le filtre
  const uniqueSubjects = React.useMemo(() => {
    const subjects = [...new Set(lessons.map(l => l.subject))];
    return subjects.sort();
  }, [lessons]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTruncatedContent = (content: string, maxLength: number = 300) => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Chargement de vos séances...</p>
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
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Banque de séances
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Retrouvez et gérez toutes vos séances pédagogiques sauvegardées, organisées et recherchables
          </p>
          
          {/* Stats */}
          <div className="inline-flex items-center bg-white dark:bg-gray-800 px-6 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <Archive className="w-5 h-5 text-green-500 mr-3" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="font-bold text-green-600 dark:text-green-400">{lessons.length}</span> séances sauvegardées
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
                placeholder="Rechercher par mot-clé, matière, niveau, pédagogie..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
              />
            </div>

            {/* Filtre par matière */}
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            >
              <option value="all">Toutes les matières</option>
              {uniqueSubjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            {/* Tri */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'subject' | 'duration')}
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            >
              <option value="date">Trier par date</option>
              <option value="subject">Trier par matière</option>
              <option value="duration">Trier par durée</option>
            </select>

            {/* Toggle vue */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid' 
                    ? 'bg-white dark:bg-gray-800 text-green-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Target className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-gray-800 text-green-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Résultats de recherche */}
          {(search || filterSubject !== 'all') && (
            <div className="mt-4 flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <span className="text-sm text-green-800 dark:text-green-200">
                <strong>{filteredLessons.length}</strong> résultat(s) trouvé(s)
                {search && ` pour "${search}"`}
                {filterSubject !== 'all' && ` en ${filterSubject}`}
              </span>
              <button
                onClick={() => {
                  setSearch('');
                  setFilterSubject('all');
                }}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Contenu principal */}
        {filteredLessons.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {search || filterSubject !== 'all' ? 'Aucun résultat' : 'Aucune séance'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {search || filterSubject !== 'all'
                ? 'Essayez de modifier vos critères de recherche'
                : 'Commencez par créer des séances pour les voir apparaître ici'
              }
            </p>
            {(search || filterSubject !== 'all') && (
              <button
                onClick={() => {
                  setSearch('');
                  setFilterSubject('all');
                }}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-6'}`}>
            {filteredLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Header avec tags */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border ${tagColors.subject.bg} ${tagColors.subject.text} ${tagColors.subject.border}`}>
                    <Target className="w-3 h-3 mr-1" />
                    {lesson.subject}
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border ${tagColors.level.bg} ${tagColors.level.text} ${tagColors.level.border}`}>
                    <Users className="w-3 h-3 mr-1" />
                    {lesson.level}
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border ${tagColors.pedagogy.bg} ${tagColors.pedagogy.text} ${tagColors.pedagogy.border}`}>
                    <Settings className="w-3 h-3 mr-1" />
                    {lesson.pedagogy_type}
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border ${tagColors.duration.bg} ${tagColors.duration.text} ${tagColors.duration.border}`}>
                    <Clock className="w-3 h-3 mr-1" />
                    {lesson.duration} min
                  </div>
                </div>

                {/* Titre et date */}
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex-1 mr-4">
                    {lesson.topic}
                  </h2>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(lesson.created_at)}
                  </div>
                </div>

                {/* Contenu */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 rounded-2xl p-4 mb-4">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>
                      {expandedItems.has(lesson.id) 
                        ? lesson.content 
                        : getTruncatedContent(lesson.content, viewMode === 'grid' ? 200 : 300)
                      }
                    </ReactMarkdown>
                  </div>
                  
                  {lesson.content.length > (viewMode === 'grid' ? 200 : 300) && (
                    <button
                      onClick={() => toggleExpanded(lesson.id)}
                      className="mt-3 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium flex items-center"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      {expandedItems.has(lesson.id) ? 'Réduire' : 'Voir plus'}
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Séance complète
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleCopy(lesson.content, lesson.topic)}
                      className="inline-flex items-center px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200"
                      title="Copier la séance"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copier
                    </button>
                    
                    <button
                      onClick={() => handleDelete(lesson.id, lesson.topic)}
                      className="inline-flex items-center px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all duration-200"
                      title="Supprimer la séance"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LessonsBankPage;
