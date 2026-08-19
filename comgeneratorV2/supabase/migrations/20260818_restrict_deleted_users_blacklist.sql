-- 20260818_restrict_deleted_users_blacklist.sql
--
-- Retire l'accès public en lecture à la liste des e-mails de comptes supprimés.
--
-- Constat : la table `deleted_users_blacklist` était lisible par le rôle
-- `anon`, c'est-à-dire par n'importe quel visiteur non connecté, via une
-- policy `USING (true)` doublée d'un `GRANT SELECT ... TO anon`. Elle contient
-- des adresses e-mail de personnes ayant demandé la suppression de leur compte
-- — exactement les données qu'un effacement est censé protéger.
--
-- Vérification préalable à cette migration : recherche exhaustive dans `src/`
-- et dans les 21 Edge Functions, plus relecture de l'historique git. Aucun
-- code ne lit cette table. En particulier, le parcours d'inscription
-- (`RegisterForm.tsx`) appelle directement `supabase.auth.signUp()` sans
-- consultation préalable, et `handle_new_user()` n'insère que dans `profiles`.
-- Le commentaire « Vérification d'email supprimé à l'inscription » qui
-- accompagnait le GRANT décrivait donc une intention, jamais implémentée.
--
-- Choix : on retire `anon` et on conserve `authenticated` en lecture. Ce
-- filet couvre le cas d'une fonction SQL non versionnée (plusieurs ont été
-- créées via le dashboard) qui lirait la table en SECURITY INVOKER : elle
-- serait de toute façon appelée par un utilisateur connecté, jamais par un
-- visiteur anonyme. Les policies `service_role` restent intactes, donc
-- `delete_user_account()` continue d'alimenter la table normalement.
--
-- Réversible : réexécuter le GRANT et recréer la policy rétablit l'état
-- antérieur.

-- 1. Policy de lecture : restreinte aux utilisateurs connectés.
DROP POLICY IF EXISTS "Allow checking blacklisted emails" ON public.deleted_users_blacklist;

CREATE POLICY "Allow checking blacklisted emails"
  ON public.deleted_users_blacklist
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Droit de table : le rôle anonyme n'a plus besoin d'y accéder.
REVOKE SELECT ON public.deleted_users_blacklist FROM anon;

-- Vérification attendue après application, depuis un navigateur non connecté :
--
--     supabase.from('deleted_users_blacklist').select('email')
--     -- doit renvoyer une erreur de permission, plus la liste des adresses
--
-- Et le parcours d'inscription doit rester inchangé : création de compte,
-- réception du courriel de confirmation, connexion.
