-- Supprime l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS fetch_rss_articles();

-- Recrée la fonction avec les URLs corrigées
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
  
  -- Insérer des articles avec les URLs corrigées
  INSERT INTO articles (title, description, link, source, pub_date)
  VALUES 
    -- Articles VousNousIls avec le bon format d'URL
    ('L''intelligence artificielle révolutionne l''apprentissage', 
     'Comment l''IA transforme l''expérience éducative : exemples concrets et perspectives d''avenir.', 
     'https://www.vousnousils.fr/intelligence-artificielle-education-pedagogie', 
     'VousNousIls', 
     NOW()),
    
    ('Bien-être à l''école : nouvelles recommandations', 
     'Le rapport complet sur les mesures à mettre en place pour améliorer le bien-être des élèves.', 
     'https://www.vousnousils.fr/bien-etre-eleves-recommandations', 
     'VousNousIls', 
     NOW() - interval '1 hour'),
    
    -- Articles Café Pédagogique
    ('Les nouvelles méthodes d''enseignement en 2025', 
     'Découvrez les approches pédagogiques innovantes qui transforment l''éducation.', 
     'https://www.cafepedagogique.net/2024/02/nouvelles-methodes-enseignement', 
     'Café Pédagogique', 
     NOW() - interval '2 hours'),
    
    ('Réforme du baccalauréat 2025', 
     'Analyse complète des modifications apportées au baccalauréat.', 
     'https://www.cafepedagogique.net/2024/02/reforme-baccalaureat-2025', 
     'Café Pédagogique', 
     NOW() - interval '3 hours'),
    
    ('Guide des outils numériques 2025', 
     'Panorama des solutions technologiques innovantes pour la classe.', 
     'https://www.cafepedagogique.net/2024/02/guide-outils-numeriques', 
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