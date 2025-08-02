-- Supprime l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS fetch_rss_articles();

-- Recrée la fonction avec différents formats d'URLs pour test
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
  -- Supprimer les anciens articles avec une clause WHERE sécurisée
  DELETE FROM articles 
  WHERE created_at < NOW() + interval '1 day';
  
  -- Insérer des articles de test avec différents formats d'URLs pour VousNousIls
  INSERT INTO articles (title, description, link, source, pub_date)
  VALUES 
    -- Format 1: URL directe
    ('Test VousNousIls Format 1', 
     'Test du format d''URL direct', 
     'https://www.vousnousils.fr/2024/02/intelligence-artificielle-education', 
     'VousNousIls', 
     NOW()),
    
    -- Format 2: URL avec catégorie
    ('Test VousNousIls Format 2', 
     'Test du format d''URL avec catégorie', 
     'https://www.vousnousils.fr/category/innovation/intelligence-artificielle-education', 
     'VousNousIls', 
     NOW() - interval '1 hour'),
    
    -- Format 3: URL avec date complète
    ('Test VousNousIls Format 3', 
     'Test du format d''URL avec date complète', 
     'https://www.vousnousils.fr/2024/02/18/intelligence-artificielle-education', 
     'VousNousIls', 
     NOW() - interval '2 hours'),
    
    -- Format 4: URL avec slug uniquement
    ('Test VousNousIls Format 4', 
     'Test du format d''URL avec slug uniquement', 
     'https://www.vousnousils.fr/intelligence-artificielle-education', 
     'VousNousIls', 
     NOW() - interval '3 hours'),
    
    -- Articles Café Pédagogique pour référence
    ('Les nouvelles méthodes d''enseignement en 2025', 
     'Découvrez les approches pédagogiques innovantes qui transforment l''éducation cette année.', 
     'https://www.cafepedagogique.net/article/1', 
     'Café Pédagogique', 
     NOW() - interval '4 hours');

  -- Compter les nouveaux articles
  SELECT COUNT(*) INTO v_count FROM articles;
  
  -- Préparer le résultat
  v_result := jsonb_build_object(
    'success', true,
    'message', format('Mise à jour réussie : %s articles ajoutés', v_count),
    'count', v_count
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', format('Erreur lors de la mise à jour : %s', SQLERRM)
  );
END;
$$;

-- Révoquer toutes les permissions existantes
REVOKE ALL ON FUNCTION fetch_rss_articles() FROM PUBLIC;

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION fetch_rss_articles() TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_rss_articles() TO anon;