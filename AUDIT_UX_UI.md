# Audit UX/UI — ProfAssist (ComgeneratorV2)

*Audit réalisé le 12/07/2026 sur l'ensemble du code front (`comgeneratorV2/src`). Objectif : optimiser l'expérience pour le public enseignant, sans aucune régression fonctionnelle. Ce document ne contient que des recommandations — rien n'a été modifié dans le code.*

---

## Résumé exécutif

ProfAssist a des fondations solides : dark mode quasi exhaustif, transparence remarquable sur l'IA (sources citées, notices de contribution, disclaimers), pédagogie du système de tokens (« ≈ 4 caractères », guide de consommation), et des fonctionnalités métier vraiment pensées pour les enseignants (PDF Élève sans corrigés, « Copier thème » scénario→séance, exemples de critères).

Les trois axes d'amélioration majeurs sont :

1. **Cohérence** : l'app est une somme de pages construites indépendamment (3 systèmes de notification, 3 moteurs PDF, 3+ implémentations de switch, 4 conventions de rayons de boutons, couleurs d'accent différentes par page). Il manque un mini design system.
2. **Parcours** : pas de page d'accueil pour l'utilisateur connecté, une confirmation de génération opaque (double-clic), des attentes de 60 s sans progression, des formulaires vidés après génération.
3. **Confiance / conversion** : quelques bugs visibles (bouton mort, coquille, incohérence tokens affichés vs clés Stripe), une landing très longue sans pricing ni preuve sociale réelle, et une terminologie « tokens » ambiguë pour un public non technique.

---

## 1. À corriger en priorité (bugs et risques visibles) — effort faible

Ces points sont des corrections ponctuelles, sans impact fonctionnel, mais très visibles ou risqués :

| # | Problème | Localisation |
|---|----------|--------------|
| 1 | **Libellés de packs (300 000 / 600 000 tokens) ≠ clés Stripe (`…_200K` / `…_400K`)** : risque de livrer/facturer un montant différent de l'affiché. À vérifier d'urgence côté Stripe. | `BuyTokensPage.tsx:47,79,123-126` |
| 2 | Bouton **« Contactez-nous » sans action** (ni `onClick` ni `href`) dans le tunnel d'achat. | `BuyTokensPage.tsx:492` |
| 3 | Coquille visible : « tester **sans sereinement** la fonctionnalité ». | `ScenarioPedagogiquePage.tsx:1146` |
| 4 | Lien « Voir un court tuto vidéo » mort (`href="#"`). | `LessonGeneratorPage.tsx:1290` |
| 5 | **Dark mode absent** sur 3 écrans du parcours d'authentification : `ResetPasswordPage`, `AuthHandler`, `EmailConfirmationGuard` (aucune classe `dark:`) — ils s'affichent en clair même en thème sombre. | fichiers entiers |
| 6 | Dark mode partiel : champs de `SubjectModal` (`:78,117,126`) et encart d'erreur de `SubjectList` (`:202-206`) sans variantes `dark:`. | idem |
| 7 | **Icônes trompeuses** pour le toggle grille/liste : `Target` (cible) = grille, `Filter` (entonnoir) = liste. Remplacer par `LayoutGrid`/`List` (dispo dans lucide-react). Présent sur 3 pages. | `AppreciationBankPage.tsx:307,317`, `LessonsBankPage.tsx:772,782`, `ChatbotAnswerBankPage.tsx:361,371` ; aussi `ArrowLeft` pour « Nouveau scénario » `ScenariosBankPage.tsx:607` |
| 8 | Classe Tailwind inexistante `ml-13` (l'échelle saute de 12 à 14) : indentation du sous-titre chatbot non appliquée. | `ChatbotPage.tsx:578` |
| 9 | **Délai artificiel de 2 s** à chaque chargement des flux RSS (`await delay(2000)`). | `ResourcesPage.tsx:90` |
| 10 | `console.log` de debug en production : Price IDs Stripe + `user.id` (`BuyTokensPage.tsx:131-140`), tokens d'auth (`ResetPasswordPage.tsx:63-78`, `AuthHandler.tsx`), contenu brut de l'API (`ScenarioPedagogiquePage.tsx:654-656`). | multiples |
| 11 | Section « Modèle IA » : `{true && (/* DÉSACTIVÉ */)}` — le commentaire dit désactivé, le code affiche. Trancher (afficher ou masquer) pour éviter les surprises. | `SettingsPage.tsx:191` |
| 12 | Contenus promotionnels périmés (deadline 10/12/2025) : post-it landing + `SpecialOfferModal`. À retirer ou reprogrammer. | `LandingPage.tsx:111`, `SpecialOfferModal.tsx:24` |
| 13 | Incohérences factuelles : « 8 outils » (landing) vs « 6 outils » (register) ; 3 listes de modèles IA contradictoires (ChatGPT / GPT-4.1+GPT-5+Mistral / GPT-4o+Claude+Gemini). | `LandingPage.tsx:241,166,634-636`, `RegisterPage.tsx:88-89`, `FeedbackPage.tsx:30` |
| 14 | FeedbackPage annonce « Vos réponses sont anonymes » alors que l'email est obligatoire. | `FeedbackPage.tsx:263,67-68` |
| 15 | Crash potentiel : `tagToTitle[app.tag].toLowerCase()` si un tag hors nomenclature existe en base (l'autre chemin de sauvegarde écrit des tags libres). | `AppreciationBankPage.tsx:173` |
| 16 | Bouton flottant chatbot : détection de page via `popstate`, incompatible avec la navigation React Router — le bouton peut rester affiché sur `/chatbot` (doublon). | `ChatbotFloatingButton.tsx:145-152` |

---

## 2. Fondations transverses (le plus gros levier qualité)

### 2.1 Créer un mini design system

Constat : `tailwind.config.js` n'a **aucune extension de thème** (couleur de marque, police, rayons), `index.css` est vide, et chaque page a redéfini ses styles. Conséquences mesurées :

- 4 conventions de rayons de boutons (`rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`) selon les écrans ;
- couleurs d'accent différentes par page sans logique lisible (Dashboard bleu, Communication violet, Synthèse vert, Banque violet…) et focus rings assortis qui changent ;
- deux familles de champs (composants UI maison vs `<input>`/`<select>` Tailwind bruts) avec bordures et paddings différents ;
- 3+ implémentations différentes du toggle switch.

**Proposition :**

- Définir dans `tailwind.config.js` : `colors.primary` (le bleu/indigo actuel), une police de marque (voir §6), une échelle de rayons unique (ex. `rounded-xl` pour les boutons, `rounded-2xl` pour les cartes).
- Étendre les composants `ui/` existants (sans casser l'existant) : `Button` (ajouter tailles + variante `danger`), `Input`/`Select`/`Textarea` (utilisés partout), et créer `Toggle`, `Card`, `Badge`, `Modal`, `Toast`, `ConfirmDialog`.
- Migrer page par page vers ces composants (aucun changement fonctionnel, uniquement visuel).
- **Codifier les couleurs par pôle métier** au lieu de couleurs par page : c'est déjà presque le cas (Concevoir / Évaluer / Communiquer / Ressources dans le header et la `NavigationUpdateModal`). Ex. Concevoir = indigo, Évaluer = bleu, Communiquer = violet, Ressources = vert. Chaque page hérite de la couleur de son pôle → l'utilisateur « sait où il est ».

### 2.2 Unifier le feedback utilisateur (toasts, alertes, confirmations)

Constat : trois paradigmes coexistent, parfois sur la même page :
1. encarts inline React ;
2. toasts créés en `document.createElement` injectés dans `document.body` (au moins 8 occurrences : `AppreciationResult`, `CommunicationPage`, `AppreciationBankPage`, `SynthesePage`, `LessonGeneratorPage`, `ScenariosBankPage`, `ChatbotAnswerBankPage`, `SaveAnswerModal`) — fragiles, sans `aria-live`, invisibles aux lecteurs d'écran ;
3. `alert()` / `confirm()` natifs du navigateur pour des actions importantes (suppressions, erreurs de paiement, accès banque) — austères et hors identité visuelle.

**Proposition :** un composant `<Toast>` unique (provider + hook `useToast()`) avec `role="status"`/`aria-live`, et un `<ConfirmDialog>` stylé pour remplacer tous les `confirm()`. C'est le chantier au meilleur ratio effort/impact : une seule brique, ~15 call-sites à migrer, cohérence immédiate.

### 2.3 Clarifier la terminologie « tokens »

Pour un enseignant, « token » est du jargon. Et le mot désigne **deux choses différentes** dans l'app : les crédits de génération (`profiles.tokens`) et les quotas de stockage/import du chatbot bêta (« 100 000 tokens stockés », `ChatbotPage.tsx:342-441`), affichés à quelques pixels l'un de l'autre.

**Proposition :**
- Renommer partout la monnaie de génération en **« crédits »** (le guide « 1 token ≈ 4 caractères » devient « ce que vous pouvez faire avec vos crédits » : ~100 appréciations, ~30 séances… — la traduction en actions concrètes existe déjà sur BuyTokensPage, la généraliser).
- Renommer le quota chatbot en **« espace documentaire »** (avec jauge en Mo ou en pages, pas en tokens).
- Dans le header, afficher une **jauge** plutôt qu'un nombre brut (« ≈ 45 appréciations restantes » au survol). Un nombre comme « 300 000 tokens » ne dit rien ; « il m'en reste beaucoup / peu » est l'info réellement utile.

### 2.4 Fiabiliser la mécanique de crédits

- Rafraîchissement du solde par `window.location.reload()` (Header `:64`, `RedeemCodeModal.tsx:66`) alors qu'un événement `tokensUpdated` existe déjà et est utilisé ailleurs → utiliser l'événement partout, supprimer les rechargements complets.
- Décompte non atomique côté client (`select` puis `update` sur `profiles`, `AppreciationForm.tsx:234-253`) et `usedTokens = 1` codé en dur en Communication (`CommunicationPage.tsx:175,233`) → à terme, débiter côté serveur (fonction Supabase) pour un solde fiable.
- Le chat ne consulte jamais le solde : à 0 crédit, l'utilisateur tape sa question, attend, puis reçoit une erreur brute. L'alerte « Rechargez » (`ChatbotPage.tsx:680-685`) n'a pas de bouton vers `/buy-tokens`. → Bloquer l'envoi en amont avec un message doux + CTA « Recharger ».
- `AppreciationResult.tsx:98,275` : redirection dure `window.location.href = '/buy-tokens'` qui **fait perdre l'appréciation générée** → utiliser la navigation React Router (et idéalement ouvrir dans un nouvel onglet ou conserver l'état).

---

## 3. Architecture de navigation et parcours

### 3.1 Créer une vraie page d'accueil connectée (« Mon espace »)

Constat : il n'existe **aucune page d'accueil pour l'utilisateur connecté**. La racine `/` redirige vers `/landing` (marketing) même connecté, le logo pointe vers `/landing`, et la route nommée `/dashboard` est en réalité… le générateur d'appréciations. L'utilisateur arrive donc toujours « quelque part » sans vue d'ensemble.

**Proposition de design — page « Mon espace » (nouvelle route, aucune suppression) :**
- Salutation (« Bonjour Lionel ! ») + jauge de crédits + raccourci recharge.
- **4 grandes cartes d'action** reprenant les pôles du header : Concevoir / Évaluer / Communiquer / Ressources, chacune avec ses 2-3 actions directes (« Générer une appréciation », « Créer une séance »…). C'est exactement la structure déjà introduite par la `NavigationUpdateModal` — autant la rendre permanente.
- **« Reprendre où j'en étais »** : les 3 derniers éléments des banques (appréciations, séances, scénarios) — les données existent déjà.
- Éventuellement un bandeau contextuel selon la période de l'année scolaire (conseils de classe ≈ appréciations ; rentrée ≈ séances).

Redirections : `/` → « Mon espace » si connecté, `/landing` sinon. Le logo pointe vers « Mon espace » quand connecté.

### 3.2 Renommer les routes/intitulés ambigus

- « Dashboard » → « Générateur d'appréciations » (le terme dashboard est faux et entre en collision avec l'admin dashboard).
- « Synthèse » seul est ambigu → « Synthèse de bulletin » ou « Appréciation générale ».
- « Flux RSS » (avec icône `TrendingUp`) → « Actualités pédagogiques » ; RSS est du jargon, même si la page l'explique bien.

### 3.3 Alléger le header et le footer

- **Header** : deux logos côte à côte (texte « ProfAssist » + JPG Cloudinary du logo entreprise, probablement à fond blanc en dark mode, `Header.tsx:134-138`). Garder un seul logo (SVG/PNG transparent). Le logo entreprise a sa place dans le footer.
- **Badges de menu** : « Assistant exercices », « Nouvel outil », « Bêta », « à venir » s'accumulent dans les dropdowns. Règle proposée : un badge « Nouveau » disparaît après ~30 jours ou après la première visite ; « Bêta » reste.
- **Dropdowns** : pas d'`aria-expanded`, pas de navigation clavier, pas de fermeture Échap → à ajouter (voir §7).
- **Footer** : le footer marketing (dégradé sombre, CTA « Commencer gratuitement », liens « Se connecter »/« Créer un compte ») s'affiche sur **toutes** les pages, y compris dans l'app pour un utilisateur connecté. → Deux footers : le footer riche pour la landing/pages publiques, un footer sobre d'une ligne (légal + contact + réseaux) dans l'app. Idem : le footer est toujours sombre, indépendamment du thème.

---

## 4. Parcours de génération (le cœur de l'app)

### 4.1 Générateur d'appréciations

- **Duplication visuelle majeure** : `AppreciationForm` est une page complète (header, compteur de tokens, alerte crédits, `min-h-screen`, fond dégradé) imbriquée dans `DashboardPage` qui a déjà les mêmes éléments → **deux compteurs de tokens, deux alertes « Crédits épuisés », deux titres** sur le même écran (`AppreciationForm.tsx:282-358` dans `DashboardPage.tsx:182`). À dédoublonner : la page porte le contexte (titre, tokens), le formulaire ne porte que le formulaire.
- **Double-clic de confirmation opaque** (`AppreciationForm.tsx:200-203`) : au premier clic, le bouton devient « Confirmer la génération » sans explication, et l'état se réinitialise silencieusement à chaque modification de champ. L'utilisateur croit à un bug. → Remplacer par un seul clic + un encart de coût affiché en permanence près du bouton (« Cette génération consommera ~3 000 crédits »), comme le fait déjà très bien la page Scénario (`ScenarioPedagogiquePage.tsx:1411-1435`).
- **RatingBar cryptique et inaccessible** (`RatingBar.tsx:25-50`) : 8 niveaux affichés par sigles (« NE, TI, I, M, AB, B, TB, E ») dont le sens n'apparaît qu'au survol — donc jamais sur tablette/mobile, très utilisés par les enseignants. Propositions :
  - afficher le **libellé complet du niveau sélectionné** sous la barre (« Assez bien ») — zéro perte de place ;
  - envisager de réduire à 5-6 niveaux (l'échelle actuelle à 8 est plus fine que la plupart des barèmes réels) — à valider avec les utilisateurs ;
  - sémantique `radiogroup` + `aria-label` par niveau (voir §7) ;
  - cibles tactiles ≥ 44 px.
- **Longueur en caractères** (2 champs numériques min/max) : peu parlant. → Un seul contrôle « Courte / Moyenne / Détaillée » (avec équivalence en caractères affichée en petit), aligné avec le slider déjà utilisé en Synthèse. Un seul pattern pour un même besoin.
- **`importance: 2` codée en dur** (`AppreciationForm.tsx:222`) : le réglage Normal/Important/Crucial configuré par matière dans `SubjectModal` est ignoré à la génération. Soit le brancher, soit retirer le réglage du modal (travail de configuration inutile = frustration).
- **Pas de régénération** : « Réinitialiser » efface tout. → Ajouter « Régénérer une variante » qui garde les paramètres (idem Séances, cf. 4.2).
- Composants morts contradictoires à supprimer du code : `CriterionInput`, `CriteriaSection`, `ToneSelector` (barèmes 0-6 différents du 0-7 actif).

### 4.2 Générations longues (séances, scénarios, synthèses)

- Attente jusqu'à 60 s avec un simple spinner et l'avertissement anxiogène « Veuillez rester sur cette page pour ne pas perdre la génération » (`LessonGeneratorPage.tsx:1264`, `ScenarioPedagogiquePage.tsx:1073`). Propositions par ordre d'ambition :
  1. **Étapes affichées** pendant l'attente (« Analyse de votre demande… / Construction du déroulé… / Mise en forme… ») — purement cosmétique mais réduit fortement l'anxiété ;
  2. **Streaming** de la réponse (l'API OpenAI le permet) : le texte apparaît au fil de l'eau, comme dans le chatbot des autres outils que connaissent les enseignants ;
  3. **Persistance** de la génération côté serveur pour pouvoir quitter la page sans perdre ni le résultat ni les crédits.
- **`reset()` après génération réussie** (`LessonGeneratorPage.tsx:1160`) : le formulaire est vidé ; régénérer une variante = tout ressaisir. → Conserver les valeurs + bouton « Régénérer ».
- **Matière et Niveau en texte libre** : « Maths » et « Mathématiques » deviennent deux entrées distinctes dans le filtre des banques. → `Select` avec liste des matières/niveaux de l'Éducation nationale + option « Autre » (aucune régression : le champ libre reste possible).
- **Formulaire Scénario (7 champs dont 3 grands textareas obligatoires)** : candidat idéal à un **wizard en 3 étapes** (1. Contexte : matière/niveau/thème → 2. Diagnostic & attendus → 3. Format : nombre et durée des séances + documents). Le `FeedbackStepper` existant montre que le pattern est déjà maîtrisé dans la codebase.
- Ajouter une légende « * champs obligatoires » (les astérisques sont utilisés sans être expliqués).
- Édition d'une séance = textarea de **markdown brut** (`LessonGeneratorPage.tsx:724-777`) : difficile pour le public visé. L'édition cellule-par-cellule du scénario (`ScenarioPedagogiquePage.tsx:1571`) est le bon modèle ; à défaut d'un éditeur riche, proposer l'édition par section (chaque phase de la séance = un bloc éditable).
- Unifier les **3 moteurs d'export PDF** (jsPDF manuel, jsPDF paysage, capture html-to-image) : un seul service d'export avec des gabarits — et proposer l'export **Word** partout (il n'existe que dans le modal supports), format très demandé par les enseignants.

### 4.3 Chatbot

- **Pas de streaming** (`ChatInterface.tsx:128-209`) : « Réflexion… » statique pendant potentiellement 10-30 s. Le streaming est ici encore plus attendu que sur les générateurs (codes du chat grand public).
- Le **rendu markdown maison** (`ChatMessage.tsx:12-144`) ne gère ni tableaux, ni liens, ni italique — une réponse LLM avec tableau s'affiche cassée. `react-markdown` est déjà une dépendance du projet et utilisé ailleurs : le réutiliser.
- La **conversation est perdue au rechargement** (état local non persisté), sans avertissement. Persister en localStorage a minima.
- Le **chatbot flottant** instancie `ChatInterface` sans `isAdmin` ni `folders` (`ChatbotFloatingButton.tsx:120-123`) : expérience dégradée par rapport à la page dédiée, sans que l'utilisateur comprenne pourquoi. Harmoniser.
- Pré-vérifier le quota **avant** de lancer conversion PDF + OCR (`DocumentUploader.tsx:74-181`) plutôt que de laisser échouer après une longue attente.

---

## 5. Landing page et conversion

- **Trop longue et redondante** : les 8 outils sont présentés deux fois (grille interactive puis 4 bandeaux pleine largeur structurellement identiques, `LandingPage.tsx:471-678`). → Garder la grille interactive (excellente), remplacer les 4 bandeaux par **une seule section « démo »** (capture ou vidéo courte intégrée plutôt que le lien YouTube externe qui fait quitter le site).
- **Aucun pricing affiché** : le modèle à crédits n'apparaît nulle part avant l'inscription, alors que c'est LA question qu'un enseignant se pose (« combien ça coûte ? »). → Section tarifs simple sur la landing : « Gratuit pour essayer (X crédits offerts) · Packs à partir de 3,50 € · Sans abonnement, sans expiration ». « Sans abonnement » est un argument massue pour ce public — il est aujourd'hui invisible.
- **Preuve sociale** : un seul témoignage, signé du fondateur, sur la page Register (`RegisterPage.tsx:101-104`), avec des « étoiles » qui sont en réalité des icônes `CheckCircle` jaunes. → Collecter 3-4 vrais témoignages (le module feedback existe déjà pour ça !), les afficher sur la landing avec prénom + matière + académie. Retirer l'auto-témoignage.
- Harmoniser les CTA (5 formulations différentes pour la même action `/register`) : un libellé unique, ex. « Essayer gratuitement ».
- Cohérence des chiffres : nombre d'outils, « 75 % de temps gagné » avec ou sans astérisque, liste des modèles IA (cf. §1.13).

---

## 6. Identité visuelle — propositions de design

L'app utilise la police système par défaut et le bleu Tailwind standard (`blue-600`) : correct mais générique. Sans rien casser :

1. **Typographie** : une police à personnalité douce et très lisible pour les titres — Nunito, ou Plus Jakarta Sans (Google Fonts, gratuit) — en gardant une police système pour le corps (performance). Effet immédiat de « produit fini » et un ton chaleureux qui correspond au public.
2. **Couleur de marque** : décaler légèrement le bleu vers l'indigo actuel des dégradés et le déclarer comme `primary` dans Tailwind, pour arrêter le mélange blue-600/indigo-600 au cas par cas.
3. **Illustrations** : les pages s'appuient uniquement sur des icônes lucide dans des carrés dégradés. Quelques illustrations légères (unDraw, ou style « craie/cahier » cohérent avec l'univers scolaire) sur les états vides et la landing humaniseraient beaucoup l'ensemble.
4. **Micro-animations** : les `hover:-translate-y-1` existants sont bien ; les généraliser via une classe utilitaire unique plutôt que copiés-collés.
5. **États vides** : déjà bien traités sur les banques ; en faire un composant réutilisable (illustration + message + CTA) pour uniformiser.

---

## 7. Accessibilité (RGAA)

Le public est massivement issu du service public — la conformité RGAA est un argument commercial en plus d'une obligation morale. Constats récurrents sur toute l'app :

1. **Labels non associés aux champs** : `<label htmlFor="x">` sans `id="x"` sur l'input (react-hook-form ne pose pas d'id) — Login, Register, ResetPassword, AppreciationForm. Le clic sur le label ne fait rien, les lecteurs d'écran n'associent pas.
2. **Modales sans sémantique** : pas de `role="dialog"`, `aria-modal`, focus trap, ni fermeture Échap (SubjectModal, CriteriaExamplesModal, CookieBanner, SpecialOfferModal, modales de confirmation…). **Exception exemplaire à généraliser : `FullScreenViewModal`** (portal, Échap, aria, scroll lock) — le modèle existe déjà dans la codebase.
3. **Toasts DOM sans `aria-live`** : tous les retours « copié / sauvegardé / supprimé » sont muets pour les technologies d'assistance (réglé par le composant Toast unifié, §2.2).
4. **Toggles sans `role="switch"` / `aria-checked`** : cookies, newsletter, corpus, banque, bouton flottant.
5. **Boutons icône-seule avec `title` mais sans `aria-label`** : banques, SignatureManager, toggles de vue, œil mot de passe.
6. **RatingBar** : composant central de l'app, quasi inaccessible (cf. §4.1).
7. **Contrastes** : textes `text-gray-400/500` en `text-xs` et textes `*-100` sur bandeaux dégradés saturés, sous le seuil AA par endroits.

---

## 8. Mobile / tablette

Les enseignants travaillent beaucoup sur tablette (correction dans le canapé, salle des profs) :

- Drag du modal supports en `mousedown/mousemove` **sans équivalent tactile** (`ExerciseGeneratorModal.tsx:215-246`) : inutilisable au doigt.
- RatingBar : 8 cibles de ~35 px se partagent la largeur, tooltips inexistants au tactile.
- `SubjectModal` sans `max-height`/scroll interne : avec beaucoup de critères, le bouton « Ajouter la matière » passe sous la ligne de flottaison.
- Tableaux de scénario (5 colonnes) en scroll horizontal sur mobile : prévoir une vue « cartes par séance » en dessous d'un breakpoint.
- Dropdown RSS à largeur fixe `w-[420px]` (`ResourcesPage.tsx:266`) : débordement possible sur petits écrans.
- Toasts en `fixed top-4 right-4` pouvant recouvrir le menu sur petit écran.

---

## 9. Ce qui est déjà très bien (à préserver et capitaliser)

- **Transparence IA** : notices de contribution IA par message, sources citées filtrées, disclaimers « ne remplace pas votre expertise » — rare et précieux pour instaurer la confiance chez les enseignants. À mettre en avant sur la landing comme argument différenciant (« Vous gardez la main »).
- **Dark mode** quasi exhaustif (hors les 3 écrans listés en §1.5-1.6).
- **Pédagogie du coût** : guide de consommation, traduction crédits→actions, avertissement de consommation avant génération de scénario.
- **Gestion des erreurs de connexion** exemplaire (`LoginForm.tsx:50-94`) et parcours de confirmation email robuste.
- **Zone de suppression de compte** modèle du genre (liste des pertes, confirmation par saisie).
- **PDF Élève** avec retrait automatique des corrigés, **« Copier thème »** scénario→séance, supports épinglables, **CriteriaExamplesModal** : de vraies trouvailles métier.
- États d'upload granulaires et honnêtes (détection scan/OCR), skeleton loaders, états vides différenciés.
- `FullScreenViewModal` : la référence accessibilité interne.

---

## 10. Plan d'action suggéré (3 vagues)

**Vague 1 — Quick wins (quelques jours)**
Tout le §1 (bugs visibles, dark mode manquant, icônes, coquilles, logs) + libellé du niveau sélectionné sous la RatingBar + suppression du double-clic de confirmation au profit de l'encart de coût + CTA « Recharger » dans le chat à solde nul + dédoublonnage Dashboard/AppreciationForm.

**Vague 2 — Fondations (1-2 semaines)**
Toast + ConfirmDialog unifiés et accessibles ; extension du thème Tailwind (couleur primaire, police, rayons) ; migration des `alert/confirm` ; terminologie « crédits » / « espace documentaire » ; jauge de crédits dans le header ; footer applicatif sobre ; labels/ids et `aria-label` partout.

**Vague 3 — Parcours (au fil de l'eau)**
Page « Mon espace » connectée ; étapes/streaming sur les générations longues + persistance ; conservation du formulaire après génération + « Régénérer » ; wizard scénario ; selects Matière/Niveau normalisés ; unification PDF + export Word ; streaming + markdown complet du chatbot ; pricing et témoignages sur la landing.

---

*Chaque recommandation est additive ou corrective : aucune ne retire de fonctionnalité existante. Les références `fichier:ligne` correspondent à l'état de la branche `main` au 12/07/2026.*
