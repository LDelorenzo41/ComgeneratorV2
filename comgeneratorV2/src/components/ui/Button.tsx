import React from 'react';

/**
 * Bouton d'action principal de ProfAssist.
 *
 * Ce composant reproduit à l'identique le bouton réellement affiché dans
 * l'application : un bouton à dégradé horizontal qui, au survol, se recouvre
 * d'un second dégradé plus foncé balayant de la gauche vers la droite.
 *
 * Le motif était copié-collé 15 fois dans 6 fichiers. Les classes ci-dessous
 * en sont la reprise mot pour mot — l'objectif est qu'aucun écran ne change
 * d'aspect.
 *
 * Le composant ne rend QUE la carrosserie (enveloppe + calque de survol +
 * conteneur interne). Le contenu — icônes, libellés, indicateurs de
 * chargement — reste défini sur chaque site d'appel, car il diffère partout
 * et c'est ce qui garantit un rendu inchangé.
 */

type Variant =
  | 'blue'
  | 'green'
  | 'indigo'
  | 'purple'
  | 'gray'
  | 'softGray'
  | 'softBlue';

interface VariantStyle {
  /** Dégradé de fond, couleur du texte, ombre et bordure éventuelles. */
  surface: string;
  /** Dégradé du calque qui balaie le bouton au survol. */
  overlay: string;
}

/**
 * Les 7 déclinaisons relevées dans le code.
 *
 * Les cinq premières sont « pleines » : texte blanc, ombre portée dès le
 * repos. Les deux dernières sont « douces » : fond clair, texte coloré,
 * bordure de 2 px, ombre uniquement au survol.
 *
 * Ces chaînes doivent rester écrites en toutes lettres : Tailwind analyse le
 * code source pour décider quelles classes générer et ne sait pas résoudre
 * une classe construite dynamiquement.
 */
const VARIANTS: Record<Variant, VariantStyle> = {
  blue: {
    surface: 'from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl',
    overlay: 'from-blue-700 to-indigo-700',
  },
  green: {
    surface: 'from-green-600 to-emerald-600 text-white shadow-lg hover:shadow-xl',
    overlay: 'from-green-700 to-emerald-700',
  },
  indigo: {
    surface: 'from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl',
    overlay: 'from-indigo-700 to-purple-700',
  },
  purple: {
    surface: 'from-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl',
    overlay: 'from-purple-700 to-pink-700',
  },
  gray: {
    surface: 'from-gray-500 to-gray-600 text-white shadow-lg hover:shadow-xl',
    overlay: 'from-gray-600 to-gray-700',
  },
  softGray: {
    surface:
      'from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:shadow-lg',
    overlay: 'from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-500',
  },
  softBlue: {
    surface:
      'from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border-2 border-blue-200 dark:border-blue-800 hover:shadow-lg',
    overlay: 'from-blue-200 to-indigo-200 dark:from-blue-800 dark:to-indigo-800',
  },
};

/** `control` = rounded-xl (14 boutons sur 15), `pill` = rounded-full. */
const SHAPES = {
  control: 'rounded-xl',
  pill: 'rounded-full',
} as const;

/** Mouvement au survol. `raise` est la norme, `zoom` sert à la modale d'offre. */
const LIFTS = {
  raise: 'transform hover:-translate-y-1',
  zoom: 'transform hover:scale-105',
  none: '',
} as const;

/** `default` = py-4 px-8 (14 boutons sur 15), `compact` = py-4 px-6. */
const PADDINGS = {
  default: 'py-4 px-8',
  compact: 'py-4 px-6',
} as const;

/**
 * Classes communes à tous les boutons.
 *
 * Les règles `disabled:` sont appliquées systématiquement, alors que le code
 * d'origine ne les portait que sur 8 boutons sur 15. C'est sans effet visuel :
 * elles ne s'activent que si le bouton reçoit `disabled`, ce qui n'arrive
 * jamais sur les 7 autres.
 */
const BASE =
  'group relative overflow-hidden bg-gradient-to-r font-bold transition-all duration-300 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  shape?: keyof typeof SHAPES;
  lift?: keyof typeof LIFTS;
  padding?: keyof typeof PADDINGS;
  /** Classes du conteneur interne, p. ex. `gap-2` pour espacer icône et texte. */
  contentClassName?: string;
}

export function Button({
  variant = 'blue',
  shape = 'control',
  lift = 'raise',
  padding = 'default',
  contentClassName = '',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const style = VARIANTS[variant];

  return (
    // `type` n'a volontairement pas de valeur par défaut : plusieurs de ces
    // boutons sont dans un <form> et s'appuient sur le type `submit` implicite
    // du navigateur. En imposer un ici changerait leur comportement.
    <button
      className={`${BASE} ${style.surface} ${PADDINGS[padding]} ${SHAPES[shape]} ${LIFTS[lift]} ${className}`}
      {...props}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-r ${style.overlay} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`}
      />
      <span className={`relative flex items-center justify-center ${contentClassName}`}>
        {children}
      </span>
    </button>
  );
}
