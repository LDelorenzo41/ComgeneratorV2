/*
  # Création de la table articles

  1. Nouvelle Table
    - `articles`
      - `id` (uuid, primary key)
      - `title` (text, not null)
      - `description` (text)
      - `link` (text, not null)
      - `source` (text, not null)
      - `pub_date` (timestamptz, not null)
      - `image_url` (text)
      - `created_at` (timestamptz, default now())

  2. Sécurité
    - Enable RLS
    - Add policy for authenticated users to read articles
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