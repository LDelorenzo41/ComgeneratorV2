-- 20260906e_revoke_anon_on_blacklist.sql
--
-- 🔴 CORRECTIF DE SÉCURITÉ — à appliquer sans attendre.
--
-- ============================================================================
-- Ce que j'ai cassé
-- ============================================================================
-- Mon correctif d'urgence 20260906c a recréé `deleted_users_blacklist` avec
-- une policy `FOR SELECT TO anon, authenticated` et un `GRANT SELECT ... TO
-- anon`. Ce faisant, il a annulé sans le voir la migration
-- 20260818_restrict_deleted_users_blacklist.sql, qui avait délibérément
-- révoqué `anon` — au motif, écrit noir sur blanc, que la table contient
-- « des adresses e-mail de personnes ayant demandé la suppression de leur
-- compte, exactement les données qu'un effacement est censé protéger ».
--
-- Je m'étais justifié en écrivant que la table « est et restera vide ».
-- C'était vrai à l'instant où je l'ai écrit, et faux quelques heures plus
-- tard : le retour arrière 20260906d a rétabli la fonction d'origine, qui
-- réalimente la blacklist à chaque suppression de compte. La clé `anon` est
-- publique — elle figure dans le bundle servi par Netlify — donc n'importe
-- quel visiteur peut lire la liste :
--
--     supabase.from('deleted_users_blacklist').select('email')
--
-- ============================================================================
-- Pourquoi retirer `anon` ne casse rien
-- ============================================================================
-- `handle_new_user()` est SECURITY DEFINER et appartient à `postgres`, rôle
-- porteur de BYPASSRLS (vérifié en production le 06/09). Elle ne consulte
-- donc la table ni sous `anon`, ni sous `authenticated`, et ne dépend
-- d'aucune de ces autorisations. L'inscription continue de fonctionner.
--
-- On retient `authenticated` en lecture, exactement comme le faisait la
-- migration du 18/08 : filet pour une éventuelle fonction SQL non versionnée
-- qui lirait la table en SECURITY INVOKER, laquelle serait de toute façon
-- appelée par un utilisateur connecté.

DROP POLICY IF EXISTS "hotfix_read_blacklist" ON public.deleted_users_blacklist;

CREATE POLICY "hotfix_read_blacklist"
  ON public.deleted_users_blacklist
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.deleted_users_blacklist FROM anon;

-- ============================================================================
-- Vérifications après application
-- ============================================================================
--
-- 1. Depuis un navigateur DÉCONNECTÉ, sur profassist.net, console :
--
--        await supabase.from('deleted_users_blacklist').select('email')
--        // doit renvoyer une erreur de permission, plus la liste
--
-- 2. Créer un compte de test : l'inscription doit fonctionner.
--
-- 3. Contrôle des droits restants :
--
--        SELECT grantee, privilege_type
--          FROM information_schema.role_table_grants
--         WHERE table_schema = 'public'
--           AND table_name = 'deleted_users_blacklist'
--         ORDER BY 1, 2;
--        -- `anon` ne doit plus y figurer
