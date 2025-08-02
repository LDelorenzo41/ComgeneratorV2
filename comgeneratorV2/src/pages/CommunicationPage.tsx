import React from 'react';
import { useAuthStore } from '../lib/store';

export function CommunicationPage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Communication
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Générez des communications professionnelles pour différents destinataires
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <p className="text-gray-600 dark:text-gray-400">
            Cette fonctionnalité sera bientôt disponible. Elle vous permettra de générer :
          </p>
          <ul className="mt-4 space-y-2 list-disc list-inside text-gray-600 dark:text-gray-400">
            <li>Des mots pour rendre compte d'incidents</li>
            <li>Des communications aux parents d'élèves</li>
            <li>Des messages au chef d'établissement</li>
            <li>Des communications avec les collègues</li>
          </ul>
        </div>
      </div>
    </div>
  );
}