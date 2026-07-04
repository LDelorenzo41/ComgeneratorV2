-- ============================================================================
-- Migration : retrait de l'EXECUTE hérité par anon sur les fonctions sensibles
--
-- Contexte : PostgreSQL (et les défauts Supabase historiques) accordent
-- EXECUTE à tous les rôles sur les nouvelles fonctions. Plusieurs fonctions
-- sensibles étaient donc exécutables par anon, protégées uniquement par
-- leurs vérifications internes (auth.uid(), is_admin).
--
-- Appliqué en production le 2026-07-04 (avec 20260704_grant_data_api_explicit).
-- Usages anon légitimes conservés : fetch_rss_articles, unsubscribe_newsletter.
-- Vérifié dans le code : toutes ces fonctions ne sont appelées que par le
-- front connecté (authenticated) ou les Edge Functions (service_role).
--
-- Idempotent : blocs DO conditionnels, tolère l'absence des fonctions créées
-- hors migrations (environnement local, base reconstruite).
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  -- EXECUTE retiré à anon (fonctions réservées aux utilisateurs connectés)
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'delete_user_account',
        'get_admin_dashboard',
        'redeem_promo_code',
        'search_rag_chunks_fts',
        'match_rag_chunks',
        'match_rag_chunks_exact'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;

  -- EXECUTE réservé à service_role (utilitaire interne des Edge Functions)
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'log_edge_function_call'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', r.sig);
  END LOOP;
END
$$;
