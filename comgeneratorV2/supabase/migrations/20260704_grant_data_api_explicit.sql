-- ============================================================================
-- Migration : GRANTs explicites pour la Data API (PostgREST / supabase-js / GraphQL)
--
-- Contexte : à partir du 30/10/2026, Supabase ne fournit plus de privilèges
-- implicites aux rôles anon / authenticated / service_role sur le schéma
-- public. Sans GRANT explicite, toutes les requêtes Data API échoueront
-- avec l'erreur 42501 (permission denied).
--
-- Principe directeur : ZÉRO RÉGRESSION.
--   - authenticated / service_role : privilèges identiques aux défauts
--     Supabase actuels. La sécurité par ligne reste entièrement assurée par
--     RLS, activé sur toutes les tables (cf. 20260302_snapshot_rls_policies.sql).
--   - anon : réduit à la surface réellement utilisée hors connexion,
--     vérifiée dans le code front (src/) et les policies RLS ciblant anon :
--       * feedback_sessions / feedback_ratings / feedback_comments
--         (formulaire testeurs public : INSERT + SELECT pour le RETURNING
--         de .insert().select() et pour useHasSubmittedFeedback)
--       * deleted_users_blacklist (policy "Allow checking blacklisted emails")
--       * RPC unsubscribe_newsletter (page publique /unsubscribe)
--   - Les GRANT/REVOKE ciblés déjà posés sur les fonctions ne sont PAS
--     modifiés (ex. match_rag_chunks_exact reste réservé à service_role,
--     cf. 20260317_fix_rag_hnsw_search.sql).
--
-- Idempotence : GRANT est ré-exécutable sans erreur ; les blocs DO vérifient
-- l'existence des objets avant d'agir (robuste en local comme en production,
-- y compris pour les objets créés hors migrations via le dashboard).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Accès au schéma public
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2) Tables existantes
--    authenticated : CRUD (chaque ligne reste filtrée par les policies RLS)
--    service_role  : accès complet (Edge Functions, webhooks Stripe, etc.)
--    Couvre aussi les tables créées via le dashboard, absentes des migrations.
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ----------------------------------------------------------------------------
-- 3) Séquences existantes (colonnes serial / identity éventuelles)
-- ----------------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4) Rôle anon : uniquement la surface publique identifiée
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  -- Formulaire de feedback testeurs (routes publiques /feedback)
  FOREACH t IN ARRAY ARRAY['feedback_sessions', 'feedback_ratings', 'feedback_comments'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT ON public.%I TO anon', t);
    END IF;
  END LOOP;

  -- Vérification d'email supprimé à l'inscription
  IF to_regclass('public.deleted_users_blacklist') IS NOT NULL THEN
    GRANT SELECT ON public.deleted_users_blacklist TO anon;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 5) Fonctions appelées via supabase.rpc() mais créées directement en
--    production (absentes des migrations) : EXECUTE réaffirmé de façon
--    conditionnelle, toutes surcharges confondues.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  -- Appelées par le front avec un utilisateur connecté
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('redeem_promo_code', 'delete_user_account', 'search_rag_chunks_fts')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;

  -- Appelée depuis la page publique /unsubscribe (rôle anon)
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'unsubscribe_newsletter'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.sig);
  END LOOP;

  -- Utilitaires appelés uniquement par les Edge Functions (service_role)
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('set_config_param', 'match_rag_chunks_raw')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END
$$;

-- Réaffirmation des fonctions définies dans les migrations (déjà grantées,
-- ré-exécution sans effet ; sécurise le cas d'une base reconstruite)
GRANT EXECUTE ON FUNCTION public.fetch_rss_articles() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard() TO authenticated;

-- ----------------------------------------------------------------------------
-- 6) Privilèges par défaut pour les FUTURES tables et séquences créées par
--    postgres (CLI et éditeur SQL du dashboard) : évite de réintroduire des
--    42501 à chaque nouvelle table.
--    Volontairement PAS de défaut pour anon (exposition publique = décision
--    explicite au cas par cas) ni pour les fonctions (le projet applique déjà
--    le motif REVOKE ALL FROM PUBLIC + GRANT ciblé ; un défaut vers
--    authenticated contournerait silencieusement ce motif).
-- ----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
