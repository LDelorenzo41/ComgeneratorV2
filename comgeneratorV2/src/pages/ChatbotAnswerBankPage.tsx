import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import {
  Search,
  Filter,
  Calendar,
  Copy,
  Trash2,
  Edit3,
  RotateCcw,
  MessageSquare,
  FileText,
  BookOpen,
  Tag,
  GraduationCap,
  Target,
  X,
  Save,
  Bot
} from 'lucide-react';
import type { ChatbotAnswer, ChatbotAnswerCategory } from '../lib/types';

// Configuration des catégories avec couleurs
const categoryConfig: Record<ChatbotAnswerCategory, { 
  bg: string; 
  text: string; 
  border: string;
  icon: React.ReactNode;
  gradient: string;
}> = {
  'Cadre officiel': {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    icon: <FileText className="w-4 h-4" />,
    gradient: 'from-purple-500 to-indigo-500'
  },
  'Conseil pédagogique': {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: <BookOpen className="w-4 h-4" />,
    gradient: 'from-blue-500 to-cyan-500'
  },
  'Exemple concret': {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    icon: <Tag className="w-4 h-4" />,
    gradient: 'from-green-500 to-emerald-500'
  },
  'Formulation institutionnelle': {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    icon: <GraduationCap className="w-4 h-4" />,
    gradient: 'from-orange-500 to-red-500'
  }
};

export function ChatbotAnswerBankPage() {
  const { user } = useAuthStore();
  const [answers, setAnswers] = useState<ChatbotAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ChatbotAnswerCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'category'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // États pour l'édition
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<ChatbotAnswerCategory>('Conseil pédagogique');
  const [editSubject, setEditSubject] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [saving, setSaving] = useState(false);

  // Charger les réponses
  const fetchAnswers = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('chatbot_answers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erreur lors de la récupération des réponses:", error);
      setLoading(false);
      return;
    }

    setAnswers((data || []) as ChatbotAnswer[]);

    setLoading(false);
  };

  useEffect(() => {
    fetchAnswers();
  }, [user]);

  // Supprimer une réponse
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${title}" ?`)) {
      return;
    }

    const { error } = await supabase
      .from('chatbot_answers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erreur lors de la suppression:", error);
      return;
    }

    setAnswers((prev) => prev.filter((item) => item.id !== id));
    
    // Notification
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl shadow-lg z-50';
    successDiv.innerHTML = '🗑️ Réponse supprimée !';
    document.body.appendChild(successDiv);
    setTimeout(() => {
      successDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(successDiv), 300);
    }, 2000);
  };

  // Copier une réponse
  const handleCopy = async (content: string, title: string) => {
    try {
      await navigator.clipboard.writeText(content);
      
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50';
      successDiv.innerHTML = `📋 "${title}" copiée !`;
      document.body.appendChild(successDiv);
      setTimeout(() => {
        successDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(successDiv), 300);
      }, 2000);
    } catch (err) {
      console.error("Erreur lors de la copie:", err);
    }
  };

  // Démarrer l'édition
  const startEdit = (answer: ChatbotAnswer) => {
    setEditingId(answer.id);
    setEditTitle(answer.title);
    setEditContent(answer.content);
    setEditCategory(answer.category);
    setEditSubject(answer.subject || '');
    setEditLevel(answer.level || '');
  };

  // Annuler l'édition
  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditCategory('Conseil pédagogique');
    setEditSubject('');
    setEditLevel('');
  };

  // Sauvegarder l'édition
  const saveEdit = async () => {
    if (!editingId || !editTitle.trim() || !editContent.trim()) return;

    setSaving(true);
    const { error } = await supabase
      .from('chatbot_answers')
      .update({
        title: editTitle.trim(),
        content: editContent.trim(),
        category: editCategory,
        subject: editSubject.trim() || null,
        level: editLevel.trim() || null
      })
      .eq('id', editingId);

    setSaving(false);

    if (error) {
      console.error("Erreur lors de la modification:", error);
      return;
    }

    // Mettre à jour localement
    setAnswers((prev) => prev.map((a) => 
      a.id === editingId 
        ? { ...a, title: editTitle.trim(), content: editContent.trim(), category: editCategory, subject: editSubject.trim() || null, level: editLevel.trim() || null }
        : a
    ));

    cancelEdit();

    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-xl shadow-lg z-50';
    successDiv.innerHTML = '✏️ Réponse modifiée !';
    document.body.appendChild(successDiv);
    setTimeout(() => {
      successDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(successDiv), 300);
    }, 2000);
  };

  // Toggle expand
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
  const filteredAnswers = useMemo(() => {
    let filtered = answers;

    // Filtre par catégorie
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(a => a.category === selectedCategory);
    }

    // Recherche textuelle
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(search) ||
        a.content.toLowerCase().includes(search) ||
        a.category.toLowerCase().includes(search) ||
        (a.subject && a.subject.toLowerCase().includes(search)) ||
        (a.level && a.level.toLowerCase().includes(search))
      );
    }

    // Tri
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        return a.category.localeCompare(b.category);
      }
    });

    return filtered;
  }, [answers, searchTerm, selectedCategory, sortBy]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getTruncatedText = (text: string, maxLength: number = 200) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Chargement de vos réponses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Ma banque de réponses
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Retrouvez et gérez toutes vos réponses IA sauvegardées depuis le chatbot
          </p>
          
          {/* Stats */}
          <div className="inline-flex items-center bg-white dark:bg-gray-800 px-6 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <Bot className="w-5 h-5 text-blue-500 mr-3" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="font-bold text-blue-600 dark:text-blue-400">{answers.length}</span> réponses sauvegardées
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
                placeholder="Rechercher dans vos réponses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filtre par catégorie */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as ChatbotAnswerCategory | 'all')}
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="all">Toutes les catégories</option>
              {Object.keys(categoryConfig).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Tri */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'category')}
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="date">Trier par date</option>
              <option value="category">Trier par catégorie</option>
            </select>

            {/* Toggle vue */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Target className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Résultats */}
          {(searchTerm || selectedCategory !== 'all') && (
            <div className="mt-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <span className="text-sm text-blue-800 dark:text-blue-200">
                <strong>{filteredAnswers.length}</strong> résultat(s)
                {searchTerm && ` pour "${searchTerm}"`}
                {selectedCategory !== 'all' && ` dans "${selectedCategory}"`}
              </span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Contenu principal */}
        {filteredAnswers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {searchTerm || selectedCategory !== 'all' ? 'Aucun résultat' : 'Aucune réponse sauvegardée'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchTerm || selectedCategory !== 'all'
                ? 'Essayez de modifier vos critères de recherche'
                : 'Utilisez le chatbot et cliquez sur "Mettre en banque" pour sauvegarder des réponses'
              }
            </p>
            {(searchTerm || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-4'}>
            {filteredAnswers.map((answer) => {
              const config = categoryConfig[answer.category];
              const isEditing = editingId === answer.id;

              return (
                <div
                  key={answer.id}
                  className={`${config.bg} ${config.border} border-2 rounded-2xl p-6 hover:shadow-lg transition-all`}
                >
                  {isEditing ? (
                    // Mode édition
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                        placeholder="Titre"
                      />
                      
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as ChatbotAnswerCategory)}
                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        {Object.keys(categoryConfig).map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>

                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={6}
                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none"
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          className="px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="Matière (optionnel)"
                        />
                        <input
                          type="text"
                          value={editLevel}
                          onChange={(e) => setEditLevel(e.target.value)}
                          className="px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="Niveau (optionnel)"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={saving || !editTitle.trim() || !editContent.trim()}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Mode affichage
                    <>
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${config.bg} ${config.text} ${config.border} border`}>
                              {config.icon}
                              {answer.category}
                            </span>
                            {answer.subject && (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-lg">
                                {answer.subject}
                              </span>
                            )}
                            {answer.level && (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-lg">
                                {answer.level}
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {answer.title}
                          </h3>
                        </div>
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 ml-4">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(answer.created_at)}
                        </div>
                      </div>

                      {/* Contenu */}
                      <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed mb-4 whitespace-pre-wrap">
                        {expandedItems.has(answer.id) 
                          ? answer.content 
                          : getTruncatedText(answer.content, viewMode === 'grid' ? 150 : 250)
                        }
                      </p>

                      {/* Actions */}
                      <div className="flex justify-between items-center">
                        {answer.content.length > (viewMode === 'grid' ? 150 : 250) && (
                          <button
                            onClick={() => toggleExpanded(answer.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium"
                          >
                            {expandedItems.has(answer.id) ? 'Réduire' : 'Voir plus'}
                          </button>
                        )}
                        
                        <div className="flex space-x-2 ml-auto">
                          <button
                            onClick={() => handleCopy(answer.content, answer.title)}
                            className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                            title="Copier"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => startEdit(answer)}
                            className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                            title="Modifier"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(answer.id, answer.title)}
                            className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
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

export default ChatbotAnswerBankPage;
