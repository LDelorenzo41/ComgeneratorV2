-- Création de la fonction de récupération des articles RSS
CREATE OR REPLACE FUNCTION fetch_rss_articles()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
  v_message text;
BEGIN
  -- Supprimer les anciens articles
  DELETE FROM articles;
  
  -- Insérer de nouveaux articles de test
  INSERT INTO articles (title, description, link, source, pub_date)
  VALUES 
    ('Les nouvelles méthodes d''enseignement en 2025', 
     'Découvrez les approches pédagogiques innovantes qui transforment l''éducation cette année', 
     'https://www.cafepedagogique.net/article/1', 
     'Café Pédagogique', 
     NOW()),
    ('L''impact de l''IA dans l''éducation', 
     'Comment l''intelligence artificielle révolutionne l''apprentissage en classe', 
     'https://www.vousnousils.fr/article/2', 
     'VousNousIls', 
     NOW() - interval '1 hour'),
    ('Réforme du baccalauréat : ce qui change', 
     'Les modifications majeures apportées au baccalauréat pour l''année 2025', 
     'https://www.cafepedagogique.net/article/3', 
     'Café Pédagogique', 
     NOW() - interval '2 hours'),
    ('Bien-être des élèves : nouvelles recommandations', 
     'Un rapport détaille les mesures à mettre en place pour améliorer le bien-être à l''école', 
     'https://www.vousnousils.fr/article/4', 
     'VousNousIls', 
     NOW() - interval '3 hours'),
    ('Les outils numériques incontournables en 2025', 
     'Sélection des meilleurs outils technologiques pour la classe', 
     'https://www.cafepedagogique.net/article/5', 
     'Café Pédagogique', 
     NOW() - interval '4 hours');

  -- Compter les nouveaux articles
  SELECT COUNT(*) INTO v_count FROM articles;
  
  v_message := format('Mise à jour réussie : %s articles ajoutés', v_count::text);
  RETURN v_message;
  
EXCEPTION WHEN OTHERS THEN
  v_message := format('Erreur lors de la mise à jour : %s', SQLERRM);
  RETURN v_message;
END;
$$;

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION fetch_rss_articles() TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_rss_articles() TO anon;

-- Créer un déclencheur pour exécuter la fonction périodiquement (toutes les 2 heures)
SELECT cron.schedule(
  'refresh-articles',
  '0 */2 * * *',
  $$
  SELECT fetch_rss_articles();
  $$
);