-- Supprime l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS fetch_rss_articles();

-- Recrée la fonction avec les liens RSS d'origine
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
  
  -- Insérer des articles de test avec les formats RSS réels
  INSERT INTO articles (title, description, link, source, pub_date)
  VALUES 
    -- Articles du Café Pédagogique (format réel du RSS)
    ('Les nouvelles méthodes d''enseignement en 2025', 
     'Découvrez les approches pédagogiques innovantes qui transforment l''éducation cette année.', 
     'https://www.cafepedagogique.net/2025/02/18/nouvelles-methodes-enseignement-2025/', 
     'Café Pédagogique', 
     NOW()),
    
    ('Réforme du baccalauréat 2025', 
     'Analyse complète des modifications apportées au baccalauréat.', 
     'https://www.cafepedagogique.net/2025/02/18/reforme-baccalaureat-2025/', 
     'Café Pédagogique', 
     NOW() - interval '1 hour'),
    
    ('Guide des outils numériques', 
     'Panorama des solutions technologiques pour la classe.', 
     'https://www.cafepedagogique.net/2025/02/18/guide-outils-numeriques/', 
     'Café Pédagogique', 
     NOW() - interval '2 hours'),
    
    -- Articles de VousNousIls (format réel du RSS)
    ('L''intelligence artificielle en éducation', 
     'Comment l''IA transforme l''expérience éducative.', 
     'https://www.vousnousils.fr/2025/02/18/intelligence-artificielle-education/', 
     'VousNousIls', 
     NOW() - interval '3 hours'),
    
    ('Bien-être des élèves : recommandations', 
     'Mesures pour améliorer le bien-être à l''école.', 
     'https://www.vousnousils.fr/2025/02/18/bien-etre-eleves-recommandations/', 
     'VousNousIls', 
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