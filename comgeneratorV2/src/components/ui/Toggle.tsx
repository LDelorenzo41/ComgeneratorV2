import { Loader2 } from 'lucide-react';

/**
 * Interrupteur à bascule.
 *
 * Le motif était recopié quatre fois — chatbot, scénario, séance,
 * paramètres — avec quatre géométries et deux couleurs différentes. Deux de
 * ces copies étaient identiques au caractère près.
 *
 * Comme le reste du design system, la couleur active vient de l'accent de la
 * page plutôt que d'être écrite en dur : l'interrupteur du corpus
 * documentaire est indigo sur Scénario et bleu sur Séance, sans que les
 * pages aient à le préciser.
 */

const SIZES = {
  /** La taille courante : trois des quatre emplacements d'origine. */
  md: {
    track: 'h-6 w-11 border-2 border-transparent',
    thumb: 'h-5 w-5',
    on: 'translate-x-5',
    off: 'translate-x-0',
  },
  /** Plus généreuse, pour une liste de préférences autonome. */
  lg: {
    track: 'h-7 w-14',
    thumb: 'h-5 w-5',
    on: 'translate-x-8',
    off: 'translate-x-1',
  },
} as const;

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Décrit ce que l'interrupteur commande, pour les lecteurs d'écran. */
  label: string;
  disabled?: boolean;
  /** Affiche un indicateur d'attente et neutralise l'interaction. */
  loading?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  loading = false,
  size = 'md',
  className = '',
}: ToggleProps) {
  const s = SIZES[size];

  return (
    // L'anneau de focus reçoit ici un décalage, contrairement au reste de
    // l'application : collé à la piste, un anneau à l'accent serait invisible
    // sur un interrupteur activé, qui porte déjà cette couleur.
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      className={`focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800
        relative inline-flex flex-shrink-0 items-center rounded-full cursor-pointer
        transition-colors duration-200 ease-in-out
        disabled:opacity-50 disabled:cursor-not-allowed
        ${s.track} ${checked ? 'accent-strong' : 'bg-gray-300 dark:bg-gray-600'} ${className}`}
    >
      <span
        className={`pointer-events-none inline-block transform rounded-full bg-white shadow ring-0
          transition duration-200 ease-in-out ${s.thumb} ${checked ? s.on : s.off}`}
      />
      {loading && (
        <Loader2 className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" />
      )}
    </button>
  );
}
