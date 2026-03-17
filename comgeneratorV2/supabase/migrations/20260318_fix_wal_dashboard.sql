-- ============================================================================
-- MIGRATION: Fix WAL dans le dashboard admin
-- - Supprime la table/vue v_wal_size_bytes (créée par erreur, alerte RLS)
-- - Ajoute wal_available dans le JSON retourné
-- - Inclut le WAL dans le total db_size pour refléter le quota Supabase
-- Date: 2026-03-18
-- ============================================================================

-- 1) Supprimer la table/vue v_wal_size_bytes si elle existe (ne devrait pas exister)
DROP VIEW IF EXISTS public.v_wal_size_bytes;
DROP TABLE IF EXISTS public.v_wal_size_bytes;

-- 2) Recréer la fonction get_admin_dashboard avec les correctifs WAL
CREATE OR REPLACE FUNCTION get_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid;
    v_is_admin boolean := false;

    result jsonb;
    v_now timestamptz := now();
    v_today_start timestamptz := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_week_start timestamptz := (v_now - interval '7 days');
    v_month_start timestamptz := (v_now - interval '30 days');
    v_year_start timestamptz := date_trunc('year', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

    -- Utilisateurs
    v_total_users int := 0;
    v_new_today int := 0;
    v_new_week int := 0;
    v_new_month int := 0;
    v_new_year int := 0;

    -- Utilisateurs actifs
    v_active_today int := 0;
    v_active_week int := 0;
    v_active_month int := 0;

    -- Contenu
    v_appreciations_total int := 0;
    v_appreciations_today int := 0;
    v_appreciations_week int := 0;
    v_appreciations_month int := 0;

    v_lessons_total int := 0;
    v_lessons_today int := 0;
    v_lessons_week int := 0;
    v_lessons_month int := 0;

    v_lessons_bank_total int := 0;

    v_scenarios_total int := 0;
    v_scenarios_today int := 0;
    v_scenarios_week int := 0;
    v_scenarios_month int := 0;

    -- Monétisation
    v_total_transactions int := 0;
    v_total_revenue_cents bigint := 0;
    v_revenue_today_cents bigint := 0;
    v_revenue_week_cents bigint := 0;
    v_revenue_month_cents bigint := 0;
    v_transactions_today int := 0;
    v_transactions_week int := 0;
    v_transactions_month int := 0;
    v_promo_redemptions int := 0;

    -- Engagement
    v_users_with_appreciations int := 0;
    v_users_with_lessons int := 0;
    v_users_with_scenarios int := 0;

    -- RAG
    v_rag_total_docs int := 0;
    v_rag_ready_docs int := 0;
    v_rag_total_chunks int := 0;
    v_rag_total_tokens bigint := 0;

    -- Newsletter
    v_newsletter_subscribers int := 0;
    v_newsletter_failures int := 0;
    v_newsletter_total_sent int := 0;

    -- Stockage séparé
    v_db_size_bytes bigint := 0;
    v_wal_size_bytes bigint := 0;
    v_wal_available boolean := false;
    v_total_with_wal_bytes bigint := 0;
    v_storage_bytes bigint := 0;

    -- Edge function usage
    v_rag_chat_total int := 0;
    v_rag_chat_today int := 0;
    v_rag_chat_week int := 0;
    v_rag_chat_month int := 0;

    v_synthesis_total int := 0;
    v_synthesis_today int := 0;
    v_synthesis_week int := 0;
    v_synthesis_month int := 0;

BEGIN
    -- ==========================================
    -- CONTRÔLE D'ACCÈS ADMIN
    -- ==========================================

    v_caller_id := auth.uid();

    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Non authentifié';
    END IF;

    SELECT is_admin INTO v_is_admin
    FROM profiles
    WHERE user_id = v_caller_id;

    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Accès réservé aux administrateurs';
    END IF;

    -- ==========================================
    -- UTILISATEURS
    -- ==========================================

    SELECT COUNT(*) INTO v_total_users FROM profiles;

    SELECT
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_today_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_week_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_month_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_year_start), 0)
    INTO v_new_today, v_new_week, v_new_month, v_new_year
    FROM auth.users;

    -- ==========================================
    -- UTILISATEURS ACTIFS (toutes activités confondues)
    -- ==========================================

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'edge_function_logs') THEN
        SELECT
            COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_today_start), 0),
            COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_week_start), 0),
            COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_month_start), 0)
        INTO v_active_today, v_active_week, v_active_month
        FROM (
            SELECT user_id, created_at FROM appreciations
            UNION ALL
            SELECT user_id, created_at FROM lessons
            UNION ALL
            SELECT user_id, created_at FROM edge_function_logs WHERE user_id IS NOT NULL
        ) all_activity;
    ELSE
        SELECT
            COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_today_start), 0),
            COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_week_start), 0),
            COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_month_start), 0)
        INTO v_active_today, v_active_week, v_active_month
        FROM (
            SELECT user_id, created_at FROM appreciations
            UNION ALL
            SELECT user_id, created_at FROM lessons
        ) all_activity;
    END IF;

    -- ==========================================
    -- APPRÉCIATIONS
    -- ==========================================

    SELECT
        COUNT(*),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_today_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_week_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_month_start), 0)
    INTO v_appreciations_total, v_appreciations_today, v_appreciations_week, v_appreciations_month
    FROM appreciations;

    -- ==========================================
    -- LESSONS
    -- ==========================================

    SELECT
        COUNT(*),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_today_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_week_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_month_start), 0)
    INTO v_lessons_total, v_lessons_today, v_lessons_week, v_lessons_month
    FROM lessons;

    SELECT COUNT(*) INTO v_lessons_bank_total FROM lessons_bank;

    -- ==========================================
    -- SCÉNARIOS
    -- ==========================================

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scenarios_bank') THEN
        EXECUTE '
            SELECT
                COUNT(*),
                COALESCE(COUNT(*) FILTER (WHERE created_at >= $1), 0),
                COALESCE(COUNT(*) FILTER (WHERE created_at >= $2), 0),
                COALESCE(COUNT(*) FILTER (WHERE created_at >= $3), 0)
            FROM scenarios_bank'
        INTO v_scenarios_total, v_scenarios_today, v_scenarios_week, v_scenarios_month
        USING v_today_start, v_week_start, v_month_start;
    END IF;

    -- ==========================================
    -- MONÉTISATION - TRANSACTIONS
    -- ==========================================

    SELECT
        COALESCE(COUNT(*) FILTER (WHERE status = 'completed'), 0),
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'completed'), 0),
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'completed' AND created_at >= v_today_start), 0),
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'completed' AND created_at >= v_week_start), 0),
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'completed' AND created_at >= v_month_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= v_today_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= v_week_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= v_month_start), 0)
    INTO
        v_total_transactions,
        v_total_revenue_cents,
        v_revenue_today_cents,
        v_revenue_week_cents,
        v_revenue_month_cents,
        v_transactions_today,
        v_transactions_week,
        v_transactions_month
    FROM transactions;

    -- Codes promo
    SELECT COUNT(*) INTO v_promo_redemptions FROM promo_redemptions;

    -- ==========================================
    -- ENGAGEMENT
    -- ==========================================

    SELECT COUNT(DISTINCT user_id) INTO v_users_with_appreciations FROM appreciations;
    SELECT COUNT(DISTINCT user_id) INTO v_users_with_lessons FROM lessons;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scenarios_bank') THEN
        EXECUTE 'SELECT COUNT(DISTINCT user_id) FROM scenarios_bank' INTO v_users_with_scenarios;
    END IF;

    -- ==========================================
    -- RAG
    -- ==========================================

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rag_documents') THEN
        SELECT COUNT(*) INTO v_rag_total_docs FROM rag_documents;
        SELECT COUNT(*) INTO v_rag_ready_docs FROM rag_documents WHERE status = 'ready';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rag_chunks') THEN
        SELECT
            COUNT(*),
            COALESCE(SUM(token_count), 0)
        INTO v_rag_total_chunks, v_rag_total_tokens
        FROM rag_chunks;
    END IF;

    -- ==========================================
    -- NEWSLETTER
    -- ==========================================

    SELECT COUNT(*) INTO v_newsletter_subscribers
    FROM profiles
    WHERE newsletter_subscription = true;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'newsletter_logs') THEN
        SELECT
            COALESCE(SUM(recipients_count) FILTER (WHERE status = 'sent'), 0),
            COALESCE(COUNT(*) FILTER (WHERE status = 'failed'), 0)
        INTO v_newsletter_total_sent, v_newsletter_failures
        FROM newsletter_logs;
    END IF;

    -- ==========================================
    -- STOCKAGE - DB, WAL et Storage SÉPARÉS
    -- ==========================================

    -- Taille DB (données + index + TOAST, hors WAL)
    SELECT pg_database_size(current_database()) INTO v_db_size_bytes;

    -- Taille WAL réelle sur disque (via pg_ls_waldir)
    BEGIN
        SELECT COALESCE(SUM(size), 0)
        INTO v_wal_size_bytes
        FROM pg_ls_waldir();
        v_wal_available := true;
    EXCEPTION WHEN OTHERS THEN
        v_wal_size_bytes := 0;
        v_wal_available := false;
    END;

    -- Total DB + WAL (Supabase compte les deux ensemble pour le quota)
    v_total_with_wal_bytes := v_db_size_bytes + v_wal_size_bytes;

    -- Taille du bucket storage (fichiers uploadés)
    BEGIN
        SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
        INTO v_storage_bytes
        FROM storage.objects;
    EXCEPTION WHEN OTHERS THEN
        v_storage_bytes := 0;
    END;

    -- ==========================================
    -- EDGE FUNCTION USAGE (si table existe)
    -- ==========================================

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'edge_function_logs') THEN
        SELECT
            COUNT(*),
            COALESCE(COUNT(*) FILTER (WHERE created_at >= v_today_start), 0),
            COALESCE(COUNT(*) FILTER (WHERE created_at >= v_week_start), 0),
            COALESCE(COUNT(*) FILTER (WHERE created_at >= v_month_start), 0)
        INTO v_rag_chat_total, v_rag_chat_today, v_rag_chat_week, v_rag_chat_month
        FROM edge_function_logs
        WHERE function_name = 'rag-chat';

        SELECT
            COUNT(*),
            COALESCE(COUNT(*) FILTER (WHERE created_at >= v_today_start), 0),
            COALESCE(COUNT(*) FILTER (WHERE created_at >= v_week_start), 0),
            COALESCE(COUNT(*) FILTER (WHERE created_at >= v_month_start), 0)
        INTO v_synthesis_total, v_synthesis_today, v_synthesis_week, v_synthesis_month
        FROM edge_function_logs
        WHERE function_name = 'synthesis';
    END IF;

    -- ==========================================
    -- CONSTRUCTION DU RÉSULTAT
    -- ==========================================

    result := jsonb_build_object(
        'timestamp', v_now,
        'users', jsonb_build_object(
            'total', v_total_users,
            'new_today', v_new_today,
            'new_this_week', v_new_week,
            'new_this_month', v_new_month,
            'new_this_year', v_new_year
        ),
        'active_users', jsonb_build_object(
            'today', v_active_today,
            'this_week', v_active_week,
            'this_month', v_active_month
        ),
        'content', jsonb_build_object(
            'appreciations', jsonb_build_object(
                'total', v_appreciations_total,
                'today', v_appreciations_today,
                'this_week', v_appreciations_week,
                'this_month', v_appreciations_month
            ),
            'lessons', jsonb_build_object(
                'total', v_lessons_total,
                'today', v_lessons_today,
                'this_week', v_lessons_week,
                'this_month', v_lessons_month
            ),
            'lessons_bank', v_lessons_bank_total,
            'scenarios_bank', jsonb_build_object(
                'total', v_scenarios_total,
                'today', v_scenarios_today,
                'this_week', v_scenarios_week,
                'this_month', v_scenarios_month
            )
        ),
        'monetization', jsonb_build_object(
            'total_transactions', v_total_transactions,
            'total_revenue_eur', ROUND(v_total_revenue_cents::numeric / 100, 2),
            'revenue_today_eur', ROUND(v_revenue_today_cents::numeric / 100, 2),
            'revenue_this_week_eur', ROUND(v_revenue_week_cents::numeric / 100, 2),
            'revenue_this_month_eur', ROUND(v_revenue_month_cents::numeric / 100, 2),
            'transactions_today', v_transactions_today,
            'transactions_this_week', v_transactions_week,
            'transactions_this_month', v_transactions_month,
            'promo_redemptions', v_promo_redemptions
        ),
        'engagement', jsonb_build_object(
            'users_with_appreciations', v_users_with_appreciations,
            'users_with_lessons', v_users_with_lessons,
            'users_with_scenarios', v_users_with_scenarios
        ),
        'rag', jsonb_build_object(
            'total_documents', v_rag_total_docs,
            'ready_documents', v_rag_ready_docs,
            'total_chunks', v_rag_total_chunks,
            'total_tokens', v_rag_total_tokens
        ),
        'newsletter', jsonb_build_object(
            'subscribers', v_newsletter_subscribers,
            'failures', v_newsletter_failures,
            'total_sent', v_newsletter_total_sent
        ),
        'storage', jsonb_build_object(
            'db_size_bytes', v_db_size_bytes,
            'db_size_mb', ROUND(v_db_size_bytes::numeric / 1024 / 1024, 2),
            'wal_size_bytes', v_wal_size_bytes,
            'wal_size_mb', ROUND(v_wal_size_bytes::numeric / 1024 / 1024, 2),
            'wal_available', v_wal_available,
            'total_with_wal_bytes', v_total_with_wal_bytes,
            'total_with_wal_mb', ROUND(v_total_with_wal_bytes::numeric / 1024 / 1024, 2),
            'storage_bytes', v_storage_bytes,
            'storage_mb', ROUND(v_storage_bytes::numeric / 1024 / 1024, 2)
        ),
        'edge_functions', jsonb_build_object(
            'rag_chat', jsonb_build_object(
                'total', v_rag_chat_total,
                'today', v_rag_chat_today,
                'this_week', v_rag_chat_week,
                'this_month', v_rag_chat_month
            ),
            'synthesis', jsonb_build_object(
                'total', v_synthesis_total,
                'today', v_synthesis_today,
                'this_week', v_synthesis_week,
                'this_month', v_synthesis_month
            )
        )
    );

    RETURN result;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard() TO authenticated;
