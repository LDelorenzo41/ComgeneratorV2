# ProfAssist — contexte pour toute session de travail

> Ce fichier est lu automatiquement au démarrage d'une session Claude Code.
> Il donne le contexte minimal indispensable. Le dossier complet — mesures
> chiffrées, décisions et leurs justifications, feuille de route datée — est
> dans **`docs/CONTEXTE-STRATEGIE.md`**. À lire avant toute décision d'architecture.

## Le projet

Application web destinée aux enseignants (génération d'appréciations, de séances,
de scénarios pédagogiques, de communications, synthèses de bulletins). Production
sur **profassist.net**.

Le code applicatif est dans le sous-dossier **`comgeneratorV2/`** — pas à la racine.

| Couche | Technologie |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind, déployé sur Netlify depuis `main` |
| Backend | Supabase : PostgreSQL, Auth, ~21 Edge Functions Deno, un bucket Storage |
| IA | OpenAI (principal), Mistral (option + dictée Voxtral), Cohere (rerank) |
| Paiement | Stripe, en paiement unique — **jamais d'abonnement** |

## L'objectif, qui prime sur tout le reste

L'exploitant part en retraite progressive et **ferme sa micro-entreprise début
mai 2027**. Deux conséquences non négociables :

1. **Aucun revenu ne pourra plus être encaissé** après cette date (contrainte de
   statut, pas choix commercial).
2. **Aucun coût récurrent ne doit subsister.**

L'objectif n'est donc **pas** de faire croître ProfAssist, mais de le rendre
*gratuit à exploiter* pour qu'il survive à la fin de l'activité. Cible : ~12 €/an
(le nom de domaine seul), grâce au passage à une IA en **BYOK** — chaque
utilisateur fournit sa propre clé API.

Ne proposez pas d'optimisations de croissance, de monétisation ou de mise à
l'échelle : elles sont hors sujet. Privilégiez systématiquement ce qui réduit le
coût d'exploitation et la charge de maintenance.

## Règles de travail

- **Ne jamais retirer un chemin avant que son remplaçant existe.** C'est la règle
  qui gouverne tout le calendrier de transition.
- **Aucune régression.** Les modifications sont minimales, réversibles, testées,
  documentées. Le produit a des utilisateurs réels.
- **Fenêtres de gel.** Aux périodes sensibles (rentrée scolaire, conseils de
  classe), seuls passent : suppression de code mort non importé, bascule d'une
  constante existante, ajout purement additif réversible en une commande.
- **Un changement, un déploiement, une fenêtre d'observation.** Jamais de lot groupé.
- **Mesurer avant de trancher.** Les décisions d'architecture de ce projet ont été
  prises sur des requêtes SQL réelles, et plusieurs hypothèses de départ se sont
  révélées fausses d'un facteur 20. Voir `docs/CONTEXTE-STRATEGIE.md`.

## Pièges techniques à connaître

- **Le schéma de production n'est pas reproductible depuis les migrations** :
  18 tables sur 29 et 6 fonctions RPC ont été créées via le dashboard Supabase.
  L'index vectoriel HNSW n'est versionné nulle part.
- **`src/lib/database.types.ts` est incomplet** : plusieurs tables de production y
  manquent (dont `scenarios_bank`). Pour ces tables, interroger par nom sans passer
  par les génériques typés.
- **Le build ne vérifie pas les types** (`vite build` seul, via esbuild). Le dépôt
  compte ~127 erreurs TypeScript préexistantes, essentiellement des imports
  inutilisés. Vérifier que vos fichiers n'en ajoutent pas, ignorer les autres.
- **Aucun test, aucune CI de build.** La validation passe par `npm run build` et
  une vérification manuelle.
- **`checkIsAdmin()` est asynchrone** (requête base) : ne jamais l'utiliser pour
  conditionner des routes React, cela crée une course au premier rendu. Préférer
  une vérification synchrone sur `VITE_ADMIN_EMAILS`.
- **`console.log` dans les Edge Functions** : ne jamais journaliser le contenu
  généré, il contient des noms d'élèves.

## Commandes

```bash
cd comgeneratorV2
npm ci          # les dépendances ne sont pas installées par défaut
npm run build   # seule validation disponible ; doit passer avant tout commit
npm run dev
```

## Automatismes en place

- **`.github/workflows/supabase-backup.yml`** — sauvegarde nocturne chiffrée
  (03h43 UTC), conservée 90 jours. Secrets requis : `SUPABASE_DB_URL` (Session
  pooler, port 5432) et `BACKUP_PASSPHRASE`.
- **`.github/workflows/supabase-keepalive.yml`** — ping quotidien empêchant la mise
  en pause du projet Supabase (plan gratuit).
