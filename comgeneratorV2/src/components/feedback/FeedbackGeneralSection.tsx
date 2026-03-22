import React from 'react';
import { StarRating } from './StarRating';
import { useFeedbackStore } from '../../lib/feedbackStore';
import { GENERAL_RATING_QUESTIONS } from '../../types/feedback';

export function FeedbackGeneralSection() {
  const { ratings, setRating, comments, setComment, generalTexts, setGeneralText } = useFeedbackStore();
  const section = 'general';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Satisfaction Générale</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Votre avis global sur ProfAssist et vos suggestions pour l'améliorer.
        </p>
      </div>

      <div className="space-y-2">
        {GENERAL_RATING_QUESTIONS.map((q) => (
          <StarRating
            key={q.key}
            label={q.label}
            value={ratings[section]?.[q.key] || 0}
            onChange={(val) => setRating(section, q.key, val)}
          />
        ))}
      </div>

      <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Quelle est votre fonctionnalité préférée ?
          </label>
          <textarea
            value={generalTexts.fonctionnalite_preferee}
            onChange={(e) => setGeneralText('fonctionnalite_preferee', e.target.value)}
            placeholder="La fonctionnalité que vous utilisez le plus ou qui vous plaît le plus..."
            rows={2}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Quelle fonctionnalité aimeriez-vous voir ajoutée ?
          </label>
          <textarea
            value={generalTexts.fonctionnalite_manquante}
            onChange={(e) => setGeneralText('fonctionnalite_manquante', e.target.value)}
            placeholder="Une idée de fonctionnalité qui vous manque..."
            rows={2}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Avez-vous rencontré des bugs ou problèmes techniques ?
          </label>
          <textarea
            value={generalTexts.bugs}
            onChange={(e) => setGeneralText('bugs', e.target.value)}
            placeholder="Décrivez les bugs ou dysfonctionnements rencontrés..."
            rows={2}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Autres commentaires, suggestions ou remarques :
          </label>
          <textarea
            value={generalTexts.commentaire_final || comments[section] || ''}
            onChange={(e) => {
              setGeneralText('commentaire_final', e.target.value);
              setComment(section, e.target.value);
            }}
            placeholder="Tout ce que vous souhaitez nous dire..."
            rows={3}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
