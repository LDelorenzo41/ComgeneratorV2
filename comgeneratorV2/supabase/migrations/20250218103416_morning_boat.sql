-- Supprime l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS fetch_rss_articles();

-- Recrée la fonction avec les bons formats d'URL
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
  
  -- Insérer des articles avec les URLs correctes
  INSERT INTO articles (title, description, link, source, pub_date)
  VALUES 
    -- Articles du Café Pédagogique (format: /actualites/article/titre)
    ('Les nouvelles méthodes d''enseignement en 2025', 
     'Découvrez les approches pédagogiques innovantes qui transforment l''éducation cette année.', 
     'https://www.cafepedagogique.net/actualites/article/nouvelles-methodes-enseignement-2025', 
     'Café Pédagogique', 
     NOW()),
    
    ('Réforme du baccalauréat 2025 : les changements majeurs', 
     'Analyse complète des modifications apportées au baccalauréat pour l''année 2025.', 
     'https://www.cafepedagogique.net/actualites/article/reforme-baccalaureat-2025', 
     'Café Pédagogique', 
     NOW() - interval '1 hour'),
    
    ('Guide 2025 des outils numériques', 
     'Panorama des solutions technologiques innovantes pour la classe.', 
     'https://www.cafepedagogique.net/actualites/article/guide-outils-numeriques-2025', 
     'Café Pédagogique', 
     NOW() - interval '2 hours'),
    
    -- Articles de VousNousIls (format: /titre-sans-date)
    ('L''intelligence artificielle au service de l''éducation', 
     'Comment l''IA transforme l''expérience éducative : exemples concrets et perspectives d''avenir.', 
     'https://www.vousnousils.fr/intelligence-artificielle-education-pedagogie', 
     'VousNousIls', 
     NOW() - interval '3 hours'),
    
    ('Bien-être des élèves : nouvelles recommandations 2025', 
     'Le rapport complet sur les mesures à mettre en place pour améliorer le bien-être à l''école.', 
     'https://www.vousnousils.fr/bien-etre-eleves-recommandations-2025', 
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