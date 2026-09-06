-- 20260906b_fix_delete_user_account.sql
--
-- Corrige `delete_user_account()` : la suppression de compte était INCOMPLÈTE.
--
-- ⚠️ À APPLIQUER APRÈS 20260906_stop_feeding_deleted_users_blacklist.sql,
--    ou À SA PLACE si celle-ci n'a pas encore été appliquée : ce fichier
--    couvre les deux cas et est idempotent.
--
-- ============================================================================
-- Le constat
-- ============================================================================
-- La définition en production, extraite le 06/09/2026, supprimait huit tables :
-- transactions, appreciations, lessons, lessons_bank, signatures, subjects,
-- user_rss_preferences, profiles — puis auth.users.
--
-- Elle NE supprimait PAS le contenu suivant, pourtant rattaché au compte par
-- une colonne `user_id` (vérifié dans le code applicatif) :
--
--   * scenarios_bank    — scénarios pédagogiques enregistrés
--   * chatbot_answers   — réponses de l'assistant documentaire mises en banque
--   * rag_documents     — documents importés par l'utilisateur
--   * rag_chunks        — texte extrait et embeddings de ces documents
--   * rag_conversations — échanges avec l'assistant documentaire
--   * rag_folders       — dossiers de classement
--
-- ni les FICHIERS eux-mêmes dans le bucket Storage `rag-documents`, déposés
-- sous le préfixe `<user_id>/`.
--
-- Certaines de ces tables disparaissaient peut-être déjà par cascade au moment
-- du DELETE FROM auth.users — `rag_folders`, `generation_events` et
-- `credit_ledger` déclarent bien ON DELETE CASCADE dans leurs migrations. Mais
-- 18 des 29 tables de production ont été créées via le dashboard : leurs
-- contraintes ne sont versionnées nulle part et ne peuvent pas être vérifiées
-- depuis le dépôt. On ne peut donc pas s'en remettre à la cascade.
--
-- Cette incomplétude contredisait deux engagements : le message de
-- confirmation de l'interface (« Toutes vos données seront perdues ») et la
-- politique de confidentialité, qui annonce l'effacement des documents
-- importés avec le compte.
--
-- ============================================================================
-- Ce que change cette migration
-- ============================================================================
-- 1. Suppression explicite de tout contenu rattaché au compte, sans dépendre
--    des cascades — une suppression redondante avec une cascade est sans
--    effet ni coût, une cascade absente serait une fuite.
-- 2. Suppression des fichiers du bucket Storage.
-- 3. Retrait de l'INSERT dans deleted_users_blacklist (décision du 06/09/2026).
--    ⚠️ La TABLE, elle, est CONSERVÉE : `handle_new_user()` la consulte à
--    chaque inscription. Voir la note en fin de script.
-- 4. Ajout de `SET search_path` : la fonction est SECURITY DEFINER et s'en
--    passait, ce qui l'exposait à une résolution de noms détournée par un
--    search_path hostile.
--
-- La fonction reste défensive : chaque table n'est traitée que si elle existe
-- ET porte une colonne `user_id`. Une table absente ou renommée ne peut donc
-- pas faire échouer une suppression de compte.

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_table text;
  -- Ordre volontaire : les tables filles avant leurs parentes, `profiles` en
  -- dernier. rag_messages n'apparaît pas : elle est rattachée à
  -- rag_conversations par conversation_id et non à l'utilisateur, elle part
  -- donc avec sa conversation.
  v_tables constant text[] := ARRAY[
    'rag_chunks',
    'rag_conversations',
    'rag_documents',
    'rag_folders',
    'chatbot_answers',
    'scenarios_bank',
    'lessons_bank',
    'lessons',
    'appreciations',
    'signatures',
    'subjects',
    'user_rss_preferences',
    'transactions',
    'profiles'
  ];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'delete_user_account : aucun utilisateur authentifié';
  END IF;

  -- 1. Contenu applicatif
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || quote_ident(v_table)) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = v_table
            AND column_name = 'user_id'
       )
    THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_table)
        USING v_uid;
    END IF;
  END LOOP;

  -- 2. Fichiers importés. Convention de nommage posée par rag-upload-sign :
  --    `<user_id>/<document_id>/<nom de fichier>`. Le champ owner n'est pas
  --    fiable ici, les dépôts passant par une URL signée.
  DELETE FROM storage.objects
   WHERE bucket_id = 'rag-documents'
     AND name LIKE v_uid::text || '/%';

  -- 3. Le compte lui-même. Emporte au passage, par cascade, les tables qui
  --    déclarent une clé étrangère ON DELETE CASCADE vers auth.users
  --    (credit_ledger, generation_events, consent_logs…).
  DELETE FROM auth.users WHERE id = v_uid;
END;
$function$;

-- ============================================================================
-- La blacklist n'est plus alimentée — mais la table reste
-- ============================================================================
-- Le trigger posé par 20260906_stop_feeding_deleted_users_blacklist.sql
-- neutralisait l'INSERT faute de connaître la définition de la fonction.
-- Celle-ci étant corrigée à la source, le trigger devient inutile et peut
-- partir. Les IF EXISTS rendent le script applicable que la migration
-- précédente ait été passée ou non.
--
-- La TABLE, en revanche, doit rester : voir ci-dessous.

DROP TRIGGER IF EXISTS discard_inserts ON public.deleted_users_blacklist;
DROP FUNCTION IF EXISTS public.discard_deleted_users_blacklist_insert();

-- ⛔ LIGNE RETIRÉE LE 06/09/2026 — NE PAS LA RÉTABLIR
--
--     DROP TABLE IF EXISTS public.deleted_users_blacklist;
--
-- Ce DROP a cassé l'inscription en production : « Database error saving new
-- user ». La fonction `public.handle_new_user()`, appelée par le trigger
-- `on_auth_user_created AFTER INSERT ON auth.users`, référence cette table.
-- Elle a été créée depuis le dashboard : sa définition ne figure dans aucune
-- migration, et la recherche du 18/08 qui concluait qu'« aucun code ne lit
-- cette table » ne portait que sur src/ et les Edge Functions.
--
-- Table rétablie par 20260906c_hotfix_restore_blacklist_table.sql.
--
-- Règle qui en découle, valable pour tout ce projet : avant tout DROP d'un
-- objet, inventorier ses dépendances CÔTÉ BASE, pas seulement dans le dépôt :
--
--     SELECT n.nspname, p.proname
--       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
--        AND p.prosrc ILIKE '%<objet visé>%';

-- ============================================================================
-- Vérification attendue après application
-- ============================================================================
--
-- 1. La table est TOUJOURS LÀ (sa suppression casse l'inscription) :
--
--        SELECT to_regclass('public.deleted_users_blacklist');  -- non NULL
--
-- 1 bis. L'inscription fonctionne : créer un compte de test.
--
-- 2. Aucune table rattachée à un utilisateur n'échappe à la suppression.
--    La requête ci-dessous liste toute table de `public` portant une colonne
--    `user_id` et indique si une cascade la purgerait. Toute ligne marquée
--    « ❌ » doit figurer dans v_tables ci-dessus — sans quoi son contenu
--    survivrait à la suppression du compte :
--
--        SELECT cl.relname AS "table",
--               CASE WHEN con.oid IS NULL THEN '❌ pas de cascade'
--                    WHEN con.confdeltype = 'c' THEN '✅ ON DELETE CASCADE'
--                    ELSE '⚠️ FK sans cascade'
--               END AS purge_automatique
--          FROM pg_class cl
--          JOIN pg_namespace ns ON ns.oid = cl.relnamespace
--                              AND ns.nspname = 'public'
--          JOIN pg_attribute at ON at.attrelid = cl.oid
--                              AND at.attname = 'user_id'
--                              AND NOT at.attisdropped
--          LEFT JOIN pg_constraint con ON con.conrelid = cl.oid
--                              AND con.contype = 'f'
--                              AND con.confrelid = 'auth.users'::regclass
--                              AND at.attnum = ANY (con.conkey)
--         WHERE cl.relkind = 'r'
--         ORDER BY 2, 1;
--
-- 3. Sur un compte de test : créer un compte, importer un document, créer un
--    scénario, supprimer le compte, puis vérifier qu'il ne reste rien —
--    notamment dans storage.objects :
--
--        SELECT count(*) FROM storage.objects
--         WHERE bucket_id = 'rag-documents' AND name LIKE '<uuid du test>/%';
