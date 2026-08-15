# Prompt de démarrage — chantier « design system » ProfAssist

*À copier-coller en début de nouvelle conversation. Rédigé le 15/08/2026, à l'issue des chantiers Communication / crédits / notifications.*

---

## Le prompt

```
Contexte projet
---------------
ProfAssist (dépôt LDelorenzo41/ComgeneratorV2) est une application en PRODUCTION
destinée aux enseignants français. Code applicatif dans le sous-dossier
`comgeneratorV2/`. Stack : React 18 + TypeScript + Vite + TailwindCSS, backend
Supabase (Auth, PostgreSQL, Edge Functions en Deno), déploiement Netlify,
paiements Stripe, IA OpenAI et Mistral.

Un audit UX/UI complet existe à la racine : `AUDIT_UX_UI.md`. Le chantier
« design system » correspond à sa section §2.1 (et §6 pour l'identité visuelle).

Contrainte absolue : AUCUNE RÉGRESSION. L'application est utilisée en production.
Chaque changement doit être vérifié, pas supposé.

Méthode de travail attendue
---------------------------
- Développer sur une branche dédiée, committer, pousser ; l'utilisateur merge
  lui-même via GitHub (squash merge). Après chaque merge, repartir de `main`
  (`git checkout -B <branche> origin/main`) puis force-push si nécessaire.
- Avant de modifier : LIRE le code concerné et mesurer l'existant plutôt que de
  se fier à l'audit, qui date de juillet 2026 et dont plusieurs points sont
  déjà corrigés.
- Après chaque modification : comparer le nombre d'erreurs TypeScript AVANT et
  APRÈS (`git stash` / `npx tsc -p tsconfig.app.json --noEmit | grep -c "error TS"`).
  Le projet a 99 erreurs préexistantes, toutes bénignes (imports inutilisés,
  types stricts). Le total doit rester à 99. Lancer `npm run build` (le même
  que Netlify) systématiquement.
- Travailler par lots courts et testables : livrer, laisser l'utilisateur
  tester et merger, puis enchaîner. Ne pas empiler des semaines de travail.
- Signaler honnêtement ce qui est vérifié et ce qui ne l'est pas.

État mesuré du design system (relevé le 15/08/2026)
--------------------------------------------------
1. SOCLE VIDE
   - `tailwind.config.js` : `theme: { extend: {} }`, aucun plugin hors defaults.
   - `src/index.css` : uniquement les 3 directives @tailwind.
   - Aucune couleur de marque, aucun rayon, aucune police déclarés.

2. RAYONS — 6 conventions, 1 170 occurrences
   rounded-lg 413 · rounded-xl 332 · rounded-full 153 · rounded-2xl 139 ·
   rounded-md 95 · rounded-3xl 38

3. FOCUS — 7 couleurs d'anneau
   blue-500 82 · green-500 14 · purple-500 12 · indigo-500 11 ·
   red-500 1 · gray-500 1 · blue-400 1

4. BOUTONS — le composant est orphelin
   - 315 `<button>` bruts dans le code, 0 usage de `<Button>`.
   - `src/components/ui/Button.tsx` produit un bouton bleu plat `rounded-md`
     qui ne correspond à AUCUN bouton réellement affiché.
   - Le vrai bouton est un motif copié-collé 15 fois dans 6 fichiers :
     `group relative overflow-hidden bg-gradient-to-r from-X-600 to-Y-600
     text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl
     transform hover:-translate-y-1 transition-all duration-300` + un div
     interne de sur-dégradé au survol.
   - `hover:-translate-y-1` apparaît 37 fois.

5. COULEURS D'ACCENT — dispersées par page
   from-blue-600 46 · from-blue-500 32 · from-green-500 23 ·
   from-purple-500 18 · from-purple-600 8 · from-red-600 6 ·
   from-orange-500 6 · from-amber-500 6 · from-indigo-600 5 · autres…
   L'audit propose de codifier par PÔLE MÉTIER plutôt que par page, en
   reprenant les pôles déjà présents dans le header et la NavigationUpdateModal :
   Concevoir / Évaluer / Communiquer / Ressources.

6. TYPOGRAPHIE — police système, aucune fonte de marque chargée.

7. COMPOSANTS UI EXISTANTS (`src/components/ui/`)
   - Déjà unifiés et utilisés partout (chantier terminé, NE PAS CASSER) :
     `Toast.tsx` (ToastProvider + useToast) et `ConfirmDialog.tsx`
     (ConfirmProvider + useConfirm). Providers montés dans `App.tsx`.
     Référence d'accessibilité interne : `modals/FullScreenViewModal.tsx`
     (portail, role="dialog", Échap, verrouillage du scroll).
   - Bruts, à faire évoluer : `Button.tsx` (orphelin), `Input.tsx`,
     `Select.tsx`, `Textarea.tsx` (variantes dark: ajoutées récemment).
   - Absents : Card, Badge, Toggle (3+ implémentations de switch dans le code).

Périmètre proposé (à confirmer avec l'utilisateur)
-------------------------------------------------
Option A — Socle + Button + focus (recommandée)
  1. `tailwind.config.js` : couleur `primary` (l'indigo/bleu des dégradés
     actuels), échelle de rayons, éventuelle police.
  2. Réécrire `Button.tsx` pour qu'il PRODUISE le bouton réellement affiché
     (variantes primary / secondary / danger / ghost, tailles sm/md/lg,
     état loading déjà présent).
  3. Migrer les 15 copiés-collés du motif dégradé vers ce composant, à rendu
     visuel IDENTIQUE — c'est le critère d'acceptation.
  4. Unifier l'anneau de focus via une classe utilitaire dans `index.css`.
  Aucun écran ne doit changer d'aspect.

Option B — Socle seul, sans migration
  Poser le vocabulaire (couleurs, rayons, utilitaire de focus) sans rien
  migrer. Risque nul, effet immédiat nul, sert aux développements futurs.

Option C — Tout, couleurs par pôle comprises
  Option A + refonte des couleurs par pôle métier + police de marque.
  Changement visuel assumé sur toutes les pages.

Points de vigilance
-------------------
- Le dark mode est quasi exhaustif dans l'app : toute nouvelle classe doit
  avoir sa variante `dark:`.
- `darkMode: 'class'` est déjà configuré, ne pas y toucher.
- Les composants `Toast` et `ConfirmDialog` viennent d'être livrés et testés :
  les intégrer au design system sans modifier leur comportement.
- Le fichier `src/pages/CommunicationPage.tsx` (~1 000 lignes) et
  `src/pages/LessonGeneratorPage.tsx` (~1 400 lignes) sont les plus lourds ;
  y aller prudemment.
- Ne PAS toucher aux Edge Functions (`comgeneratorV2/supabase/functions/`) :
  hors périmètre.

Première tâche demandée
-----------------------
Confirmer le périmètre avec moi (option A, B ou C), puis livrer un premier lot
testable. Commence par mesurer l'existant toi-même pour valider ou corriger les
chiffres ci-dessus avant de proposer quoi que ce soit.
```

---

## Ce qui a été fait avant ce chantier (pour information)

Chantiers terminés et mergés dans `main` au 15/08/2026 :

1. **Communication** — refonte du parcours : intention séparée du destinataire
   (message / rapport d'incident / dossier de commission), objet séparé du corps,
   retouches en un clic (plus court / plus chaleureux / plus ferme), régénération,
   ouverture dans la messagerie, rendu markdown et export PDF des documents.
2. **Dictée vocale** (Mistral Voxtral) — enregistrement, transcription avec lexique
   Éducation nationale, analyse du brouillon qui pré-remplit le formulaire et
   signale les informations manquantes ; analyse croisée sur les réponses
   (couverture du message reçu).
3. **Crédits** — débit côté serveur pour TOUS les générateurs via `consume_credits`,
   registre `credit_ledger`, garde-fou en base contre l'auto-crédit, plafond de
   requêtes par minute. La faille de génération gratuite est fermée.
4. **Notifications** — Toast et ConfirmDialog unifiés et accessibles, 34 boîtes
   natives et 12 toasts maison supprimés.
5. **Correctifs UX** — lien mort retiré, `console.log` exclus du bundle de
   production (identifiants et Price IDs Stripe y transitaient).

Restent au plan, hors design system : accessibilité RGAA (labels non associés,
toggles sans `role="switch"`), terminologie « tokens » → « crédits », et l'import
d'enregistrement audio long (réunion → compte rendu).
