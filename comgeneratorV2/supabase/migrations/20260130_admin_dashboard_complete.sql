-- ============================================================================
-- MIGRATION: Dashboard Admin complet avec tracking des edge functions
-- Date: 2026-01-30
-- ============================================================================

-- ============================================================================
-- PARTIE 1: TABLE DE TRACKING DES EDGE FUNCTIONS
-- ============================================================================

-- Créer la table de logs si elle n'existe pas
CREATE TABLE IF NOT EXISTS edge_function_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now() NOT NULL,
    function_name text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    tokens_used integer DEFAULT 0,
    success boolean DEFAULT true,
    error_message text
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_created_at ON edge_function_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_function_name ON edge_function_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_user_id ON edge_function_logs(user_id);

-- RLS pour la table de logs (admin only read, service role write)
ALTER TABLE edge_function_logs ENABLE ROW LEVEL SECURITY;

-- Policy: seuls les admins peuvent lire les logs
DROP POLICY IF EXISTS "Admins can read logs" ON edge_function_logs;
CREATE POLICY "Admins can read logs" ON edge_function_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- Policy: service role peut tout faire
DROP POLICY IF EXISTS "Service role full access" ON edge_function_logs;
CREATE POLICY "Service role full access" ON edge_function_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PARTIE 2: FONCTION get_admin_dashboard CORRIGÉE
-- ============================================================================

DROP FUNCTION IF EXISTS get_admin_dashboard();

CREATE OR REPLACE FUNCTION get_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
    
    -- Stockage
    v_storage_used_bytes bigint := 0;
    v_db_size_bytes bigint := 0;
    
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
    -- UTILISATEURS
    -- ==========================================
    
    SELECT COUNT(*) INTO v_total_users FROM profiles;
    
    -- Nouveaux utilisateurs depuis auth.users
    SELECT 
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_today_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_week_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_month_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_year_start), 0)
    INTO v_new_today, v_new_week, v_new_month, v_new_year
    FROM auth.users;
    
    -- ==========================================
    -- UTILISATEURS ACTIFS (basé sur appreciations)
    -- ==========================================
    
    SELECT 
        COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_today_start), 0),
        COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_week_start), 0),
        COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_month_start), 0)
    INTO v_active_today, v_active_week, v_active_month
    FROM appreciations;
    
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
    -- STOCKAGE - TAILLE RÉELLE DE LA DB
    -- ==========================================
    
    -- Taille totale de la base de données (vraie valeur)
    SELECT pg_database_size(current_database()) INTO v_db_size_bytes;
    
    -- Taille du bucket storage si accessible
    BEGIN
        SELECT COALESCE(SUM((metadata->>'size')::bigint), 0) 
        INTO v_storage_used_bytes
        FROM storage.objects;
    EXCEPTION WHEN OTHERS THEN
        v_storage_used_bytes := 0;
    END;
    
    -- Total = taille DB + storage
    v_storage_used_bytes := v_db_size_bytes + v_storage_used_bytes;
    
    -- ==========================================
    -- EDGE FUNCTION USAGE (si table existe)
    -- ==========================================
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'edge_function_logs') THEN
        -- RAG Chat
        SELECT 
            COUNT(*),
            COALESCE(COUNT(*) FILTER (WHERE created_at >= v_today_start), 0),
            COALESCE(COUNT(*) FILTER (WHERE created_at >= v_week_start), 0),
            COALESCE(COUNT(*) FILTER (WHERE created_at >= v_month_start), 0)
        INTO v_rag_chat_total, v_rag_chat_today, v_rag_chat_week, v_rag_chat_month
        FROM edge_function_logs
        WHERE function_name = 'rag-chat';
        
        -- Synthesis
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
            'used_bytes', v_storage_used_bytes,
            'limit_bytes', 524288000,
            'used_mb', ROUND(v_storage_used_bytes::numeric / 1024 / 1024, 2),
            'limit_mb', 500,
            'percent_used', ROUND((v_storage_used_bytes::numeric / 524288000) * 100, 1)
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
GRANT EXECUTE ON FUNCTION get_admin_dashboard() TO authenticated;

COMMENT ON FUNCTION get_admin_dashboard() IS 'Dashboard admin avec KPIs complets incluant monétisation, stockage et usage des edge functions';

-- ============================================================================
-- PARTIE 3: FONCTION HELPER POUR LOGGER LES EDGE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION log_edge_function_call(
    p_function_name text,
    p_user_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb,
    p_tokens_used integer DEFAULT 0,
    p_success boolean DEFAULT true,
    p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id uuid;
BEGIN
    INSERT INTO edge_function_logs (function_name, user_id, metadata, tokens_used, success, error_message)
    VALUES (p_function_name, p_user_id, p_metadata, p_tokens_used, p_success, p_error_message)
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- Permissions pour que les edge functions puissent appeler cette fonction
GRANT EXECUTE ON FUNCTION log_edge_function_call(text, uuid, jsonb, integer, boolean, text) TO service_role;

COMMENT ON FUNCTION log_edge_function_call IS 'Logger un appel à une edge function pour le dashboard admin';
