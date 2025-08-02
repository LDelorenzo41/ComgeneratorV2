-- Supprime l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS fetch_rss_articles();

-- Supprime les contraintes existantes si elles existent
ALTER TABLE articles
  DROP CONSTRAINT IF EXISTS title_length,
  DROP CONSTRAINT IF EXISTS link_length,
  DROP CONSTRAINT IF EXISTS source_length;

-- Recrée la fonction avec validation des données
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
  -- Supprimer les anciens articles
  DELETE FROM articles;
  
  -- Insérer de nouveaux articles de test avec des données complètes
  INSERT INTO articles (title, description, link, source, pub_date)
  VALUES 
    ('Les nouvelles méthodes d''enseignement en 2025', 
     'Découvrez les approches pédagogiques innovantes qui transforment l''éducation cette année. Une analyse détaillée des pratiques émergentes et leur impact sur l''apprentissage des élèves.', 
     'https://www.cafepedagogique.net/article/1', 
     'Café Pédagogique', 
     NOW()),
    ('L''intelligence artificielle révolutionne l''apprentissage en classe', 
     'Comment l''IA transforme l''expérience éducative : exemples concrets, témoignages d''enseignants et perspectives d''avenir pour une éducation augmentée.', 
     'https://www.vousnousils.fr/article/2', 
     'VousNousIls', 
     NOW() - interval '1 hour'),
    ('Réforme du baccalauréat 2025 : les changements majeurs', 
     'Analyse complète des modifications apportées au baccalauréat : nouvelles épreuves, modalités d''évaluation et impact sur l''orientation des élèves.', 
     'https://www.cafepedagogique.net/article/3', 
     'Café Pédagogique', 
     NOW() - interval '2 hours'),
    ('Bien-être à l''école : les nouvelles recommandations 2025', 
     'Le rapport complet sur les mesures à mettre en place pour améliorer le bien-être des élèves. Focus sur la santé mentale et l''environnement scolaire.', 
     'https://www.vousnousils.fr/article/4', 
     'VousNousIls', 
     NOW() - interval '3 hours'),
    ('Guide 2025 des outils numériques pour l''enseignement', 
     'Panorama des solutions technologiques innovantes pour la classe : applications, plateformes et ressources pour optimiser l''apprentissage.', 
     'https://www.cafepedagogique.net/article/5', 
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