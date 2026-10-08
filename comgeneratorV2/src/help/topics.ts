// src/help/topics.ts
// Registre de l'aide intégrée : quelle page affiche quel tutoriel.
//
// Corriger un tutoriel : modifier son fichier dans tutorials/, sans toucher
// au code. Le texte placé avant le premier titre « ## » sert de présentation ;
// chaque « ## » ouvre une rubrique du menu en haut du panneau. Un titre court
// (un à trois mots) tient mieux dans ce menu.
//
// Publier un tutoriel : passer `published` à true. Tant qu'il vaut false, seul
// le compte administrateur le voit, marqué « Brouillon », pour le relire en
// situation avant sa mise en ligne.

export interface HelpTopic {
  id: string;
  /** Nom de la fonctionnalité, affiché dans l'en-tête du panneau. */
  title: string;
  /** Pages où l'onglet « Aide » apparaît. */
  routes: string[];
  published: boolean;
  /** Le texte n'est téléchargé qu'à la première ouverture du panneau. */
  load: () => Promise<string>;
  /** Rubrique à ouvrir d'emblée selon l'adresse de la page. */
  initialSection?: (params: URLSearchParams) => string | undefined;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'mon-espace',
    title: 'Mon espace',
    routes: ['/mon-espace'],
    published: false,
    load: () => import('./tutorials/mon-espace.md?raw').then((m) => m.default),
  },
  {
    id: 'appreciations',
    title: 'Appréciations',
    routes: ['/dashboard'],
    published: true,
    load: () => import('./tutorials/appreciations.md?raw').then((m) => m.default),
  },
  {
    id: 'banque-appreciations',
    title: "Banque d'appréciations",
    routes: ['/appreciation-bank', '/my-appreciations'],
    published: false,
    load: () => import('./tutorials/banque-appreciations.md?raw').then((m) => m.default),
  },
  {
    id: 'synthese',
    title: 'Synthèse de bulletin',
    routes: ['/synthese'],
    published: false,
    load: () => import('./tutorials/synthese.md?raw').then((m) => m.default),
  },
  {
    id: 'seance',
    title: 'Créer une séance',
    routes: ['/generate-lesson'],
    published: true,
    load: () => import('./tutorials/seance.md?raw').then((m) => m.default),
  },
  {
    id: 'banque-seances',
    title: 'Banque de séances',
    routes: ['/lessons-bank'],
    published: true,
    load: () => import('./tutorials/banque-seances.md?raw').then((m) => m.default),
  },
  {
    id: 'scenario',
    title: 'Scénario pédagogique',
    routes: ['/scenario-pedagogique'],
    published: false,
    load: () => import('./tutorials/scenario.md?raw').then((m) => m.default),
  },
  {
    id: 'banque-scenarios',
    title: 'Banque de scénarios',
    routes: ['/scenarios-bank'],
    published: false,
    load: () => import('./tutorials/banque-scenarios.md?raw').then((m) => m.default),
  },
  {
    id: 'communication',
    title: 'Communication',
    routes: ['/communication'],
    published: false,
    load: () => import('./tutorials/communication.md?raw').then((m) => m.default),
    // Les liens du menu « Communiquer » ouvrent la page en mode écriture ou réponse
    initialSection: (params) => {
      const mode = params.get('mode');
      if (mode === 'create') return 'ecrire';
      if (mode === 'reply') return 'repondre';
      return undefined;
    },
  },
  {
    id: 'ressources',
    title: 'Ressources pédagogiques',
    routes: ['/resources'],
    published: false,
    load: () => import('./tutorials/ressources.md?raw').then((m) => m.default),
  },
  {
    id: 'parametres',
    title: 'Paramètres',
    routes: ['/settings'],
    published: false,
    load: () => import('./tutorials/parametres.md?raw').then((m) => m.default),
  },
];

export function findHelpTopic(pathname: string): HelpTopic | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  return HELP_TOPICS.find((topic) => topic.routes.includes(path));
}
