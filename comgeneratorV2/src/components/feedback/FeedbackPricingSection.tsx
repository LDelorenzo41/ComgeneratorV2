import React from 'react';
import { StarRating } from './StarRating';
import { useFeedbackStore } from '../../lib/feedbackStore';
import { PRICING_RATING_QUESTIONS } from '../../types/feedback';

export function FeedbackPricingSection() {
  const { ratings, setRating, comments, setComment } = useFeedbackStore();
  const section = 'pricing';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Tarification</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Votre avis sur les tarifs et le système de tokens.
        </p>
      </div>

      <div className="space-y-2">
        {PRICING_RATING_QUESTIONS.map((q) => (
          <StarRating
            key={q.key}
            label={q.label}
            value={ratings[section]?.[q.key] || 0}
            onChange={(val) => setRating(section, q.key, val)}
          />
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Commentaires sur la tarification, le système de tokens ou les offres :
        </label>
        <textarea
          value={comments[section] || ''}
          onChange={(e) => setComment(section, e.target.value)}
          placeholder="Vos retours sur les prix..."
          rows={3}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}
