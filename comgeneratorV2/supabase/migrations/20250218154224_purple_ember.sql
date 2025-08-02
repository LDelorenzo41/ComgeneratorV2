/*
  # Ajout de la colonne image_url à la table articles

  1. Modifications
    - Ajout de la colonne `image_url` de type text à la table `articles`
    - La colonne est nullable car tous les articles n'auront pas forcément une image

  2. Sécurité
    - Aucune modification des politiques de sécurité n'est nécessaire
    - Les permissions existantes s'appliquent à la nouvelle colonne
*/

-- Ajout de la colonne image_url
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS image_url text;