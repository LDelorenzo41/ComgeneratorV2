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
- **L'aide intégrée décrit l'interface au libellé près** : chaque page fonctionnelle
  a son tutoriel dans `src/help/tutorials/` (registre et publication :
  `src/help/topics.ts`). Renommer un bouton, retirer un champ ou changer un coût
  impose de mettre à jour le tutoriel de la page dans le même commit, sinon l'aide
  envoie l'utilisateur vers un bouton qui n'existe plus.

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

## Déploiement — trois circuits distincts, à ne pas confondre

Rien ne se déploie tout seul, et une modification peut très bien être fusionnée
sans être en production. Vérifier lequel des trois circuits est concerné :

| Ce qui change | Comment ça arrive en production |
|---|---|
| `src/**` (frontend) | Netlify reconstruit automatiquement à la fusion sur `main` |
| `supabase/functions/**` | **Rien d'automatique.** L'exploitant lance `npx supabase functions deploy <nom>` |
| `supabase/migrations/**` | **Rien d'automatique.** L'exploitant colle le SQL dans l'éditeur du dashboard |

- **Toujours déployer les Edge Functions par le CLI, jamais depuis le dashboard.**
  Plusieurs fonctions importent `../_shared/*.ts` ; le CLI embarque ces imports
  relatifs, l'éditeur du dashboard ne les affiche même pas et un déploiement par
  ce biais casserait la fonction.
- Après toute modification d'une Edge Function ou d'une migration, **dire
  explicitement à l'exploitant ce qu'il doit déployer ou appliquer**, et par quel
  circuit. Sans cela le travail reste sans effet.

## Supabase : toute nouvelle table doit recevoir ses droits d'accès

À partir du **30 octobre 2026**, Supabase n'accorde plus aucun droit automatique sur
les **nouvelles** tables du schéma `public`, ni sur leurs séquences. Sans `GRANT`
explicite, l'API (supabase-js, PostgREST, GraphQL) répond `42501 permission
denied`, même avec une RLS correcte — **`service_role` compris** : il contourne la
RLS, pas les `GRANT`. Les tables existantes gardent leurs droits ; elles ont en
plus reçu des `GRANT` explicites le 04/07/2026 (`comgeneratorV2/supabase/GRANTS_DATA_API.md`).

**Règle : le script qui contient le `CREATE TABLE` contient aussi, dans le même
fichier :**

1. `ALTER TABLE … ENABLE ROW LEVEL SECURITY` ;
2. les policies, une par opération réellement utilisée, avec un rôle nommé
   (`TO authenticated`, jamais `TO public`) ;
3. un `REVOKE ALL`, puis les `GRANT` explicites pour `anon`, `authenticated` et
   `service_role`, limités à ce dont chaque rôle a besoin. Le `REVOKE` rend le
   résultat identique avant ou après le 30/10, et dans un projet restauré.

| Rôle | Qui l'utilise dans ProfAssist | Droits sur une nouvelle table |
|---|---|---|
| `anon` | Visiteurs non connectés : `/`, `/landing`, `/login`, `/register`, `/reset-password`, `/auth/callback`, `/legal/*`, `/unsubscribe`. Aucune de ces pages ne lit de table : `/unsubscribe` passe par la fonction `unsubscribe_newsletter`, et l'écriture du bandeau cookies dans `consent_logs` est refusée, faute de policy `anon` (sans effet visible). La clé `anon` est publique : elle figure dans le bundle servi par Netlify. | **Aucun `GRANT`.** Exception possible pour une page publique qui en a réellement besoin : policy `TO anon` dédiée et justification écrite dans le script. |
| `authenticated` | Le front React (`src/**`) une fois connecté. | Seulement les opérations que le front effectue, chacune couverte par une policy `auth.uid() = user_id`. Table écrite uniquement par le serveur : `SELECT` seul (modèle : `credit_ledger`). |
| `service_role` | Toutes les Edge Functions (`SUPABASE_SERVICE_ROLE_KEY`, y compris `_shared/credits.ts`) : génération IA, crédits, webhook Stripe, `verify-payment`, `fetch-rss`, `send-newsletter`, et le keep-alive `ping` lancé chaque jour par GitHub Actions. | Les opérations que les fonctions effectuent. Un oubli casse la fonction côté serveur, sans message clair dans le navigateur. |

Une table touchée **uniquement** par une fonction `SECURITY DEFINER` appartenant à
`postgres` (`handle_new_user()`, `consume_credits()`, `delete_user_account()`…) n'a
besoin d'aucun `GRANT` pour ce chemin : la fonction agit avec les droits de son
propriétaire.

Modèle à recopier :

```sql
-- 1. Table. Clé UUID comme partout dans le projet : aucune séquence à gérer.
CREATE TABLE IF NOT EXISTS public.ma_table (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contenu    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.ma_table ENABLE ROW LEVEL SECURITY;

-- 3. Policies : une par opération utilisée, rôle nommé
DROP POLICY IF EXISTS "ma_table_select_own" ON public.ma_table;
CREATE POLICY "ma_table_select_own" ON public.ma_table
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ma_table_insert_own" ON public.ma_table;
CREATE POLICY "ma_table_insert_own" ON public.ma_table
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 4. Droits d'accès : on part de zéro, puis le strict nécessaire
REVOKE ALL ON public.ma_table FROM anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.ma_table TO authenticated;                 -- ce que fait le front
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ma_table TO service_role;  -- ce que font les Edge Functions
-- anon : rien.

-- Seulement si la table a une colonne serial ou identity (à éviter), pour les rôles
-- qui insèrent — indispensable pour serial, sans quoi l'INSERT échoue :
-- GRANT USAGE, SELECT ON SEQUENCE public.ma_table_id_seq TO authenticated, service_role;
```

Rappel : `SELECT` est exigé en plus dès qu'une requête relit ou filtre des lignes —
`.insert(…).select()`, `UPDATE` ou `DELETE` filtré, upsert (qui exige aussi `INSERT`
et `UPDATE`) — avec la policy `SELECT` qui va avec.

Contrôle après application, dans l'éditeur SQL :

```sql
SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS droits
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'ma_table'
   AND grantee IN ('anon', 'authenticated', 'service_role')
 GROUP BY grantee;
```

Pièges propres à ce projet :

- **Un test dans l'éditeur SQL ne prouve rien** : il s'exécute en `postgres`,
  propriétaire des tables. Tester depuis l'application, ou avec la requête ci-dessus.
- **Ne pas compter sur les `ALTER DEFAULT PRIVILEGES`** posés par
  `20260704_grant_data_api_explicit.sql` : le changement Supabase peut les
  neutraliser, et ils n'existent pas dans un projet neuf.
- **Recréer une table, c'est créer une table neuve** : un `DROP` suivi d'un
  `CREATE`, correctif d'urgence compris, perd droits et policies. Précédent :
  `deleted_users_blacklist`, 06/09/2026.
- **Jamais de `GRANT … ON ALL TABLES IN SCHEMA public`** dans une nouvelle
  migration : il rouvrirait des restrictions volontaires (`credit_ledger` en
  lecture seule pour `authenticated` ; `anon` retiré de `deleted_users_blacklist`,
  `rag_documents` et `rag_chunks`).
- **Une restauration de la sauvegarde crée des tables neuves sans aucun droit** :
  le dump nocturne est pris avec `--no-privileges`. Après restauration dans un
  nouveau projet, rejouer tous les `GRANT` et `REVOKE` des migrations, dans
  l'ordre, avant de rouvrir le service.
- **Les fonctions ne sont pas concernées par la règle du 30/10** : elles restent
  exécutables par tous par défaut, `anon` compris. Toute nouvelle fonction :
  `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated;` puis `GRANT EXECUTE`
  ciblé (modèle : `consume_credits` dans `20260813_credit_ledger.sql`). Retirer le
  droit à `anon` sans le retirer à `PUBLIC` ne sert à rien : tout rôle hérite des
  droits de `PUBLIC`.

## Git — les PR sont fusionnées en *squash*

Conséquence à connaître, sous peine de diagnostics erronés :

- Les commits d'origine restent sur la branche avec des SHA différents de ceux
  créés sur `main`. GitHub les compte comme « en avance » alors que leur contenu
  est déjà fusionné. **Le compteur de commits ment ; seul `git diff origin/main`
  fait foi.**
- **Réaligner la branche sur `main` après chaque fusion** (`git checkout -B <branche>
  origin/main`, puis réappliquer le travail en cours). Sans cela, les commits
  fantômes s'accumulent et provoquent des conflits artificiels sur des lignes que
  la branche avait elle-même introduites.
- Branche de travail : `claude/profassist-architecture-audit-lexa00`.
