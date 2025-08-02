/*
  # Mise à jour des images par défaut des articles

  1. Changements
    - Ajout d'URLs d'images par défaut pour les articles existants en fonction de leur source
*/

-- Mise à jour des images par défaut des articles
UPDATE articles
SET image_url = CASE
  WHEN source = 'Café Pédagogique' THEN 'https://www.cafepedagogique.net/wp-content/themes/cafe2020/assets/images/logo.png'
  WHEN source = 'VousNousIls' THEN 'https://www.vousnousils.fr/wp-content/themes/vni2020/assets/images/logo.png'
  ELSE NULL
END
WHERE image_url IS NULL;