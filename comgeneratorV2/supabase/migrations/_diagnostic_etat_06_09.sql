-- _diagnostic_etat_06_09.sql
--
-- LECTURE SEULE — ne modifie rien. À coller dans l'éditeur SQL du dashboard.
--
-- Dit quelles migrations du 06/09/2026 sont réellement passées en production,
-- et si un objet supprimé ce jour-là est encore référencé quelque part.
-- Le préfixe `_` écarte ce fichier de l'ordre chronologique des migrations :
-- ce n'est pas une migration, c'est un outil de diagnostic.

-- ============================================================================
-- A. Quelles migrations sont appliquées
-- ============================================================================

SELECT * FROM (
  SELECT 1 AS n, 'feedback_sessions' AS objet,
         CASE WHEN to_regclass('public.feedback_sessions') IS NULL
              THEN 'absente  → 20260906_drop_feedback_tables APPLIQUÉE'
              ELSE 'présente → 20260906_drop_feedback_tables NON appliquée' END AS etat
  UNION ALL
  SELECT 2, 'feedback_ratings',
         CASE WHEN to_regclass('public.feedback_ratings') IS NULL
              THEN 'absente  → cohérent avec la migration appliquée'
              ELSE 'présente → migration non appliquée' END
  UNION ALL
  SELECT 3, 'feedback_comments',
         CASE WHEN to_regclass('public.feedback_comments') IS NULL
              THEN 'absente  → cohérent avec la migration appliquée'
              ELSE 'présente → migration non appliquée' END
  UNION ALL
  SELECT 4, 'claim_feedback_reward()',
         CASE WHEN EXISTS (SELECT 1 FROM pg_proc p
                             JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
                            WHERE nsp.nspname = 'public'
                              AND p.proname = 'claim_feedback_reward')
              THEN 'présente → la RPC n''a PAS été supprimée'
              ELSE 'absente  → cohérent avec la migration appliquée' END
  UNION ALL
  SELECT 5, 'deleted_users_blacklist',
         CASE WHEN to_regclass('public.deleted_users_blacklist') IS NULL
              THEN '🚨 ABSENTE → l''inscription est cassée, appliquer 20260906c'
              ELSE 'présente → correctif 20260906c en place' END
  UNION ALL
  SELECT 6, 'trigger discard_inserts (blacklist)',
         CASE WHEN EXISTS (SELECT 1 FROM pg_trigger t
                            WHERE t.tgname = 'discard_inserts'
                              AND NOT t.tgisinternal)
              THEN 'présent → 20260906_stop_feeding... a été appliquée'
              ELSE 'absent   → 20260906_stop_feeding... sautée (c''était l''instruction)' END
  UNION ALL
  SELECT 7, 'delete_user_account() — version',
         CASE WHEN EXISTS (SELECT 1 FROM pg_proc p
                             JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
                            WHERE nsp.nspname = 'public'
                              AND p.proname = 'delete_user_account'
                              AND p.prosrc ILIKE '%scenarios_bank%')
              THEN 'NOUVELLE → 20260906b appliquée (suppression complète)'
              ELSE 'ANCIENNE → 20260906b NON appliquée : scénarios, documents et
             fichiers Storage survivent à la suppression de compte' END
  UNION ALL
  SELECT 8, 'delete_user_account() — alimente encore la blacklist ?',
         CASE WHEN EXISTS (SELECT 1 FROM pg_proc p
                             JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
                            WHERE nsp.nspname = 'public'
                              AND p.proname = 'delete_user_account'
                              AND p.prosrc ILIKE '%deleted_users_blacklist%')
              THEN 'OUI → garde-fou anti-réinscription actif'
              ELSE 'NON → garde-fou INERTE : suppression + réinscription = 10 000 tokens' END
) AS etat_migrations
ORDER BY n;

-- ============================================================================
-- B. LA requête de sûreté — celle qui aurait évité la panne
-- ============================================================================
-- Liste toute fonction de la base dont le corps mentionne un objet supprimé
-- le 06/09. Chaque ligne renvoyée est une dépendance cassée, ou sur le point
-- de l'être. `handle_new_user` doit apparaître pour deleted_users_blacklist :
-- c'est normal et attendu, la table est rétablie.
--
-- ⚠️ À rejouer AVANT tout futur DROP, en changeant l'objet visé.

SELECT nsp.nspname AS schema,
       p.proname   AS fonction,
       CASE
         WHEN p.prosrc ILIKE '%deleted_users_blacklist%' THEN 'deleted_users_blacklist'
         WHEN p.prosrc ILIKE '%feedback_sessions%'       THEN 'feedback_sessions'
         WHEN p.prosrc ILIKE '%feedback_ratings%'        THEN 'feedback_ratings'
         WHEN p.prosrc ILIKE '%feedback_comments%'       THEN 'feedback_comments'
         WHEN p.prosrc ILIKE '%claim_feedback_reward%'   THEN 'claim_feedback_reward'
       END AS objet_reference
  FROM pg_proc p
  JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
 WHERE nsp.nspname NOT IN ('pg_catalog', 'information_schema')
   AND (p.prosrc ILIKE '%deleted_users_blacklist%'
     OR p.prosrc ILIKE '%feedback_sessions%'
     OR p.prosrc ILIKE '%feedback_ratings%'
     OR p.prosrc ILIKE '%feedback_comments%'
     OR p.prosrc ILIKE '%claim_feedback_reward%')
 ORDER BY 3, 2;

-- ============================================================================
-- C. Vues et contraintes visant les mêmes objets
-- ============================================================================
-- Une fonction n'est pas le seul moyen de dépendre d'une table. Ces deux
-- requêtes couvrent le reste.

SELECT c.relname AS vue, nsp.nspname AS schema
  FROM pg_class c
  JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
 WHERE c.relkind IN ('v', 'm')
   AND nsp.nspname NOT IN ('pg_catalog', 'information_schema')
   AND pg_get_viewdef(c.oid) ILIKE ANY (ARRAY[
         '%deleted_users_blacklist%', '%feedback_sessions%',
         '%feedback_ratings%', '%feedback_comments%'])
 ORDER BY 1;

SELECT conrelid::regclass AS table_source,
       conname            AS contrainte,
       confrelid::regclass AS table_cible
  FROM pg_constraint
 WHERE contype = 'f'
   AND confrelid::regclass::text IN
       ('deleted_users_blacklist', 'feedback_sessions',
        'feedback_ratings', 'feedback_comments')
 ORDER BY 1;

-- ============================================================================
-- D. La blacklist est-elle bien vide
-- ============================================================================
-- À n'exécuter que si la section A indique la table présente.

SELECT count(*) AS lignes_blacklist FROM public.deleted_users_blacklist;
