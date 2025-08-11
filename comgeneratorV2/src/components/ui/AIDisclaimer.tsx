import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const AIDisclaimer = () => (
  <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
    <AlertTriangle className="h-3 w-3" />
    <span>Les contenus générés par l'IA sont fournis à titre indicatif et peuvent contenir des imprécisions. Nous vous recommandons de vérifier et d'adapter les résultats selon votre contexte pédagogique.</span>
  </div>
);