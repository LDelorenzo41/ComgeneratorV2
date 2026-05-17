import React from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2 } from 'lucide-react';

interface FullScreenViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Modale de lecture "format classique" : affichage large et lisible d'une
 * séance / d'un scénario, en complément des aperçus existants.
 * Purement additif — n'altère aucun affichage existant.
 */
export const FullScreenViewModal: React.FC<FullScreenViewModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Fond cliquable pour fermer */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Conteneur de la modale */}
      <div className="relative z-10 flex flex-col w-[96vw] max-w-6xl max-h-[94vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-5 sm:px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Maximize2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold truncate">{title}</h3>
              {subtitle && (
                <p className="text-blue-100 text-xs sm:text-sm truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl font-medium transition-colors"
            title="Fermer (Échap)"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline text-sm">Fermer</span>
          </button>
        </div>

        {/* Contenu défilant pleine largeur */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 p-5 sm:p-8">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FullScreenViewModal;
