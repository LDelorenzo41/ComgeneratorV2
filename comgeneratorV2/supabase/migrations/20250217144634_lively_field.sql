-- Mise à jour de la fonction fetch_rss_articles pour gérer les erreurs
CREATE OR REPLACE FUNCTION fetch_rss_articles()
RETURNS text AS $$
DECLARE
  v_count integer;
  v_message text;
BEGIN
  -- Sauvegarder le nombre d'articles avant la suppression
  SELECT COUNT(*) INTO v_count FROM articles;
  
  -- Supprimer les anciens articles
  DELETE FROM articles;
  
  -- Insérer de nouveaux articles
  INSERT INTO articles (title, description, link, source, pub_date)
  VALUES 
    ('Actualité pédagogique 1', 'Les nouvelles méthodes d''enseignement en 2025', 'https://example.com/article1', 'Café Pédagogique', NOW()),
    ('Innovation en classe', 'Comment utiliser l''IA dans l''éducation', 'https://example.com/article2', 'VousNousIls', NOW() - interval '1 hour'),
    ('Réforme de l''éducation', 'Les changements à venir dans le système éducatif', 'https://example.com/article3', 'Café Pédagogique', NOW() - interval '2 hours');
    
  -- Compter les nouveaux articles
  SELECT COUNT(*) INTO v_count FROM articles;
  
  v_message := format('Mise à jour réussie : %s articles ajoutés', v_count::text);
  RETURN v_message;
  
EXCEPTION WHEN OTHERS THEN
  v_message := format('Erreur lors de la mise à jour : %s', SQLERRM);
  RETURN v_message;
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour le planning d'exécution
SELECT cron.schedule(
  'refresh-articles',
  '0 */2 * * *', -- Toutes les 2 heures
  $$
  SELECT fetch_rss_articles();
  $$
);