-- Supprime l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS fetch_rss_articles();

-- Recrée la fonction qui appelle l'Edge Function
CREATE OR REPLACE FUNCTION fetch_rss_articles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_result jsonb;
BEGIN
  -- La fonction ne fait plus rien directement, car le traitement est fait par l'Edge Function
  -- Elle retourne juste un message indiquant que la mise à jour doit être faite via l'Edge Function
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Veuillez utiliser l''Edge Function pour mettre à jour les articles'
  );
  
  RETURN v_result;
END;
$$;

-- Révoquer toutes les permissions existantes
REVOKE ALL ON FUNCTION fetch_rss_articles() FROM PUBLIC;

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION fetch_rss_articles() TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_rss_articles() TO anon;