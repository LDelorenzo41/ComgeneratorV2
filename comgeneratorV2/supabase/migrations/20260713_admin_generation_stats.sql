-- ============================================================================
-- Statistiques admin du journal des générations (generation_events).
-- Fonction dédiée, réservée aux admins, consommée par AdminDashboardPage.
-- ============================================================================

DROP FUNCTION IF EXISTS get_admin_generation_stats();

CREATE OR REPLACE FUNCTION get_admin_generation_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
    v_now timestamptz := now();
    v_today_start timestamptz := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_week_start timestamptz := v_now - interval '7 days';
    v_month_start timestamptz := v_now - interval '30 days';
BEGIN
    -- Garde admin (même motif que get_admin_dashboard)
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.is_admin = true
    ) THEN
        RAISE EXCEPTION 'Accès refusé : réservé aux administrateurs';
    END IF;

    SELECT jsonb_build_object(
        'by_kind', COALESCE((
            SELECT jsonb_object_agg(kind, stats)
            FROM (
                SELECT
                    kind,
                    jsonb_build_object(
                        'total', COUNT(*),
                        'today', COUNT(*) FILTER (WHERE created_at >= v_today_start),
                        'this_week', COUNT(*) FILTER (WHERE created_at >= v_week_start),
                        'this_month', COUNT(*) FILTER (WHERE created_at >= v_month_start),
                        'unique_users', COUNT(DISTINCT user_id)
                    ) AS stats
                FROM generation_events
                GROUP BY kind
            ) per_kind
        ), '{}'::jsonb),
        'total_events', (SELECT COUNT(*) FROM generation_events),
        'active_users_this_month', (
            SELECT COUNT(DISTINCT user_id)
            FROM generation_events
            WHERE created_at >= v_month_start
        )
    ) INTO result;

    RETURN result;
END;
$$;

-- Motif du projet : pas d'exécution publique, accès explicite aux connectés
-- (la garde admin est dans le corps de la fonction)
REVOKE ALL ON FUNCTION get_admin_generation_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_admin_generation_stats() TO authenticated;
