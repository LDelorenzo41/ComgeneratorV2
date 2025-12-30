import React, { useState, useEffect } from 'react';
import { X, Save, Tag, BookOpen, GraduationCap, FileText, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import type { ChatbotAnswerCategory, ChatbotAnswerInsert } from '../../lib/types';

interface SaveAnswerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContent: string;
  onSaved?: () => void;
}

const CATEGORIES: { value: ChatbotAnswerCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'Cadre officiel', label: 'Cadre officiel', icon: <FileText className="w-4 h-4" /> },
  { value: 'Conseil pédagogique', label: 'Conseil pédagogique', icon: <BookOpen className="w-4 h-4" /> },
  { value: 'Exemple concret', label: 'Exemple concret', icon: <Tag className="w-4 h-4" /> },
  { value: 'Formulation institutionnelle', label: 'Formulation institutionnelle', icon: <GraduationCap className="w-4 h-4" /> },
];

export const SaveAnswerModal: React.FC<SaveAnswerModalProps> = ({
  isOpen,
  onClose,
  initialContent,
  onSaved,
}) => {
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(initialContent);
  const [category, setCategory] = useState<ChatbotAnswerCategory>('Conseil pédagogique');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBankAccess, setHasBankAccess] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Vérifier l'accès à la banque au chargement
  useEffect(() => {
    const checkBankAccess = async () => {
      if (!user) {
        setHasBankAccess(false);
        setCheckingAccess(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('has_bank_access')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Erreur vérification accès banque:', error);
          setHasBankAccess(false);
        } else {
          setHasBankAccess(profile?.has_bank_access === true);
        }
      } catch (err) {
        console.error('Erreur:', err);
        setHasBankAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    if (isOpen) {
      checkBankAccess();
    }
  }, [isOpen, user]);

  // Réinitialiser le contenu quand la modal s'ouvre avec un nouveau contenu
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setTitle('');
      setSubject('');
      setLevel('');
      setCategory('Conseil pédagogique');
      setError(null);
    }
  }, [isOpen, initialContent]);

  const handleSave = async () => {
    if (!user) {
      setError('Vous devez être connecté pour sauvegarder');
      return;
    }

    // Vérification de l'accès banque
    if (!hasBankAccess) {
      setError('Vous devez avoir un abonnement avec accès banque pour sauvegarder des réponses');
      return;
    }

    if (!title.trim()) {
      setError('Le titre est obligatoire');
      return;
    }

    if (!content.trim()) {
      setError('Le contenu ne peut pas être vide');
      return;
    }

    setSaving(true);
    setError(null);

    const insertData: ChatbotAnswerInsert & { user_id: string } = {
      user_id: user.id,
      title: title.trim(),
      content: content.trim(),
      category,
      subject: subject.trim() || null,
      level: level.trim() || null,
    };

    const { error: insertError } = await supabase
      .from('chatbot_answers')
      .insert(insertData);

    setSaving(false);

    if (insertError) {
      console.error('Erreur lors de la sauvegarde:', insertError);
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.');
      return;
    }

    // Notification de succès
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300';
    successDiv.innerHTML = '✅ Réponse enregistrée dans votre banque !';
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.style.transform = 'translateX(100%)';
      successDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(successDiv), 300);
    }, 2500);

    onSaved?.();
    onClose();
  };

  const handleBuyAccess = () => {
    window.location.href = '/buy-tokens';
  };

  if (!isOpen) return null;

  // Affichage pendant la vérification de l'accès
  if (checkingAccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Vérification de l'accès...</p>
        </div>
      </div>
    );
  }

  // Affichage si pas d'accès banque
  if (!hasBankAccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Accès banque requis
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-amber-800 dark:text-amber-300 text-sm">
                ⚠️ Pour sauvegarder des réponses dans votre banque personnelle, vous devez disposer d'un abonnement avec accès banque.
              </p>
            </div>
            
            <div className="text-gray-600 dark:text-gray-300 text-sm">
              <p className="mb-2">L'accès banque vous permet de :</p>
              <ul className="list-disc list-inside space-y-1 text-gray-500 dark:text-gray-400">
                <li>Sauvegarder vos appréciations préférées</li>
                <li>Constituer une banque de séances</li>
                <li>Enregistrer les réponses du chatbot</li>
                <li>Réutiliser vos contenus facilement</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleBuyAccess}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
            >
              Obtenir l'accès banque
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Save className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Mettre en banque
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enregistrez cette réponse dans votre banque personnelle
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Erreur */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Titre (obligatoire) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Définition des compétences transversales"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Catégorie <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${
                    category === cat.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contenu (modifiable) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contenu <span className="text-red-500">*</span>
              <span className="font-normal text-gray-500 dark:text-gray-400 ml-2">
                (modifiable avant sauvegarde)
              </span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
            />
          </div>

          {/* Champs optionnels */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Matière <span className="text-gray-400">(optionnel)</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Mathématiques"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Niveau <span className="text-gray-400">(optionnel)</span>
              </label>
              <input
                type="text"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="Ex: Cycle 3"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !content.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveAnswerModal;

