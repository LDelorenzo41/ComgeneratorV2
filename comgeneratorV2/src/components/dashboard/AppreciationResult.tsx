import React from 'react';
import { Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

interface AppreciationResultProps {
  detailed: string;
  summary: string;
}

export function AppreciationResult({ detailed, summary }: AppreciationResultProps) {
  const [copiedDetailed, setCopiedDetailed] = React.useState(false);
  const [copiedSummary, setCopiedSummary] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const { user } = useAuthStore();

  const copyToClipboard = async (text: string, type: 'detailed' | 'summary') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'detailed') {
        setCopiedDetailed(true);
        setTimeout(() => setCopiedDetailed(false), 2000);
      } else {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2000);
      }
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  const handleTagClick = () => {
    if (!user) return;
    setMenuOpen((prev) => !prev);
  };

  const handleSelectTag = (tag: string) => {
    setSelectedTag(tag);
    setMenuOpen(false);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!user || !selectedTag) return;
    try {
      const { error } = await supabase.from('appreciations').insert({
        user_id: user.id,
        detailed,
        summary,
        tag: selectedTag,
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'appréciation:', error);
    } finally {
      setConfirmOpen(false);
      setSelectedTag(null);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Version détaillée</h3>
        <div className="mt-2 p-4 bg-white dark:bg-gray-800 rounded-md shadow relative">
          <p className="text-gray-700 dark:text-gray-300 pr-10">{detailed}</p>
          <button
            onClick={() => copyToClipboard(detailed, 'detailed')}
            className="absolute bottom-4 right-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title="Copier le texte"
          >
            {copiedDetailed ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Version synthétique</h3>
        <div className="mt-2 p-4 bg-white dark:bg-gray-800 rounded-md shadow relative">
          <p className="text-gray-700 dark:text-gray-300 pr-10">{summary}</p>
          <button
            onClick={() => copyToClipboard(summary, 'summary')}
            className="absolute bottom-4 right-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title="Copier le texte"
          >
            {copiedSummary ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
      <div className="relative">
        <button
          onClick={handleTagClick}
          disabled={!user}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
        >
          Taguer
        </button>
        {menuOpen && (
          <div className="absolute z-10 mt-2 w-40 rounded-md shadow-lg bg-white dark:bg-gray-800">
            {['Très bien', 'Bien', 'Moyen', 'Insuffisant'].map((tag) => (
              <button
                key={tag}
                onClick={() => handleSelectTag(tag)}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
      {confirmOpen && selectedTag && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-sm w-full">
            <p className="mb-4 text-gray-800 dark:text-gray-200">
              Confirmer l'enregistrement de cette appréciation avec le tag "{selectedTag}" ?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 dark:text-gray-300"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded-md bg-blue-600 text-white"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}