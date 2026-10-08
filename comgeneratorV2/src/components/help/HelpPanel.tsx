import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeftRight, ChevronLeft, ChevronRight, CircleHelp, X } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { checkIsAdmin } from '../../lib/ragApi';
import { safeStorage } from '../../lib/storage/safeStorage';
import { findHelpTopic } from '../../help/topics';
import { parseTutorial, type Tutorial } from '../../help/parseTutorial';

type Side = 'left' | 'right';

const SIDE_KEY = 'profassist-help-side';
const SEEN_KEY = 'profassist-help-seen';

// Rendu compact du Markdown des tutoriels, pour un panneau étroit
const markdownComponents: Components = {
  h3: ({ children }) => (
    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mt-5 mb-2">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 space-y-1 text-sm text-gray-700 dark:text-gray-300">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 px-3 py-2 border-l-4 border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg [&_p]:mb-0 [&_p+p]:mt-2">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) =>
    href?.startsWith('/') ? (
      <Link to={href} className="font-medium text-blue-600 dark:text-blue-400 underline hover:no-underline">
        {children}
      </Link>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-blue-600 dark:text-blue-400 underline hover:no-underline"
      >
        {children}
      </a>
    ),
  hr: () => <hr className="my-4 border-gray-200 dark:border-gray-700" />,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 px-2 py-1.5">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="align-top text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700/60 px-2 py-1.5">
      {children}
    </td>
  ),
  code: ({ children }) => (
    <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[0.85em]">{children}</code>
  ),
};

/**
 * Aide intégrée : un onglet « Aide » collé au bord de l'écran, sur chaque page
 * qui a un tutoriel (src/help/topics.ts), et un panneau latéral qui l'affiche
 * rubrique par rubrique.
 *
 * Le panneau ne bloque pas la page : on peut suivre le tutoriel en remplissant
 * le formulaire. Il se superpose à la page au lieu de la rétrécir, ce qui
 * casserait le menu principal sur les écrans de portable ; le choix
 * gauche/droite, mémorisé dans le navigateur, sert à dégager la zone de travail.
 * Purement additif : FEATURES.HELP_PANEL_ENABLED le retire de toutes les pages.
 */
export function HelpPanel() {
  const location = useLocation();
  const { user } = useAuthStore();
  const candidate = React.useMemo(() => findHelpTopic(location.pathname), [location.pathname]);

  // Un brouillon n'est montré qu'au compte administrateur, pour relecture.
  // La vérification n'a lieu que sur une page dont le tutoriel est en brouillon.
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const needsAdminCheck = candidate != null && !candidate.published;
  React.useEffect(() => {
    if (!needsAdminCheck || isAdmin !== null || !user) return;
    let cancelled = false;
    checkIsAdmin(user.id).then((admin) => {
      if (!cancelled) setIsAdmin(admin);
    });
    return () => {
      cancelled = true;
    };
  }, [needsAdminCheck, isAdmin, user]);
  const topic = candidate && (candidate.published || isAdmin === true) ? candidate : undefined;

  const [side, setSide] = React.useState<Side>(() =>
    safeStorage.getItem(SIDE_KEY) === 'left' ? 'left' : 'right'
  );
  const [open, setOpen] = React.useState(false);
  const [seen, setSeen] = React.useState(() => safeStorage.getItem(SEEN_KEY) === '1');
  const [tutorials, setTutorials] = React.useState<Record<string, Tutorial>>({});
  const [failedTopicId, setFailedTopicId] = React.useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);
  const lastSectionIds = React.useRef<Record<string, string>>({});
  const tabRef = React.useRef<HTMLButtonElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Page sans tutoriel : le panneau se referme
  React.useEffect(() => {
    if (!topic) setOpen(false);
  }, [topic]);

  // Téléchargement du tutoriel à la première ouverture sur la page
  React.useEffect(() => {
    if (!open || !topic || tutorials[topic.id] || failedTopicId === topic.id) return;
    let cancelled = false;
    topic
      .load()
      .then((markdown) => {
        if (!cancelled) setTutorials((prev) => ({ ...prev, [topic.id]: parseTutorial(markdown) }));
      })
      .catch(() => {
        if (!cancelled) setFailedTopicId(topic.id);
      });
    return () => {
      cancelled = true;
    };
  }, [open, topic, tutorials, failedTopicId]);

  // Rubrique affichée à l'ouverture : celle que désigne l'adresse de la page,
  // sinon la dernière consultée, sinon la première
  React.useEffect(() => {
    if (!open || !topic) return;
    const params = new URLSearchParams(location.search);
    setActiveSectionId(topic.initialSection?.(params) ?? lastSectionIds.current[topic.id] ?? null);
    contentRef.current?.scrollTo({ top: 0 });
  }, [open, topic, location.search]);

  if (!topic) return null;

  const tutorial = tutorials[topic.id];
  const sections = tutorial?.sections ?? [];
  const currentIndex = Math.max(0, sections.findIndex((s) => s.id === activeSectionId));
  const current = sections[currentIndex];
  const previous = sections[currentIndex - 1];
  const next = sections[currentIndex + 1];
  const isRight = side === 'right';

  const openPanel = () => {
    setOpen(true);
    if (!seen) {
      setSeen(true);
      safeStorage.setItem(SEEN_KEY, '1');
    }
    requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  };

  const closePanel = () => {
    setOpen(false);
    requestAnimationFrame(() => tabRef.current?.focus({ preventScroll: true }));
  };

  const toggleSide = () => {
    const nextSide: Side = isRight ? 'left' : 'right';
    setSide(nextSide);
    safeStorage.setItem(SIDE_KEY, nextSide);
  };

  const selectSection = (id: string) => {
    lastSectionIds.current[topic.id] = id;
    setActiveSectionId(id);
    contentRef.current?.scrollTo({ top: 0 });
  };

  return (
    <>
      {!open && (
        <button
          ref={tabRef}
          type="button"
          onClick={openPanel}
          aria-controls="help-panel"
          aria-expanded="false"
          title={`Aide : ${topic.title}`}
          className={`fixed top-1/2 -translate-y-1/2 ${
            isRight ? 'right-0 rounded-l-xl' : 'left-0 rounded-r-xl'
          } z-40 flex flex-col items-center gap-1.5 px-1.5 py-3 bg-gradient-to-b from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg transition-colors print:hidden`}
        >
          <CircleHelp className="w-4 h-4" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180">
            Aide
          </span>
          {/* Pastille de découverte, jusqu'à la première ouverture */}
          {!seen && (
            <span
              className={`absolute -top-1 ${isRight ? '-left-1' : '-right-1'} flex h-3 w-3`}
              aria-hidden="true"
            >
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white dark:ring-gray-900" />
            </span>
          )}
        </button>
      )}

      <aside
        id="help-panel"
        aria-labelledby="help-panel-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            closePanel();
          }
        }}
        className={`fixed inset-y-0 ${
          isRight ? 'right-0 border-l' : 'left-0 border-r'
        } z-40 flex flex-col w-full sm:w-[400px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-2xl duration-300 ease-out motion-reduce:transition-none print:hidden ${
          // Visibilité immédiate à l'ouverture (le titre doit pouvoir recevoir le
          // focus), différée à la fermeture pour laisser le panneau glisser
          open
            ? 'translate-x-0 visible transition-transform'
            : `${isRight ? 'translate-x-full' : '-translate-x-full'} invisible transition-[transform,visibility]`
        }`}
      >
        {/* En-tête */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <CircleHelp className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-blue-100">
                Aide{!topic.published && ' · Brouillon'}
              </p>
              <h2
                id="help-panel-title"
                ref={titleRef}
                tabIndex={-1}
                className="font-bold leading-tight truncate focus:outline-none"
              >
                {topic.title}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleSide}
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
              title={isRight ? "Afficher l'aide à gauche" : "Afficher l'aide à droite"}
              aria-label={isRight ? "Afficher l'aide à gauche" : "Afficher l'aide à droite"}
            >
              <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={closePanel}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
              title="Fermer (Échap)"
              aria-label="Fermer l'aide"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {failedTopicId === topic.id ? (
          <div className="flex-1 px-4 py-6">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              L'aide n'a pas pu être chargée. Rechargez la page pour réessayer, après avoir
              enregistré ou copié votre travail en cours.
            </p>
          </div>
        ) : !tutorial ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            Chargement de l'aide…
          </div>
        ) : (
          <>
            {tutorial.intro && (
              <div className="shrink-0 px-4 pt-3 [&_p]:mb-0 [&_p]:text-gray-600 dark:[&_p]:text-gray-400">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {tutorial.intro}
                </ReactMarkdown>
              </div>
            )}

            {/* Menu des rubriques de la page */}
            {sections.length > 1 && (
              <nav
                aria-label="Rubriques de l'aide"
                className="shrink-0 flex flex-wrap gap-1.5 px-4 py-3 border-b border-gray-200 dark:border-gray-700"
              >
                {sections.map((section) => {
                  const isActive = section.id === current?.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => selectSection(section.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            )}

            <div ref={contentRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {current && (
                <>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">{current.title}</h3>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {current.content}
                  </ReactMarkdown>
                </>
              )}
            </div>

            {sections.length > 1 && (
              <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                {previous ? (
                  <button
                    type="button"
                    onClick={() => selectSection(previous.id)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    Précédent
                  </button>
                ) : (
                  <span />
                )}
                {next && (
                  <button
                    type="button"
                    onClick={() => selectSection(next.id)}
                    className="inline-flex items-center gap-1 min-w-0 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    <span className="truncate">Suivant : {next.title}</span>
                    <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}
