import defaultTheme from 'tailwindcss/defaultTheme';
import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      /**
       * Couleur de marque.
       *
       * `primary` reprend EXACTEMENT l'échelle `blue` de Tailwind, qui est
       * l'accent dominant de l'application (from-blue-600 : 46 occurrences,
       * focus:ring-blue-500 : 82 occurrences).
       *
       * Conséquence voulue : `bg-primary-600` rend au pixel près comme
       * `bg-blue-600`. Migrer une classe `blue-*` vers `primary-*` est donc
       * sans effet visuel, et changer la couleur de marque plus tard ne
       * demandera qu'une seule ligne ici.
       */
      colors: {
        primary: colors.blue,
      },

      /**
       * Rayons sémantiques.
       *
       * On N'ÉCRASE PAS les clés natives (sm/md/lg/xl/2xl/3xl/full) : elles
       * sont utilisées 1 170 fois dans le code et toute redéfinition
       * changerait l'aspect de toute l'application.
       *
       * On ajoute seulement des alias qui NOMMENT les conventions déjà en
       * place, avec les valeurs Tailwind actuelles à l'identique :
       *   control = xl  (0.75rem) — boutons, champs de saisie
       *   panel   = 2xl (1rem)    — encarts, blocs internes
       *   card    = 3xl (1.5rem)  — grandes cartes de page
       *   field   = lg  (0.5rem)  — petits éléments, badges
       */
      borderRadius: {
        control: defaultTheme.borderRadius.xl,
        panel: defaultTheme.borderRadius['2xl'],
        card: defaultTheme.borderRadius['3xl'],
        field: defaultTheme.borderRadius.lg,
      },

      /**
       * Typographie.
       *
       * `sans` est ici la pile système par défaut de Tailwind, recopiée à
       * l'identique : aucun changement de rendu aujourd'hui. L'intérêt est
       * de rendre le point d'entrée explicite — installer une police de
       * marque plus tard se fera en ajoutant une entrée en tête de liste,
       * sans toucher au reste du code.
       */
      fontFamily: {
        sans: [...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
