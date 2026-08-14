/*
  # Lot 1 (suite) — Garde-fou anti-triche sur le solde de crédits

  Constat : la policy RLS "Users can update their profile" autorise un
  utilisateur connecté à écrire n'importe quelle valeur dans profiles.tokens
  depuis la console de son navigateur (auto-crédit illimité).

  Cette migration bloque les AUGMENTATIONS de solde effectuées par le rôle
  `authenticated`, sans toucher aux diminutions (les générateurs non migrés
  — appréciations, séances, synthèses… — continuent de débiter côté client).

  Qui peut encore créditer un solde (vérifié avant activation) :
  - Stripe (stripe-webhook, verify-payment) : clé service → rôle
    `service_role`, non bloqué.
  - Codes promo : RPC redeem_promo_code, vérifiée SECURITY DEFINER en prod le
    13/08/2026 (prosecdef = true) → s'exécute sous le rôle de son
    propriétaire, non bloqué.
  - Migrations / admin SQL : rôle postgres, non bloqué.

  Flux client qui créditaient directement le solde (traités ici) :
  - Récompense feedback (+30 000, FeedbackPage) : flux ACTIF → remplacé par
    la RPC claim_feedback_reward() ci-dessous (contrôles côté serveur,
    une seule récompense par compte). Le front est mis à jour en conséquence.
  - Offre spéciale (+30 000, SpecialOfferModal) : date limite 10/12/2025
    dépassée, la modale ne s'affiche plus — flux dormant, volontairement
    non porté côté serveur. Si l'offre est relancée un jour, elle devra
    passer par une RPC du même modèle que claim_feedback_reward.

  ⚠️ Ordre de déploiement : appliquer cette migration AVANT de déployer le
  front mis à jour (qui insère feedback_sessions.user_id et appelle la RPC).
  Fenêtre transitoire avec l'ancien front : un testeur qui soumet un
  feedback ne reçoit pas sa récompense automatiquement (le reste du
  formulaire fonctionne) — rattrapable via claim_feedback_reward.

  Rollback du garde-fou si nécessaire :
    DROP TRIGGER trg_block_client_token_increase ON public.profiles;
*/

-- ============================================================================
-- 1. Lien feedback_sessions ↔ compte utilisateur
-- ============================================================================

-- L'email du formulaire feedback est saisi librement et peut différer de
-- l'email du compte : user_id devient le lien fiable pour la récompense.
ALTER TABLE public.feedback_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Rattachement des sessions existantes quand l'email correspond à un compte
UPDATE public.feedback_sessions fs
   SET user_id = u.id
  FROM auth.users u
 WHERE fs.user_id IS NULL
   AND fs.tester_email IS NOT NULL
   AND lower(fs.tester_email) = lower(u.email);

-- ============================================================================
-- 2. Marqueur « récompense feedback déjà versée »
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feedback_reward_claimed boolean DEFAULT false;

-- Les testeurs ayant déjà un feedback complet ont reçu leur récompense via
-- l'ancien crédit client : on les marque pour empêcher un double versement.
UPDATE public.profiles p
   SET feedback_reward_claimed = true
  FROM auth.users u
  JOIN public.feedback_sessions fs
    ON fs.completed = true
   AND (fs.user_id = u.id
        OR (fs.tester_email IS NOT NULL AND lower(fs.tester_email) = lower(u.email)))
 WHERE p.user_id = u.id
   AND COALESCE(p.feedback_reward_claimed, false) = false;

-- ============================================================================
-- 3. RPC claim_feedback_reward — remplace le crédit client de FeedbackPage
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_feedback_reward()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_new_balance integer;
  v_reward constant integer := 30000;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Un feedback complet doit exister pour ce compte (lien user_id, ou email
  -- du compte pour les sessions créées avant l'ajout de la colonne)
  IF NOT EXISTS (
    SELECT 1
      FROM public.feedback_sessions fs
     WHERE fs.completed = true
       AND (fs.user_id = v_user_id
            OR (v_email IS NOT NULL
                AND fs.tester_email IS NOT NULL
                AND lower(fs.tester_email) = lower(v_email)))
  ) THEN
    RETURN NULL;
  END IF;

  -- Une seule récompense par compte : test et verrouillage dans le même
  -- UPDATE (atomique, insensible aux doubles appels simultanés)
  UPDATE public.profiles
     SET tokens = COALESCE(tokens, 0) + v_reward,
         feedback_reward_claimed = true
   WHERE user_id = v_user_id
     AND COALESCE(feedback_reward_claimed, false) = false
  RETURNING tokens INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN NULL; -- déjà versée, ou profil absent
  END IF;

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_feedback_reward() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_feedback_reward() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_feedback_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_feedback_reward() TO service_role;

-- ============================================================================
-- 4. Garde-fou : blocage des augmentations de solde par le client
-- ============================================================================

CREATE OR REPLACE FUNCTION public.block_client_token_increase()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- current_user reflète le rôle de la requête : 'authenticated' pour un
  -- accès direct du navigateur ; les fonctions SECURITY DEFINER
  -- (redeem_promo_code, consume_credits, claim_feedback_reward…) et la clé
  -- service (Stripe, Edge Functions) s'exécutent sous un autre rôle et ne
  -- sont pas concernées. Les DIMINUTIONS restent autorisées pour tous.
  IF COALESCE(NEW.tokens, 0) > COALESCE(OLD.tokens, 0)
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'La modification directe du solde de crédits n''est pas autorisée.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_client_token_increase ON public.profiles;
CREATE TRIGGER trg_block_client_token_increase
  BEFORE UPDATE OF tokens ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.block_client_token_increase();
