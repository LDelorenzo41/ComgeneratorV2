import React from 'react';
import { Copy, Check } from 'lucide-react';

interface AppreciationResultProps {
  detailed: string;
  summary: string;
}

export function AppreciationResult({ detailed, summary }: AppreciationResultProps) {
  const [copiedDetailed, setCopiedDetailed] = React.useState(false);
  const [copiedSummary, setCopiedSummary] = React.useState(false);

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
    </div>
  );
}