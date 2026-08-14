# Communication — audit honnête et plan (services, UX/UI, dictée vocale Mistral)

*Analyse réalisée le 13/08/2026 sur la branche `claude/communication-transcription-analysis-gskxcg`. Périmètre : la fonctionnalité « Communication » de bout en bout (`CommunicationPage.tsx`, `generateCommunication.ts`, `generateReply.ts`, `secureApi.ts`, Edge Functions `communication` et `reply`, table `signatures`, mécanique de crédits) + étude d'implémentation d'une transcription audio via l'API Mistral.*

*Aucun code n'a été modifié. Ce document complète `AUDIT_UX_UI.md` (12/07/2026) sans le répéter : les points déjà listés là-bas sont signalés comme tels.*

---

## Résumé exécutif

La fonctionnalité Communication est **la plus utilisée en fréquence et la moins bien outillée de l'application**. C'est le seul générateur sans banque, sans historique, sans réutilisation, sans contrôle de longueur, et c'est celui dont le décompte de crédits est le plus abîmé.

Trois constats, par ordre de gravité :

1. **Les crédits ne sont pas appliqués côté serveur.** La policy RLS autorise un utilisateur à écrire n'importe quelle valeur dans `profiles.tokens` depuis la console du navigateur, et les Edge Functions `communication` / `reply` ne vérifient ni ne débitent jamais le solde. En parallèle, le débit client est fait **deux fois** par génération, de façon non atomique, avec un solde qui peut passer en négatif. C'est un problème de monétisation, pas de confort.
2. **L'UX confond « destinataire » et « type de document ».** Un même menu déroulant mélange 6 vrais destinataires, un rapport administratif sans destinataire et un dossier analytique de 2 pages pour commission disciplinaire. Le sélecteur « Ton » reste affiché même quand le prompt serveur impose un registre neutre. L'enseignant ne comprend pas ce qu'il pilote.
3. **Rien n'est conservé.** `lessons_bank`, `scenarios_bank`, `appreciations`, `chatbot_answers` existent ; il n'y a **aucune** table `communications`. Le mail « absence » est réécrit intégralement chaque semaine, et chaque réécriture est facturée.

**Sur la dictée vocale** : le cas d'usage est excellent et l'API Mistral s'y prête très bien (Voxtral, ~0,003 $/minute, hébergement UE — un argument RGPD réel face à OpenAI pour un public Éducation nationale). Mais **il ne faut pas brancher une seconde API payante sur un système de crédits non appliqué**. L'ordre proposé plus bas fait passer la fiabilisation des crédits avant la dictée.

---

# PARTIE 1 — Ce qui existe : analyse

## 1. Services / back-end

### 1.1 🔴 CRITIQUE — Le solde de crédits est modifiable par l'utilisateur

La policy RLS sur `profiles` autorise l'`UPDATE` sur **toutes** les colonnes de sa propre ligne, `tokens` comprise :

```sql
-- supabase/migrations/20260302_snapshot_rls_policies.sql:307-313
CREATE POLICY "Users can update their profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Aucun trigger, aucun `REVOKE` de colonne, aucune fonction `SECURITY DEFINER` ne protège `tokens` (vérifié sur l'ensemble des 50 migrations). N'importe quel utilisateur connecté peut exécuter dans sa console :

```js
supabase.from('profiles').update({ tokens: 99999999 }).eq('user_id', <son id>)
```

Corollaire : les Edge Functions `communication/index.ts` et `reply/index.ts` **vérifient le JWT mais jamais le solde**, et ne débitent rien. Un utilisateur à 0 crédit peut appeler directement `POST /functions/v1/communication` avec son token et générer sans limite. Le contrôle `tokenCount === 0` (`CommunicationPage.tsx:137,201`) n'est qu'un garde-fou d'interface.

### 1.2 🔴 CRITIQUE — Double débit, non atomique, solde négatif possible

Pour **une** génération, le solde est décrémenté deux fois :

| Étape | Fichier | Montant débité |
|---|---|---|
| 1 | `generateCommunication.ts:38-61` | `result.usage.total_tokens` (le coût réel, ~1 000 à 2 000) |
| 2 | `CommunicationPage.tsx:169-189` | `usedTokens = 1` (en dur), après un nouveau `select` |

Même schéma pour la réponse (`generateReply.ts:40-63` + `CommunicationPage.tsx:228-248`).

Trois défauts cumulés :
- **Lecture-modification-écriture non atomique** (`select tokens` puis `update tokens = valeur`) : deux générations concurrentes se marchent dessus, une des deux consommations est perdue.
- **Pas de clamp dans le chemin lib** : `const newTokens = currentTokens - tokensUsed;` (`generateCommunication.ts:52`) peut être négatif. La page rattrape avec `Math.max(0, …)` mais seulement parce qu'elle s'exécute après ; si le second `update` échoue, le solde reste négatif — et un solde négatif passe le test `tokenCount === 0`.
- **Le débit est déclaré côté client** à partir d'une valeur (`usage`) renvoyée par le serveur mais jamais vérifiée.

### 1.3 🟠 Le rafraîchissement du solde repose sur trois bus d'événements dont un inopérant

- `Header.tsx:37-38` exporte `tokenUpdateEvent` (un `EventTarget`) et la constante `TOKEN_UPDATED`.
- `useTokenBalance.ts:31` écoute **sur `tokenUpdateEvent`**.
- `generateCommunication.ts:66` et `generateReply.ts:68` émettent **sur `window`** : `window.dispatchEvent(new Event(TOKEN_UPDATED))` → **personne n'écoute, ce dispatch ne fait rien.**
- `CommunicationPage.tsx:186,245` émet correctement sur `tokenUpdateEvent`.
- `Header.tsx:69` écoute en plus un troisième événement `'tokensUpdated'` (nom différent) qui déclenche un `window.location.reload()`.

Le compteur ne se rafraîchit donc que grâce au chemin page — c'est-à-dire grâce au bug 1.2. Corriger le double débit sans corriger le bus casserait l'affichage.

### 1.4 🟠 Aucune protection serveur : pas de rate limit, pas de taille max, CORS ouvert

- `Access-Control-Allow-Origin: '*'` (`communication/index.ts:182`, `reply/index.ts:119`) : n'importe quelle origine peut appeler la fonction avec un token valide.
- Aucune borne sur `contenu` / `message`. Un copier-coller de 300 Ko part chez OpenAI et vous est facturé.
- Aucun rate limit. Combiné à 1.1, c'est un vecteur de coût direct.

### 1.5 🟠 Duplication massive entre Edge Functions

`resolveAIConfig` est copiée à l'identique dans **7 fonctions** (`communication`, `reply`, `generate`, `lessons`, `exercises`, `scenario`, `synthesis`). `cleanOutputText`, le bloc de vérification JWT et les `corsHeaders` aussi. Il n'existe pas de dossier `_shared/`.

La divergence a déjà commencé :
- `communication` et `reply` ont pour défaut `gpt-4.1-mini`, `generate` a `gpt-4o-mini` — alors que l'étiquette montrée à l'utilisateur est « GPT-4.1 mini (standard) » (`aiModelConfig.ts:28`). Le générateur d'appréciations n'utilise donc pas le modèle annoncé.
- `communication/index.ts:99` a un helper `callAI` ; `reply/index.ts:280-349` réinline le même code au lieu de l'utiliser.
- `reply` a une instruction anti-méta-commentaires pour Mistral (`:205`), `communication` ne l'a pas.

### 1.6 🟠 `cleanOutputText` est destructif et contredit les prompts

```js
// communication/index.ts:81-83
cleaned = cleaned.replace(/\*\*/g, '');
cleaned = cleaned.replace(/\*/g, '');
cleaned = cleaned.replace(/`{1,3}/g, '');
```

Or le prompt « Commission disciplinaire » (`communication/index.ts:284-327`) **exige** une structure markdown : `# I. CONTEXTE GÉNÉRAL`, `**Mesures immédiates à envisager :**`. Résultat : le gras est supprimé, **les `#` survivent**, et le tout est affiché dans un `<textarea>` brut (`CommunicationPage.tsx:520`). L'enseignant lit littéralement `# I. CONTEXTE GÉNÉRAL` dans son document de commission. L'application dispose pourtant d'un `EnhancedMarkdownRenderer`.

Par ailleurs, la regex de nettoyage de `reply/index.ts:84` supprime tout ce qui suit un `---` suivi quelque part des mots `Notes|Remarques|Adaptation|Structure|Analyse|Commentaires`. Une réponse légitime contenant une séparation puis le mot « Structure » se retrouve **tronquée silencieusement**.

### 1.7 🟡 Le prompt est construit par injection de chaîne depuis le client

```ts
// CommunicationPage.tsx:153-156
if (destinataire === "Rapport d'incident" && pointDeVue === 'premiere') {
  contenuAvecPointDeVue = `[IMPORTANT: Rédiger ce rapport à la PREMIÈRE PERSONNE...]\n\n${contenu}`;
}
```

Le « point de vue » est un paramètre métier : il devrait être un champ typé du contrat d'API, traité par `getDestinataireInstructions()` côté serveur, pas du texte collé dans le contenu utilisateur. Conséquence directe : `contenu` est interpolé brut dans le prompt (`communication/index.ts:386`), donc tout texte saisi est interprétable comme instruction. Le risque de sécurité est faible ici (l'utilisateur ne nuit qu'à lui-même), mais la fonctionnalité devient non testable et non déterministe.

### 1.8 🟠 Rien n'est persisté — seul générateur dans ce cas

Tables client réellement utilisées : `appreciations`, `lessons_bank`, `scenarios_bank`, `chatbot_answers`, `signatures`… et **aucune table de communications**. Seul un compteur anonyme est écrit (`logGeneration('communication')` → `generation_events`).

C'est un manque fonctionnel majeur : la communication est l'acte le plus répétitif du métier (absence, retard, matériel oublié, convocation RDV, information sortie scolaire). Aujourd'hui chaque occurrence est régénérée de zéro et refacturée.

### 1.9 🟡 Les erreurs sont avalées

- La lib produit de bons messages (« Votre session a expiré. Veuillez vous reconnecter. », `generateCommunication.ts:75`), que la page écrase par un générique : `setError('Erreur lors de la génération')` (`CommunicationPage.tsx:192,250`).
- Les Edge Functions renvoient parfois du **texte brut** au lieu de JSON : `return new Response('API Error', { status: 500 })` (`communication/index.ts:371,453`) alors que `secureApi.makeRequest` fait `response.json()` → l'erreur d'origine est masquée par une erreur de parsing.

### 1.10 🟡 Aucune validation avant dépense

`handleGenerate` ne vérifie ni `contenu.trim()` ni `messageRecu.trim()`. Générer sur un formulaire vide est autorisé, part chez OpenAI et coûte des crédits.

---

## 2. UX / UI

### 2.1 Une page unique de 791 lignes qui empile deux outils

`CommunicationPage.tsx` affiche en colonne : formulaire « créer » → résultat « créer » → formulaire « répondre » → résultat « répondre ». Les liens du header (`Header.tsx:289,297`) passent `?mode=create` / `?mode=reply`, mais cela ne fait qu'un `scrollIntoView` dans un `setTimeout(…, 100)` (`CommunicationPage.tsx:55-66`) — fragile, et l'utilisateur atterrit malgré tout dans une page qui contient l'autre outil.

→ **Deux onglets (ou deux routes), l'URL comme source de vérité.**

### 2.2 Le menu « Type de destinataire » mélange trois objets incompatibles

Les 9 options (`:340-353`) contiennent :
- 6 vrais destinataires (parent, parents, élève, élèves, classe, collègues, direction) ;
- **« Rapport d'incident »** : un document administratif **sans destinataire**, dont le prompt impose « PAS DE DESTINATAIRE » (`communication/index.ts:559`) ;
- **« Commission disciplinaire »** : un tout autre produit — un bilan analytique en 6 parties, ~2 pages, avec un prompt entièrement séparé (`communication/index.ts:268-340`) et une limite de tokens différente.

Conséquences visibles : le sélecteur **« Ton de la communication » reste affiché** pour le rapport d'incident alors que le prompt serveur impose un registre neutre et objectif — le contrôle ment à l'utilisateur. Et le bloc « Point de vue de rédaction » n'apparaît que pour cette option, sans que rien n'ait annoncé qu'on changeait de nature de document.

→ **Poser d'abord la question « Que voulez-vous produire ? »** (Message / Rapport d'incident / Dossier pour commission), puis n'afficher que les champs pertinents.

### 2.3 Les commandes qui manquent à l'enseignant

- **Aucun contrôle de longueur.** Les appréciations ont min/max caractères, la synthèse a un curseur. Ici le modèle décide, et il est souvent trop long pour un message aux familles.
- **Pas de champ « Objet » séparé.** Le prompt dit « Objet/Titre : Concis et informatif (si pertinent) » (`communication/index.ts:398`) : parfois il y en a un, parfois non, et il finit noyé dans le texte copié. Pour un mail, on veut copier l'objet et le corps séparément.
- **Pas de contexte structuré** (prénom de l'élève, classe, niveau, date). Tout passe par un unique textarea : l'enseignant doit rédiger une consigne en prose à l'IA au lieu de remplir un formulaire. La page Appréciations prouve que le savoir-faire existe dans l'équipe.
- **Pas de tutoiement/vouvoiement** alors que `addressMode` existe déjà côté appréciations (`secureApi.ts:19`).
- Coquille visible dans l'UI : **« Stricte »** (`:370,646`) — « ton » est masculin, il faut « Strict ».

### 2.4 L'outil « Répondre » est aveugle

Contrairement à « Créer », il n'a **aucun champ destinataire**. Le prompt demande donc au modèle de deviner : « Identifie le type d'expéditeur probable (parent, collègue, direction, élève) » (`reply/index.ts:225`). L'enseignant, lui, le sait. C'est une information gratuite qu'on choisit de ne pas demander, au prix d'une erreur de registre possible sur le message le plus sensible qui soit (une réponse à un parent mécontent).

Le champ « Objectifs de la réponse » est un textarea libre sans exemple ni suggestion : un utilisateur qui n'écrit rien obtient une réponse passe-partout.

### 2.5 Signatures : bonne idée, plomberie incomplète

- **La signature par défaut n'est jamais présélectionnée** : l'état part de `''` (`:89-90`), dont le libellé est « Au choix de l'utilisateur » — qui signifie en réalité « aucune signature, l'IA improvise une formule de clôture ». Le drapeau `is_default` que l'utilisateur a pris la peine de régler dans `SignatureManager` n'a donc aucun effet là où il compte.
- Deux sélecteurs de signature sur la même page, dans **deux couleurs différentes** (bleu et violet).
- La gestion des signatures n'est accessible que depuis cette page, via une modale ; sa place naturelle est aussi dans les Paramètres.
- La signature est injectée dans le prompt avec « Termine OBLIGATOIREMENT par cette signature exacte » (`communication/index.ts:413`). Le modèle la reformate parfois. **Une concaténation déterministe après génération serait plus fiable et gratuite.**

### 2.6 Retours utilisateur et états

- Le toast « copié ! » est construit en `document.createElement` + `innerHTML` et injecté dans `document.body` (`:257-269`) : pas d'`aria-live`, invisible aux lecteurs d'écran, positionné `top-4 right-4` où il peut recouvrir le menu sur mobile. *(Déjà relevé dans `AUDIT_UX_UI.md` §2.2 — toujours présent.)*
- `handleCopySuccess(message)` reçoit un paramètre qu'elle n'utilise jamais (`:257`).
- **Aucun scroll ni focus vers le résultat** après génération : sur mobile le résultat apparaît sous la ligne de flottaison, l'utilisateur croit qu'il ne s'est rien passé.
- **Aucune progression** pendant les 5-15 s de génération, aucun streaming.
- **Aucun « Régénérer une variante »**, aucune retouche rapide (« Plus court », « Plus chaleureux », « Plus ferme », « Plus factuel »). C'est pourtant l'action la plus attendue juste après avoir lu un texte généré. Aujourd'hui : « Nouvelle communication » remet tout à zéro (`:125-133`).

### 2.7 Dark mode cassé sur les champs de cette page

Aucun composant UI de base n'a de `dark:bg` / `dark:text` (vérifié sur `Textarea.tsx`, `Select.tsx`, `Input.tsx`, `Button.tsx`) :

```tsx
// Textarea.tsx:11
className={`w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
```

La page n'ajoute que `dark:border-gray-600`. En thème sombre, **tous les champs de Communication s'affichent en boîtes blanches** dans des cartes sombres. Le problème est global à l'app, mais c'est ici qu'il est le plus visible : la page n'est faite que de champs.

### 2.8 Accessibilité

- **Labels non associés** : `<label className="block …">Type de destinataire</label>` (`:331`) n'a pas de `htmlFor`, ce qui rend l'`id="destinataire"` du `Select` inutile. Idem pour tous les champs de la page.
- `Button` est **importé (`:4`) et jamais utilisé** : tous les boutons sont des `<button>` bruts à dégradés, sans anneau de focus cohérent.
- La modale de signatures (`:761-786`) n'a ni `role="dialog"`, ni `aria-modal`, ni piège de focus, ni fermeture par Échap — alors que `FullScreenViewModal` du même dépôt fait tout cela correctement.
- Le disclaimer IA est affiché **deux fois** sur la même page (`:327` et `:577`).

### 2.9 Le résultat est un `<textarea rows={8}>`

Pour un dossier de commission de deux pages, c'est inutilisable. Pas de rendu markdown, pas d'export PDF/Word (qui existent pour les séances et scénarios), pas d'ouverture dans la messagerie (`mailto:`), pas de sauvegarde.

### 2.10 Le récit de valeur est sous-exploité

`MonEspacePage.tsx:402` estime « 5 min gagnées par communication » — la plus faible valeur affichée de l'application. C'est aussi le geste le plus répété et le seul sans banque. Il y a là un gisement produit évident : **modèles récurrents** (« absence », « retards répétés », « convocation RDV », « sortie scolaire ») qui augmenteraient la valeur perçue *et* réduiraient la consommation de tokens.

---

# PARTIE 2 — Plan

Quatre lots. **L'ordre compte** : le lot 1 conditionne la dictée vocale.

## Lot 0 — Colmatage (1 à 2 jours)

À faire avant toute nouvelle fonctionnalité. Correctifs ponctuels, sans refonte.

| # | Action | Où |
|---|---|---|
| 0.1 | Supprimer le second débit de crédits | `CommunicationPage.tsx:169-189` et `:228-248` |
| 0.2 | Clamper le solde à 0 dans la lib | `generateCommunication.ts:52`, `generateReply.ts:54` |
| 0.3 | Émettre sur `tokenUpdateEvent`, plus sur `window` | `generateCommunication.ts:66`, `generateReply.ts:68` |
| 0.4 | `tokenCount <= 0` au lieu de `=== 0` | `CommunicationPage.tsx:137,201` |
| 0.5 | Valider `contenu` / `messageRecu` non vides + longueur max avant appel | `CommunicationPage.tsx:136,200` |
| 0.6 | Remonter le vrai message d'erreur | `CommunicationPage.tsx:192,250` |
| 0.7 | Toujours répondre en JSON depuis les Edge Functions | `communication/index.ts:371,453` |
| 0.8 | Ajouter `dark:bg-*` / `dark:text-*` aux composants UI de base | `Textarea.tsx`, `Select.tsx`, `Input.tsx` |
| 0.9 | Présélectionner la signature `is_default` | `CommunicationPage.tsx:89-90` + libellé « Aucune signature » |
| 0.10 | Scroll + focus + `aria-live` sur le bloc résultat | `CommunicationPage.tsx:502,701` |
| 0.11 | Corriger « Stricte » → « Strict », retirer le disclaimer en double, retirer l'import `Button` mort | `CommunicationPage.tsx:4,327,370,577,646` |

## Lot 1 — Fiabiliser et sécuriser les crédits (3 à 5 jours) — **prérequis à la dictée**

**1.1 Verrouiller la colonne en base.** Migration :
- `REVOKE UPDATE (tokens) ON public.profiles FROM authenticated;` (Postgres gère les droits colonne par colonne ; la policy RLS reste en place pour les autres champs).
- Fonction `SECURITY DEFINER` `consume_credits(p_user uuid, p_amount int, p_kind text)` faisant un `UPDATE … SET tokens = tokens - p_amount WHERE user_id = p_user AND tokens >= p_amount RETURNING tokens` — **atomique**, et refusant si le solde est insuffisant.
- Table `credit_ledger` (user_id, kind, amount, model, created_at) : traçabilité, réconciliation avec la facture OpenAI/Mistral, et alimentation du dashboard admin existant.
- `REVOKE EXECUTE … FROM anon` sur la fonction, dans la lignée de `20260704_revoke_anon_function_exec.sql`.

**1.2 Déplacer le débit dans les Edge Functions.** Séquence : vérifier le solde → appeler le LLM → débiter le coût réel (`usage.total_tokens`) → **renvoyer le nouveau solde dans la réponse**. Le client n'écrit plus jamais dans `profiles` ; il affiche ce que le serveur lui rend. Les blocs de débit de `generateCommunication.ts` / `generateReply.ts` disparaissent.

**1.3 Créer `supabase/functions/_shared/`** : `cors.ts` (origine restreinte à l'app), `auth.ts` (vérification JWT), `ai.ts` (`resolveAIConfig` + `callAI` + `cleanOutput` paramétrable), `credits.ts`. Migrer d'abord `communication` et `reply`, puis les 5 autres au fil de l'eau. Au passage, trancher l'incohérence `gpt-4o-mini` / `gpt-4.1-mini` (§1.5).

**1.4 Garde-fous** : limite de taille des entrées, rate limit simple par utilisateur (la table `edge_function_logs` existe déjà et peut servir de compteur), CORS restreint.

**1.5 Rendre `cleanOutputText` paramétrable** : mode `plain` (message mail → on nettoie le markdown) vs mode `structured` (rapport/commission → on **garde** le markdown et on l'affiche avec `EnhancedMarkdownRenderer`). Supprimer la regex tronqueuse de `reply/index.ts:84` au profit d'une instruction de prompt.

## Lot 2 — Refonte UX de Communication (1 à 2 semaines)

**2.1 Trois intentions explicites** remplacent les 9 « destinataires » :
1. **Écrire un message** → destinataire + contexte + objectif
2. **Répondre à un message** → expéditeur (nouveau champ) + message reçu + objectif
3. **Produire un document officiel** → Rapport d'incident | Dossier pour commission disciplinaire

Chaque intention n'affiche que ses champs. Le « Ton » disparaît là où il ne s'applique pas.

**2.2 Formulaire guidé** : destinataire · contexte structuré (élève/classe, date) · objectif · **longueur** (Court / Moyen / Détaillé) · tutoiement/vouvoiement · ton · signature (défaut présélectionné).

**2.3 Résultat exploitable** : **Objet** et **Corps** séparés · rendu markdown pour les documents · actions « Copier l'objet », « Copier le message », « Ouvrir dans ma messagerie » (`mailto:`), « Enregistrer », « Régénérer » · **retouches en un clic** (Plus court / Plus chaleureux / Plus ferme / Plus factuel) qui repassent uniquement sur le texte généré — donc peu coûteuses.

**2.4 Banque de communications** : table `communications` (+ RLS sur le modèle de `signatures`), page « Banque de communications » calquée sur `LessonsBankPage`, et **« Réutiliser comme modèle »**. C'est le chaînon manquant : il transforme un générateur ponctuel en outil du quotidien et fait baisser la consommation.

**2.5 Modèles récurrents** pré-remplis (absence, retards répétés, matériel oublié, convocation RDV, information sortie) — le meilleur ratio valeur/effort de tout ce lot.

**2.6 Onglets + URL** à la place du `scrollIntoView` temporisé, streaming ou étapes affichées pendant la génération, toast unifié accessible (chantier commun à toute l'app, cf. `AUDIT_UX_UI.md` §2.2).

## Lot 3 — Dictée vocale (nouvelle fonctionnalité)

### 3.1 Le cas d'usage réel

Un enseignant, en fin de cours, dans le couloir, sur son téléphone :

> « Alors, Lucas Martin, 4e B, encore arrivé en retard ce matin, troisième fois cette semaine, il n'avait pas ses affaires. Je voudrais prévenir les parents et proposer un rendez-vous jeudi ou vendredi. »

→ l'application produit un mail prêt à envoyer.

**La valeur n'est pas la transcription**, c'est que parler est 5× plus rapide que taper sur un téléphone, et que la parole capte des nuances qu'un formulaire perd. Le second cas d'usage, tout aussi fort : **dicter un rapport d'incident 10 minutes après les faits**, tant que les détails sont frais — c'est précisément ce que le prompt « Rapport d'incident » réclame (chronologie, paroles, gestes, attitudes).

### 3.2 Ce qu'offre l'API Mistral (vérifié)

| Élément | Valeur |
|---|---|
| Endpoint | `POST https://api.mistral.ai/v1/audio/transcriptions` |
| Auth | `Authorization: Bearer $MISTRAL_API_KEY` (ou `x-api-key`) |
| Corps | `multipart/form-data` : `file` (ou `file_url`), `model` |
| Modèle | `voxtral-mini-latest` (Voxtral Mini Transcribe 2) |
| Options utiles | `language`, `timestamp_granularities`, `diarize` (locuteurs), **`context_bias`** (jusqu'à 100 termes personnalisés) |
| Formats | MP3, WAV, M4A, FLAC, OGG |
| Limites | jusqu'à ~1 Go / 3 h par requête ; ~30 min en transcription simple |
| Prix | **≈ 0,003 $/minute** (Voxtral Mini Transcribe 2) |
| Variante temps réel | `voxtral-mini-transcribe-realtime-*`, ≈ 0,006 $/min, latence sub-200 ms |
| Compréhension audio directe | Voxtral Mini/Small acceptent `input_audio` dans `chat/completions` (audio → réponse, sans passer par le texte) |

**Atout majeur pour votre public** : Mistral est français, les données sont stockées en UE par défaut, conservées 30 jours glissants pour la lutte contre les abus, non utilisées pour l'entraînement sans opt-in, et le *Zero Data Retention* est disponible (plan Scale). Pour l'Éducation nationale, « votre dictée reste en Europe » vaut plus qu'une fonctionnalité. Vous utilisez déjà `mistral-medium` en production : la clé `MISTRAL_API_KEY` est déjà configurée côté Edge Functions (`communication/index.ts:240`).

### 3.3 Architecture — deux options, une recommandation

**Option A (recommandée) — deux étapes : transcrire, puis générer**

```
🎤 MediaRecorder → blob audio
   → POST /functions/v1/transcribe   (Mistral /audio/transcriptions, voxtral-mini-latest)
   → texte brut, ÉDITABLE par l'enseignant
   → POST /functions/v1/communication-brief  (extraction structurée : destinataire, objectif,
                                              élève, classe, ton suggéré, échéance)
   → formulaire Communication PRÉ-REMPLI, que l'enseignant valide/corrige
   → génération via le pipeline existant
```

**Option B — une étape : audio → mail directement**, via `chat/completions` avec `input_audio` sur `voxtral-small-latest`. Moins d'allers-retours, mais boîte noire : si le mail est faux, l'enseignant ne peut pas savoir si l'IA a **mal entendu** ou **mal compris**.

**→ Retenir A.** Le différenciateur produit est là : *l'audio remplit le formulaire, l'enseignant vérifie le formulaire, puis génère.* On garde la transparence qui est déjà la marque de fabrique de ProfAssist (disclaimers, sources citées). L'option B pourra devenir un « mode express » plus tard.

**Écrire la fonction `transcribe` comme un service générique**, pas comme un bout de Communication : Synthèse, Séances et le Chatbot pourront la réutiliser.

### 3.4 Décisions techniques à trancher

**Format d'enregistrement — à valider en premier.** `MediaRecorder` produit `audio/webm;codecs=opus` sur Chrome/Firefox et `audio/mp4` sur Safari/iOS. **iOS Safari est le cas critique** (enseignants sur iPhone). Mistral accepte MP3/WAV/M4A/FLAC/OGG. Il faut vérifier concrètement si le webm/opus passe ; sinon, transcoder côté client ou renvoyer en `.ogg`. **C'est le spike bloquant du jour 1.**

Bonne nouvelle : `netlify.toml` ne pose aucune CSP (uniquement `X-Frame-Options`, `nosniff`, `Referrer-Policy`), donc `getUserMedia` fonctionnera sans modification d'en-têtes, HTTPS étant assuré par Netlify.

**Transport.** Jusqu'à ~5 Mo : `POST` multipart direct vers l'Edge Function, qui relaie vers Mistral. Au-delà : réutiliser le motif URL signée de `rag-upload-sign/index.ts`.

**Stockage — recommandation : ne pas stocker l'audio.** On le fait transiter par l'Edge Function vers Mistral et on ne l'écrit jamais dans Storage. La voix de l'enseignant + des noms d'élèves = données personnelles, parfois sensibles. Zéro stockage = aucune question de rétention, aucun bucket à sécuriser, aucune ligne au registre des traitements pour une archive vocale. Si vous voulez un jour la ré-écoute, ce sera une option explicite et opt-in.

**Durée max : 3 minutes.** Largement suffisant pour un brief, et cela plafonne le coût comme le risque.

**Qualité en conditions réelles.** Bruit de couloir, accents, jargon (`PPRE`, `AESH`, `conseil de classe`, `vie scolaire`, noms d'établissement). → utiliser **`context_bias`** avec un lexique Éducation nationale, enrichi des matières et classes de l'utilisateur. C'est un gain de qualité concret, spécifique à votre produit, et quasi gratuit.

### 3.5 Crédits : une décision produit à prendre

Le système compte des **tokens** ; l'audio n'en a pas. Il faut une règle de conversion explicite, par exemple **1 minute d'audio = N crédits**, annoncée **avant** l'enregistrement (« Cette dictée consommera environ N crédits »), sur le modèle de l'avertissement déjà présent sur la page Scénario. Le débit doit passer par `consume_credits(kind='transcription')` (Lot 1) pour apparaître distinctement dans le `credit_ledger` et le dashboard admin.

Le coût réel est faible — une dictée de 90 s ≈ 0,0045 $, négligeable face à la génération — mais la règle doit être posée et affichée, pas implicite.

### 3.6 RGPD — la partie à ne pas sauter

- **La politique de confidentialité ne mentionne pas Mistral.** Elle liste OpenAI, Stripe et Supabase (`PolitiqueConfidentialitePage.tsx:233-258`) alors que `mistral-medium` est **déjà proposé en production** dans les Paramètres. Cet écart existe aujourd'hui ; il devient sérieux avec la voix. À corriger dans tous les cas.
- **Écran de consentement au premier usage** : « Votre voix est envoyée à Mistral AI (France) pour transcription, puis supprimée. Ne dictez pas d'informations médicales. » La table `consent_logs` existe déjà et est utilisée (`src/lib/api/consent.ts`).
- **Mettre en avant l'argument UE** dans l'interface et sur la landing : c'est un avantage concurrentiel réel sur ce marché.
- **Aide à la minimisation** : inciter aux prénoms seuls, et proposer une option « remplacer les noms par des initiales dans le message généré ». Peu coûteux, fort signal de confiance.
- **DPA et registre des traitements** : à formaliser côté entreprise (hors périmètre technique).

### 3.7 Découpage en incréments livrables

| Incrément | Contenu | Effort |
|---|---|---|
| **Spike** | `MediaRecorder` sur iOS Safari + Chrome + un vrai appel Mistral avec un échantillon de 60 s. Réponse bloquante sur le format. | 0,5 j |
| **v0.1** | Enregistrer → transcrire → **déposer le texte brut dans le champ « Contenu à communiquer » existant**. Rien d'autre. Immédiatement utile, risque minimal. | 3-4 j |
| **v0.2** | Extraction structurée → le formulaire se remplit seul, l'enseignant valide. C'est le cœur de la valeur. | 3-4 j |
| **v0.3** | Dictée partout où elle est utile : champ « Message reçu », champ « Objectifs de la réponse », et surtout **rapport d'incident**. | 2-3 j |
| **v0.4** *(optionnel)* | Mode express (option B) · audio long (réunion parents-profs → compte rendu) · `diarize=true` pour identifier les locuteurs en réunion. | à évaluer |

---

## Ordre d'exécution recommandé

```
Lot 0 (colmatage)  →  Lot 1 (crédits serveur)  →  Lot 3 v0.1 (dictée simple)
                                                →  Lot 2 (refonte UX)
                                                →  Lot 3 v0.2+ (formulaire auto-rempli)
```

Le point le plus important de tout ce document : **ne pas livrer la dictée vocale sur un système de crédits non appliqué.** Ajouter une seconde API payante à un système où le solde est côté client et falsifiable multiplie l'exposition financière. Le Lot 1 n'est pas un raffinement technique, c'est la condition d'un modèle économique qui tient.

---

## Sources (API Mistral)

- [Voxtral — Mistral AI](https://mistral.ai/news/voxtral/)
- [Voxtral transcribes at the speed of sound — Mistral AI](https://mistral.ai/news/voxtral-transcribe-2/)
- [Audio Transcriptions Endpoints — Mistral AI Documentation](https://docs.mistral.ai/api/endpoint/audio/transcriptions)
- [Audio — Mistral Docs](https://docs.mistral.ai/studio/audio/overview)
- [Privacy and data controls — Mistral Docs](https://docs.mistral.ai/admin/monitor-comply/privacy-data-controls)
- [Zero Data Retention — Mistral Help Center](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr)
- [Voxtral Mini Transcribe — OpenRouter (tarifs)](https://openrouter.ai/mistralai/voxtral-mini-transcribe)
- [Voxtral-Mini-3B-2507 — Hugging Face](https://huggingface.co/mistralai/Voxtral-Mini-3B-2507)

---

*Toutes les références `fichier:ligne` correspondent à l'état de la branche `claude/communication-transcription-analysis-gskxcg` au 13/08/2026.*
