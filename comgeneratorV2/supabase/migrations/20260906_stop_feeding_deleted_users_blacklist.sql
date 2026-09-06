-- 20260906_stop_feeding_deleted_users_blacklist.sql
--
-- Cesse d'alimenter `deleted_users_blacklist` et vide son contenu.
--
-- Constat, établi lors de l'audit des pages légales du 06/09/2026 :
--   * la table conserve les adresses e-mail des comptes supprimés, sans durée
--     de conservation définie ;
--   * la migration du 18/08/2026 a déjà établi qu'AUCUN code ne la lit —
--     recherche exhaustive dans `src/` et dans les 21 Edge Functions, plus
--     relecture de l'historique git. La finalité annoncée à l'époque
--     (« vérification d'email supprimé à l'inscription ») n'a jamais été
--     implémentée : `RegisterForm.tsx` appelle directement
--     `supabase.auth.signUp()` sans consultation préalable ;
--   * conserver l'adresse d'une personne qui a précisément demandé
--     l'effacement de son compte, pour une finalité inexistante, est le
--     contraire de ce qu'on peut écrire dans une politique de confidentialité.
--
-- Décision de l'exploitant : on cesse de l'alimenter.
--
-- ============================================================================
-- Pourquoi un trigger plutôt qu'une modification de delete_user_account()
-- ============================================================================
-- La fonction `delete_user_account()` a été créée depuis le dashboard Supabase
-- et n'est versionnée nulle part dans ce dépôt : sa définition est inconnue de
-- ce fichier. La réécrire de mémoire ferait courir un risque bien plus grave
-- que celui qu'on corrige — une suppression de compte incomplète, laissant des
-- données orphelines, ou une fonction cassée qui empêcherait toute suppression.
--
-- On neutralise donc l'écriture au niveau de la table, sans toucher à la
-- fonction : son INSERT continue de s'exécuter sans erreur, mais n'insère plus
-- rien. La suppression de compte fonctionne exactement comme avant.
--
-- ⚠️ Ce trigger est un dispositif VISIBLE et volontaire, pas un contournement
-- silencieux : quiconque lira `delete_user_account()` verra un INSERT qui
-- semble alimenter la table. Le commentaire posé sur la table ci-dessous
-- l'avertit du contraire.
--
-- Étape suivante, propre, quand la définition de la fonction sera disponible :
-- retirer l'INSERT de `delete_user_account()`, puis supprimer ce trigger et la
-- table. Pour extraire la définition depuis l'éditeur SQL du dashboard :
--
--     SELECT pg_get_functiondef('public.delete_user_account()'::regprocedure);

-- ============================================================================
-- 1. Neutraliser les écritures à venir
-- ============================================================================

CREATE OR REPLACE FUNCTION public.discard_deleted_users_blacklist_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- RETURN NULL dans un trigger BEFORE INSERT abandonne la ligne sans erreur :
  -- l'appelant n'échoue pas, la ligne n'est simplement jamais écrite.
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.discard_deleted_users_blacklist_insert() IS
  'Abandonne silencieusement les insertions dans deleted_users_blacklist. '
  'Voir migration 20260906_stop_feeding_deleted_users_blacklist.sql.';

DROP TRIGGER IF EXISTS discard_inserts ON public.deleted_users_blacklist;

CREATE TRIGGER discard_inserts
  BEFORE INSERT ON public.deleted_users_blacklist
  FOR EACH ROW
  EXECUTE FUNCTION public.discard_deleted_users_blacklist_insert();

-- ============================================================================
-- 2. Vider le contenu existant
-- ============================================================================
-- Ces adresses n'ont aucune finalité et appartiennent à des personnes ayant
-- demandé la suppression de leur compte. ⚠️ IRRÉVERSIBLE.

DELETE FROM public.deleted_users_blacklist;

-- ============================================================================
-- 3. Avertir tout lecteur futur du schéma
-- ============================================================================

COMMENT ON TABLE public.deleted_users_blacklist IS
  'OBSOLÈTE — table volontairement neutralisée le 06/09/2026. Un trigger '
  'BEFORE INSERT abandonne toute écriture : delete_user_account() semble '
  'encore l''alimenter, mais elle reste vide. Aucun code ne la lit. '
  'À supprimer une fois l''INSERT retiré de delete_user_account().';

-- ============================================================================
-- Réversibilité
-- ============================================================================
--
--     DROP TRIGGER discard_inserts ON public.deleted_users_blacklist;
--
-- rétablit l'alimentation. Les adresses déjà effacées à l'étape 2 ne sont en
-- revanche récupérables que depuis une sauvegarde nocturne.
--
-- ============================================================================
-- Vérification attendue après application
-- ============================================================================
--
--     SELECT count(*) FROM public.deleted_users_blacklist;   -- doit valoir 0
--
-- Puis, après une suppression de compte de test, la même requête doit encore
-- renvoyer 0 — et la suppression doit s'être déroulée normalement.
