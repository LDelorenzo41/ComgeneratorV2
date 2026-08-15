import * as React from 'react';

/**
 * Comportement clavier et focus d'une boîte de dialogue.
 *
 * Sur les neuf modales de l'application, deux seulement se comportaient
 * correctement — `ConfirmDialog` et `FullScreenViewModal`. Les sept autres
 * ne fermaient pas à la touche Échap, laissaient la page défiler derrière
 * elles, et surtout laissaient le focus s'échapper : en tabulant, on
 * parcourait la page masquée sans jamais voir où l'on était.
 *
 * Ce hook n'impose aucune apparence. Il ne s'occupe que de ce qui manquait,
 * pour que chaque modale garde sa mise en page.
 *
 * Utilisation : poser la référence retournée sur le panneau de la modale,
 * avec `role="dialog"`, `aria-modal="true"`, un `aria-labelledby` pointant
 * sur son titre, et `tabIndex={-1}` pour que le panneau puisse recevoir le
 * focus quand il ne contient aucun élément focusable.
 */

/** Ce qu'un navigateur considère comme atteignable au clavier. */
const FOCUSABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface Options {
  isOpen: boolean;
  onClose: () => void;
  /** À passer à false pour une modale qu'Échap ne doit pas fermer. */
  closeOnEscape?: boolean;
}

export function useModalBehavior<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  closeOnEscape = true,
}: Options) {
  const ref = React.useRef<T>(null);

  // `onClose` est souvent une fonction recréée à chaque rendu. On la garde
  // dans une référence pour ne pas réinstaller les écouteurs à chaque fois.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen) return;

    const elementPrecedent = document.activeElement as HTMLElement | null;
    const debordementPrecedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Recalculé à chaque tabulation : le contenu d'une modale change
    // (champs qui apparaissent, boutons qui se désactivent pendant un envoi).
    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLES) ?? [])
        .filter((el) => el.offsetParent !== null);

    // Différé d'un tour : au premier rendu le panneau n'est pas encore posé.
    const minuteur = window.setTimeout(() => {
      const [premier] = focusables();
      (premier ?? ref.current)?.focus();
    }, 0);

    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;

      const liste = focusables();
      if (liste.length === 0) {
        e.preventDefault();
        return;
      }

      const premier = liste[0];
      const dernier = liste[liste.length - 1];
      const actif = document.activeElement;
      const dehors = !ref.current.contains(actif);

      // On referme la boucle aux deux extrémités, et on rattrape le focus
      // s'il a réussi à sortir du panneau.
      if (e.shiftKey && (actif === premier || dehors)) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && (actif === dernier || dehors)) {
        e.preventDefault();
        premier.focus();
      }
    };

    document.addEventListener('keydown', auClavier);

    return () => {
      document.removeEventListener('keydown', auClavier);
      document.body.style.overflow = debordementPrecedent;
      window.clearTimeout(minuteur);
      // Rendre le focus à l'élément qui a ouvert la modale : sans cela, il
      // repart au début de la page et l'utilisateur perd sa position.
      elementPrecedent?.focus?.();
    };
  }, [isOpen, closeOnEscape]);

  return ref;
}
