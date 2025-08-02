/*
  # Correction de la table articles

  1. Changements
    - Suppression et recréation propre de la table articles
    - Ajout des contraintes nécessaires
    - Configuration des politiques de sécurité
*/

-- Supprime la table si elle existe
DROP TABLE IF EXISTS articles;

-- Crée la table articles avec la bonne structure
CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  link text NOT NULL,
  source text NOT NULL,
  pub_date timestamptz NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now(),
  -- Ajoute des contraintes pour garantir la validité des données
  CONSTRAINT title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT link_not_empty CHECK (length(trim(link)) > 0),
  CONSTRAINT source_not_empty CHECK (length(trim(source)) > 0)
);

-- Active RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Crée la politique de lecture pour les utilisateurs authentifiés
CREATE POLICY "Allow read access for authenticated users"
  ON articles
  FOR SELECT
  TO authenticated
  USING (true);

-- Crée un index sur la date de publication pour optimiser les requêtes
CREATE INDEX articles_pub_date_idx ON articles(pub_date DESC);