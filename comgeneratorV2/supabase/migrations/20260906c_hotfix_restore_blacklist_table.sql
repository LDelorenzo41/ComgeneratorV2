-- 20260906c_hotfix_restore_blacklist_table.sql
--
-- 🚨 CORRECTIF D'URGENCE — l'inscription échoue avec « Database error saving new user »
--
-- À APPLIQUER IMMÉDIATEMENT dans l'éditeur SQL du dashboard Supabase.
--
-- ============================================================================
-- Ce qui s'est passé
-- ============================================================================
-- La migration 20260906b a exécuté `DROP TABLE public.deleted_users_blacklist`.
-- L'analyse qui a conduit à ce DROP s'appuyait sur la migration du 18/08, qui
-- concluait qu'« aucun code ne lit cette table » — recherche menée dans `src/`
-- et dans les Edge Functions. Cette recherche ne pouvait PAS voir les triggers
-- et fonctions SQL créés depuis le dashboard, qui ne sont versionnés nulle
-- part. Or `supabase/GRANTS_DATA_API.md` décrit l'inscription comme
-- « vérification blacklist + trigger handle_new_user » : la vérification
-- existe donc bien, au niveau de la base.
--
-- Un trigger sur `auth.users` qui référence une table absente fait échouer
-- l'INSERT, et GoTrue renvoie exactement « Database error saving new user ».
--
-- ============================================================================
-- Ce que fait ce script
-- ============================================================================
-- Il recrée la table, VIDE, avec la forme attendue par un appelant qui ferait
-- soit un `SELECT ... WHERE email = ...`, soit un
-- `INSERT ... ON CONFLICT (email) DO NOTHING`. Il ne restaure aucune donnée :
-- les adresses effacées le restent, ce qui était l'objectif initial.
--
-- Strictement additif : recréer une table absente ne peut rien casser d'autre.
-- Si l'inscription ne repart pas après application, la cause est ailleurs et
-- le diagnostic en pied de fichier l'identifiera.

CREATE TABLE IF NOT EXISTS public.deleted_users_blacklist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

-- La contrainte d'unicité est indispensable : un appelant historique utilisait
-- `ON CONFLICT (email)`, qui exige un index unique sur cette colonne.
CREATE UNIQUE INDEX IF NOT EXISTS deleted_users_blacklist_email_key
  ON public.deleted_users_blacklist (lower(email));

ALTER TABLE public.deleted_users_blacklist ENABLE ROW LEVEL SECURITY;

-- Lecture ouverte aux rôles susceptibles de porter la vérification
-- d'inscription. La table est et restera VIDE — plus aucun code ne
-- l'alimente depuis la correction de delete_user_account() — donc cette
-- ouverture n'expose aucune donnée. C'est le compromis assumé d'un correctif
-- d'urgence : on privilégie la certitude que l'inscription reparte.
DROP POLICY IF EXISTS "hotfix_read_blacklist" ON public.deleted_users_blacklist;
CREATE POLICY "hotfix_read_blacklist"
  ON public.deleted_users_blacklist
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "hotfix_service_manage_blacklist" ON public.deleted_users_blacklist;
CREATE POLICY "hotfix_service_manage_blacklist"
  ON public.deleted_users_blacklist
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.deleted_users_blacklist TO anon, authenticated;
GRANT ALL    ON public.deleted_users_blacklist TO service_role;

-- Certains triggers d'authentification s'exécutent sous un rôle dédié qui
-- n'est ni anon ni authenticated. Le GRANT est tenté sans faire échouer le
-- script si le rôle n'existe pas sur ce projet.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.deleted_users_blacklist TO supabase_auth_admin';
  END IF;
END
$$;

COMMENT ON TABLE public.deleted_users_blacklist IS
  'Recréée VIDE le 06/09/2026 en correctif d''urgence : sa suppression avait '
  'cassé l''inscription. Plus aucun code ne l''alimente. Ne la supprimer qu''une '
  'fois retirée la dépendance qui la référence — voir le diagnostic de '
  'la migration 20260906c.';

-- ============================================================================
-- VÉRIFICATION IMMÉDIATE — créer un compte de test doit fonctionner
-- ============================================================================
--
-- ============================================================================
-- DIAGNOSTIC — à exécuter et à transmettre, pour la correction propre
-- ============================================================================
--
-- 1. Tout ce qui est accroché à auth.users :
--
--        SELECT tgname,
--               pg_get_triggerdef(t.oid) AS definition
--          FROM pg_trigger t
--         WHERE t.tgrelid = 'auth.users'::regclass
--           AND NOT t.tgisinternal;
--
-- 2. Le corps de chaque fonction appelée par ces triggers, par exemple :
--
--        SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
--
-- 3. Toute fonction de la base qui mentionne encore un objet supprimé
--    aujourd'hui — c'est la requête qui aurait dû être passée AVANT les DROP :
--
--        SELECT n.nspname AS schema, p.proname AS fonction
--          FROM pg_proc p
--          JOIN pg_namespace n ON n.oid = p.pronamespace
--         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
--           AND (p.prosrc ILIKE '%deleted_users_blacklist%'
--             OR p.prosrc ILIKE '%feedback_sessions%'
--             OR p.prosrc ILIKE '%feedback_ratings%'
--             OR p.prosrc ILIKE '%feedback_comments%'
--             OR p.prosrc ILIKE '%claim_feedback_reward%')
--         ORDER BY 1, 2;
--
-- 4. Mêmes vérifications côté vues et contraintes :
--
--        SELECT conrelid::regclass AS table_source, conname, confrelid::regclass AS table_cible
--          FROM pg_constraint
--         WHERE contype = 'f'
--           AND confrelid::regclass::text IN ('deleted_users_blacklist');
