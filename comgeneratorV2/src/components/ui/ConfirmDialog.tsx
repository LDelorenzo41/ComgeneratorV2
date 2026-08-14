// src/components/ui/ConfirmDialog.tsx
// Boîte de confirmation aux couleurs de l'application — remplace les
// confirm() natifs du navigateur.
//
// Accessibilité alignée sur FullScreenViewModal (référence interne) :
// portail, role="dialog", aria-modal, fermeture par Échap, verrouillage du
// défilement, et focus placé sur le bouton d'annulation à l'ouverture (le
// choix le moins destructeur).
//
// Usage via le hook useConfirm() : le confirm() natif étant bloquant et
// renvoyant un booléen, le hook expose la même ergonomie sous forme de
// promesse — `if (await confirm({...})) { ... }`.

import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Libellé du bouton de validation (défaut : « Confirmer ») */
  confirmLabel?: string;
  /** Libellé du bouton d'annulation (défaut : « Annuler ») */
  cancelLabel?: string;
  /** true = action destructrice : bouton rouge (défaut) */
  destructive?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = React.useCallback((result: boolean) => {
    setPending((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  // Échap pour annuler, verrouillage du défilement, focus initial
  React.useEffect(() => {
    if (!pending) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus sur « Annuler » : l'option la moins destructrice
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [pending, close]);

  const value = React.useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => close(false)}
          />

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  pending.destructive === false
                    ? 'bg-blue-100 dark:bg-blue-900/40'
                    : 'bg-red-100 dark:bg-red-900/40'
                }`}>
                  <AlertTriangle className={`w-5 h-5 ${
                    pending.destructive === false
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-red-600 dark:text-red-400'
                  }`} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="confirm-dialog-title" className="text-lg font-bold text-gray-900 dark:text-white">
                    {pending.title}
                  </h3>
                  <p id="confirm-dialog-message" className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                    {pending.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => close(false)}
                  aria-label="Fermer"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  onClick={() => close(true)}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-white transition-colors ${
                    pending.destructive === false
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {pending.confirmLabel ?? 'Confirmer'}
                </button>
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => close(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {pending.cancelLabel ?? 'Annuler'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfirmContext.Provider>
  );
};

/**
 * Retourne une fonction `confirm(options): Promise<boolean>`.
 * Si le provider est absent, on retombe sur le confirm() natif plutôt que
 * de bloquer l'action : une confirmation doit toujours être posée.
 */
export function useConfirm(): ConfirmContextValue['confirm'] {
  const context = React.useContext(ConfirmContext);
  const fallback = React.useCallback(
    (options: ConfirmOptions) => Promise.resolve(window.confirm(options.message)),
    []
  );
  return context?.confirm ?? fallback;
}

export default ConfirmProvider;
