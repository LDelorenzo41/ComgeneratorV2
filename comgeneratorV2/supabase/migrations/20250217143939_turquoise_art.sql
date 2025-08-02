-- Création de la fonction de mise à jour des articles
CREATE OR REPLACE FUNCTION fetch_rss_articles()
RETURNS void AS $$
BEGIN
  -- Supprimer les anciens articles
  DELETE FROM articles;
  
  -- Insérer de nouveaux articles de test
  INSERT INTO articles (title, description, link, source, pub_date)
  VALUES 
    ('Article Test 1', 'Description test 1', 'https://example.com/1', 'Test Source', NOW()),
    ('Article Test 2', 'Description test 2', 'https://example.com/2', 'Test Source', NOW());
END;
$$ LANGUAGE plpgsql;

-- Créer un déclencheur pour exécuter la fonction toutes les heures
SELECT cron.schedule(
  'refresh-articles',
  '0 * * * *', -- Toutes les heures
  'SELECT fetch_rss_articles();'
);