// src/components/ui/Toast.tsx
// Système de notifications unifié (toasts) — remplace les toasts fabriqués
// à la main en document.createElement dans les pages.
//
// Apports par rapport aux toasts maison :
// - annoncés aux lecteurs d'écran (région aria-live)
// - empilables, refermables, disparition automatique
// - positionnés sous l'en-tête et centrés sur mobile (les toasts maison en
//   `top-4 right-4` pouvaient recouvrir le menu)
// - une seule implémentation à corriger au lieu d'une par page

import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  /** Affiche un toast (succès par défaut) */
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

const VARIANT_STYLES: Record<ToastVariant, { wrapper: string; Icon: typeof CheckCircle }> = {
  success: {
    wrapper: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white',
    Icon: CheckCircle,
  },
  error: {
    wrapper: 'bg-gradient-to-r from-red-600 to-rose-600 text-white',
    Icon: AlertCircle,
  },
  info: {
    wrapper: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
    Icon: Info,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = React.useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, variant }]);
    window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  const value = React.useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 w-[92vw] max-w-md pointer-events-none"
          role="status"
          aria-live="polite"
        >
          {toasts.map(({ id, message, variant }) => {
            const { wrapper, Icon } = VARIANT_STYLES[variant];
            return (
              <div
                key={id}
                className={`pointer-events-auto w-full flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg ${wrapper}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium flex-1">{message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(id)}
                  aria-label="Fermer la notification"
                  className="flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

/**
 * Accès aux notifications. Si le provider est absent (composant monté hors
 * de l'arbre applicatif), l'appel est silencieusement ignoré plutôt que de
 * lever une erreur : une notification manquante ne doit jamais casser une
 * fonctionnalité.
 */
export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  const fallback = React.useMemo<ToastContextValue>(
    () => ({
      showToast: (message: string) => console.warn('[Toast] Provider absent :', message),
    }),
    []
  );
  return context ?? fallback;
}

export default ToastProvider;
