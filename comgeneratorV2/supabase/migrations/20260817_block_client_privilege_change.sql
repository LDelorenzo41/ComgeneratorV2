-- 20260817_block_client_privilege_change.sql
--
-- Empêche un utilisateur d'élever lui-même ses privilèges.
--
-- Constat : la policy « Users can update their profile » autorise un compte
-- authentifié à modifier sa propre ligne de `profiles` sans restriction de
-- colonne (USING et WITH CHECK ne testent que `auth.uid() = user_id`).
-- N'importe quel utilisateur pouvait donc exécuter, depuis la console de son
-- navigateur :
--
--     supabase.from('profiles').update({ is_admin: true }).eq('user_id', <son id>)
--
-- et obtenir l'accès au tableau de bord d'administration, à la newsletter et
-- surtout à la création de codes promotionnels — donc à des crédits gratuits.
-- Cette faille est antérieure à la présente migration ; elle devient critique
-- maintenant que `profiles.is_admin` conditionne aussi l'accès à l'assistant
-- documentaire côté serveur.
--
-- Choix de mise en œuvre : un trigger additif plutôt qu'une réécriture de la
-- policy. Réécrire la policy risquerait de bloquer les mises à jour légitimes
-- de profil (préférences de newsletter, notamment) ; le trigger ne refuse que
-- la modification des colonnes de privilège, et se retire d'un DROP TRIGGER.
-- Le motif reprend exactement celui de `block_client_token_increase`, déjà en
-- production sur cette même table (migration 20260813).
--
-- Ce que la migration NE fait PAS : elle ne touche ni aux policies, ni aux
-- données, ni aux droits existants. `service_role` (Edge Functions, Stripe,
-- administration) reste libre de modifier ces colonnes.

CREATE OR REPLACE FUNCTION public.block_client_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne s'applique qu'aux rôles clients. Les Edge Functions et les migrations
  -- s'exécutent en `service_role` ou `postgres` et ne sont pas concernées.
  IF current_user IN ('authenticated', 'anon') THEN

    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Modification du statut administrateur interdite';
    END IF;

    -- Même raisonnement pour l'accès à la Banque : il est accordé par le
    -- règlement d'un achat (webhook Stripe, en service_role), jamais par le
    -- client lui-même.
    IF NEW.has_bank_access IS DISTINCT FROM OLD.has_bank_access THEN
      RAISE EXCEPTION 'Modification de l''accès Banque interdite';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_client_privilege_change ON public.profiles;

CREATE TRIGGER trg_block_client_privilege_change
  BEFORE UPDATE OF is_admin, has_bank_access ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.block_client_privilege_change();

-- Vérification manuelle attendue après application, depuis un compte non
-- administrateur (la requête doit échouer) :
--
--     update profiles set is_admin = true where user_id = auth.uid();
--     -- ERROR: Modification du statut administrateur interdite
--
-- Et depuis l'éditeur SQL du dashboard (rôle postgres), elle doit réussir :
--
--     update profiles set is_admin = true where user_id = '<uuid>';
