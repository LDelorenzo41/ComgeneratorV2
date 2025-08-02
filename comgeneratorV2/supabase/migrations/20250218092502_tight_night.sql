/*
  # Correction des données des articles

  1. Nettoyage
    - Supprime les articles invalides existants
  
  2. Nouvelles données
    - Ajoute des articles de test valides avec toutes les informations requises
*/

-- Supprime les articles existants
DELETE FROM articles;

-- Insère des articles de test valides
INSERT INTO articles (title, description, link, source, pub_date) VALUES
(
  'Les nouvelles méthodes d''enseignement en 2025',
  'Découvrez les approches pédagogiques innovantes qui transforment l''éducation cette année',
  'https://www.cafepedagogique.net/article/1',
  'Café Pédagogique',
  NOW()
),
(
  'L''impact de l''IA dans l''éducation',
  'Comment l''intelligence artificielle révolutionne l''apprentissage en classe',
  'https://www.vousnousils.fr/article/2',
  'VousNousIls',
  NOW() - interval '1 hour'
),
(
  'Réforme du baccalauréat : ce qui change',
  'Les modifications majeures apportées au baccalauréat pour l''année 2025',
  'https://www.cafepedagogique.net/article/3',
  'Café Pédagogique',
  NOW() - interval '2 hours'
);