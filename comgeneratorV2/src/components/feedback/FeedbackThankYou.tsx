import React from 'react';
import { CheckCircle, Heart, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FeedbackThankYou() {
  return (
    <div className="text-center py-12">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
        Merci pour vos retours !
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
        Votre feedback est précieux et nous aidera à améliorer ProfAssist
        pour mieux répondre à vos besoins.
      </p>
      <div className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-6">
        <Gift className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
        <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
          30 000 tokens ont été crédités sur votre compte !
        </span>
      </div>
      <div className="flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-8">
        <Heart className="w-4 h-4 text-red-400" />
        <span>L'équipe ProfAssist</span>
      </div>
      <Link
        to="/landing"
        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}
