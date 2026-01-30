-- supabase/migrations/20260130_create_admin_dashboard.sql
-- Fonction get_admin_dashboard pour le tableau de bord admin
-- IMPORTANT: Exécuter cette migration sur Supabase

-- Supprimer la fonction si elle existe déjà
DROP FUNCTION IF EXISTS get_admin_dashboard();

CREATE OR REPLACE FUNCTION get_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    v_now timestamp with time zone := now();
    v_today_start timestamp with time zone := date_trunc('day', v_now);
    v_week_start timestamp with time zone := v_now - interval '7 days';
    v_month_start timestamp with time zone := v_now - interval '30 days';
    v_year_start timestamp with time zone := date_trunc('year', v_now);
    
    -- Utilisateurs
    v_total_users int;
    v_new_today int;
    v_new_week int;
    v_new_month int;
    v_new_year int;
    
    -- Utilisateurs actifs (basé sur created_at des appréciations)
    v_active_today int;
    v_active_week int;
    v_active_month int;
    
    -- Contenu
    v_appreciations_total int;
    v_appreciations_today int;
    v_appreciations_week int;
    v_appreciations_month int;
    
    v_lessons_total int;
    v_lessons_today int;
    v_lessons_week int;
    v_lessons_month int;
    
    v_lessons_bank_total int;
    
    v_scenarios_total int;
    v_scenarios_today int;
    v_scenarios_week int;
    v_scenarios_month int;
    
    -- Monétisation
    v_total_transactions int;
    v_total_revenue_cents bigint;
    v_revenue_today_cents bigint;
    v_revenue_week_cents bigint;
    v_revenue_month_cents bigint;
    v_transactions_today int;
    v_transactions_week int;
    v_transactions_month int;
    v_promo_redemptions int;
    
    -- Engagement
    v_users_with_appreciations int;
    v_users_with_lessons int;
    v_users_with_scenarios int;
    
    -- RAG
    v_rag_total_docs int;
    v_rag_ready_docs int;
    v_rag_total_chunks int;
    v_rag_total_tokens bigint;
    
    -- Newsletter
    v_newsletter_subscribers int;
    v_newsletter_failures int;
    v_newsletter_total_sent int;
    
    -- Stockage estimé (en bytes)
    v_storage_used_bytes bigint;
    
BEGIN
    -- ==========================================
    -- UTILISATEURS (depuis auth.users via profiles)
    -- ==========================================
    
    SELECT COUNT(*) INTO v_total_users FROM profiles;
    
    -- Nouveaux utilisateurs (basé sur la date de création des profils ou auth.users)
    -- Si created_at n'existe pas dans profiles, on utilise une estimation
    SELECT 
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_today_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_week_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_month_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_year_start), 0)
    INTO v_new_today, v_new_week, v_new_month, v_new_year
    FROM auth.users;
    
    -- ==========================================
    -- UTILISATEURS ACTIFS (basé sur les appréciations créées)
    -- ==========================================
    
    SELECT 
        COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_today_start), 0),
        COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_week_start), 0),
        COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_month_start), 0)
    INTO v_active_today, v_active_week, v_active_month
    FROM appreciations;
    
    -- ==========================================
    -- CONTENU - APPRÉCIATIONS
    -- ==========================================
    
    SELECT 
        COUNT(*),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_today_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_week_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_month_start), 0)
    INTO v_appreciations_total, v_appreciations_today, v_appreciations_week, v_appreciations_month
    FROM appreciations;
    
    -- ==========================================
    -- CONTENU - LESSONS (séances générées)
    -- ==========================================
    
    SELECT 
        COUNT(*),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_today_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_week_start), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= v_month_start), 0)
    INTO v_lessons_total, v_lessons_today, v_lessons_week, v_lessons_month
    FROM lessons;
    
    -- Lessons Bank
    SELECT COUNT(*) INTO v_lessons_bank_total FROM lessons_bank;
    
    -- ==========================================
    -- CONTENU - SCÉNARIOS
    -- ==========================================
    
    -- Vérifier si la table scenarios_bank existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scenarios_bank') THEN
        EXECUTE '
            SELECT 
                COUNT(*),
                COALESCE(COUNT(*) FILTER (WHERE created_at >= $1), 0),
                COALESCE(COUNT(*) FILTER (WHERE created_at >= $2), 0),
                COALESCE(COUNT(*) FILTER (WHERE created_at >= $3), 0)
            FROM scenarios_bank'
        INTO v_scenarios_total, v_scenarios_today, v_scenarios_week, v_scenarios_month
        USING v_today_start, v_week_start, v_month_start;
    ELSE
        v_scenarios_total := 0;
        v_scenarios_today := 0;
        v_scenarios_week := 0;
        v_scenarios_month := 0;
    END IF;
    
    -- ==========================================
    -- MONÉTISATION - TRANSACTIONS STRIPE
    -- ==========================================
    
    SELECT 
        COUNT(*) FILTER (WHERE status = 'completed'),
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
    
    -- Codes promo utilisés
    SELECT COUNT(*) INTO v_promo_redemptions FROM promo_redemptions;
    
    -- ==========================================
    -- ENGAGEMENT
    -- ==========================================
    
    SELECT COUNT(DISTINCT user_id) INTO v_users_with_appreciations FROM appreciations;
    SELECT COUNT(DISTINCT user_id) INTO v_users_with_lessons FROM lessons;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scenarios_bank') THEN
        EXECUTE 'SELECT COUNT(DISTINCT user_id) FROM scenarios_bank' INTO v_users_with_scenarios;
    ELSE
        v_users_with_scenarios := 0;
    END IF;
    
    -- ==========================================
    -- RAG
    -- ==========================================
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rag_documents') THEN
        SELECT COUNT(*) INTO v_rag_total_docs FROM rag_documents;
        SELECT COUNT(*) INTO v_rag_ready_docs FROM rag_documents WHERE status = 'ready';
    ELSE
        v_rag_total_docs := 0;
        v_rag_ready_docs := 0;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rag_chunks') THEN
        SELECT 
            COUNT(*),
            COALESCE(SUM(token_count), 0)
        INTO v_rag_total_chunks, v_rag_total_tokens
        FROM rag_chunks;
    ELSE
        v_rag_total_chunks := 0;
        v_rag_total_tokens := 0;
    END IF;
    
    -- ==========================================
    -- NEWSLETTER
    -- ==========================================
    
    SELECT COUNT(*) INTO v_newsletter_subscribers 
    FROM profiles 
    WHERE newsletter_subscription = true;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'newsletter_logs') THEN
        SELECT 
            COALESCE(SUM(recipients_count) FILTER (WHERE status = 'sent'), 0),
            COALESCE(COUNT(*) FILTER (WHERE status = 'failed'), 0)
        INTO v_newsletter_total_sent, v_newsletter_failures
        FROM newsletter_logs;
    ELSE
        v_newsletter_total_sent := 0;
        v_newsletter_failures := 0;
    END IF;
    
    -- ==========================================
    -- STOCKAGE ESTIMÉ
    -- ==========================================
    
    -- Estimation basée sur: 
    -- - RAG chunks (~4 bytes per token)
    -- - Storage bucket (rag-documents)
    v_storage_used_bytes := v_rag_total_tokens * 4;
    
    -- Ajouter la taille du bucket rag-documents si accessible
    -- Note: storage.objects nécessite des permissions spéciales
    BEGIN
        SELECT COALESCE(SUM((metadata->>'size')::bigint), 0) 
        INTO v_storage_used_bytes
        FROM storage.objects
        WHERE bucket_id = 'rag-documents';
        
        -- Ajouter les tokens RAG (estimation)
        v_storage_used_bytes := v_storage_used_bytes + (v_rag_total_tokens * 4);
    EXCEPTION WHEN OTHERS THEN
        -- Fallback: juste les tokens
        v_storage_used_bytes := v_rag_total_tokens * 4;
    END;
    
    -- ==========================================
    -- CONSTRUIRE LE RÉSULTAT
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
            'limit_bytes', 524288000, -- 500 MB plan gratuit
            'used_mb', ROUND(v_storage_used_bytes::numeric / 1024 / 1024, 2),
            'limit_mb', 500,
            'percent_used', ROUND((v_storage_used_bytes::numeric / 524288000) * 100, 1)
        )
    );
    
    RETURN result;
END;
$$;

-- Accorder les permissions à la fonction
GRANT EXECUTE ON FUNCTION get_admin_dashboard() TO authenticated;

-- Ajouter un commentaire
COMMENT ON FUNCTION get_admin_dashboard() IS 'Retourne les KPIs du dashboard admin en temps réel';
