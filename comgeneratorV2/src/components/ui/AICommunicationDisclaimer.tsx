import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const AICommunicationDisclaimer = () => (
  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 mb-4">
    <AlertTriangle className="h-3 w-3" />
    <span>L'IA peut commettre des erreurs. Pensez à relire et adapter votre réponse avant envoi.</span>
  </div>
);