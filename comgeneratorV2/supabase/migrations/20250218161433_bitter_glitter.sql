/*
  # Création de la table articles

  1. Nouvelle Table
    - `articles`
      - `id` (uuid, clé primaire)
      - `title` (text, non null)
      - `description` (text)
      - `link` (text, non null)
      - `source` (text, non null)
      - `pub_date` (timestamptz, non null)
      - `image_url` (text)
      - `created_at` (timestamptz, par défaut now())

  2. Sécurité
    - Active RLS sur la table articles
    - Ajoute une policy pour permettre la lecture aux utilisateurs authentifiés
*/

-- Création de la table articles
CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  link text NOT NULL,
  source text NOT NULL,
  pub_date timestamptz NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Activation de RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre la lecture aux utilisateurs authentifiés
CREATE POLICY "Allow read access for authenticated users"
  ON articles
  FOR SELECT
  TO authenticated
  USING (true);

-- Mise à jour des images par défaut des articles
UPDATE articles
SET image_url = CASE
  WHEN source = 'Café Pédagogique' THEN 'https://www.cafepedagogique.net/wp-content/themes/cafe2020/assets/images/logo.png'
  WHEN source = 'VousNousIls' THEN 'https://www.vousnousils.fr/wp-content/themes/vni2020/assets/images/logo.png'
  ELSE NULL
END
WHERE image_url IS NULL;