/*
  # Lot 1 (Communication) — Registre de crédits + débit côté serveur

  1. Table `credit_ledger` : journal de chaque débit de crédits
     (qui, combien, quel outil, quel modèle, solde après opération).
     Lisible par l'utilisateur (ses propres lignes), écrite uniquement
     par la fonction `consume_credits`.

  2. Fonction `consume_credits` : débit atomique du solde, réservée au
     `service_role` (appelée uniquement par les Edge Functions).
     - UPDATE en une seule instruction : pas de course entre deux
       générations simultanées.
     - Solde plafonné à 0 : jamais négatif.
     - Trace chaque débit dans `credit_ledger`.

  Zéro régression :
  - Purement additif : aucun REVOKE sur `profiles` — les générateurs non
    encore migrés (appréciations, séances, synthèses…) continuent de
    débiter côté client comme avant.
  - Compatible ancien front ET ancien déploiement des Edge Functions :
    tant que rien n'appelle `consume_credits`, cette migration est inerte.

  Volontairement absent de cette migration (fera l'objet d'une migration
  séparée, après vérification que `redeem_promo_code` est SECURITY DEFINER) :
  le trigger bloquant les augmentations de solde par le rôle `authenticated`.
*/

-- ============================================================================
-- 1. Table credit_ledger
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  model text,
  balance_after integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
  ON public.credit_ledger (user_id, created_at DESC);

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- Lecture : chaque utilisateur voit uniquement ses propres débits
DROP POLICY IF EXISTS "Users can read their credit ledger" ON public.credit_ledger;
CREATE POLICY "Users can read their credit ledger"
  ON public.credit_ledger
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Écriture : uniquement via consume_credits (service_role).
-- Aucune policy INSERT/UPDATE/DELETE pour authenticated, et retrait des
-- privilèges directs posés par les GRANT globaux existants.
REVOKE INSERT, UPDATE, DELETE ON public.credit_ledger FROM authenticated;
REVOKE ALL ON public.credit_ledger FROM anon;
GRANT ALL ON public.credit_ledger TO service_role;

-- ============================================================================
-- 2. Fonction de débit atomique
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id uuid,
  p_amount integer,
  p_kind text,
  p_model text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'consume_credits: p_user_id est requis';
  END IF;

  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'consume_credits: montant invalide (%)', p_amount;
  END IF;

  IF p_kind IS NULL OR btrim(p_kind) = '' THEN
    RAISE EXCEPTION 'consume_credits: p_kind est requis';
  END IF;

  -- Débit atomique : une seule instruction UPDATE, pas de lecture préalable,
  -- donc pas de course entre deux générations simultanées du même utilisateur.
  -- GREATEST(0, …) : le coût réel n'est connu qu'après la génération, on
  -- plafonne donc à 0 plutôt que de refuser un débit déjà « consommé ».
  UPDATE public.profiles
     SET tokens = GREATEST(0, COALESCE(tokens, 0) - p_amount)
   WHERE user_id = p_user_id
  RETURNING tokens INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consume_credits: profil introuvable pour %', p_user_id;
  END IF;

  INSERT INTO public.credit_ledger (user_id, kind, amount, model, balance_after)
  VALUES (p_user_id, p_kind, p_amount, p_model, v_new_balance);

  RETURN v_new_balance;
END;
$$;

-- Réservée aux Edge Functions : ni anon, ni authenticated (motif identique à
-- 20260704_revoke_anon_function_exec.sql).
REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer, text, text) TO service_role;
