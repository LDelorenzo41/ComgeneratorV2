/*
  # Création de la table articles

  1. Nouvelle Table
    - `articles`
      - `id` (uuid, clé primaire)
      - `title` (text, obligatoire)
      - `description` (text, optionnel)
      - `link` (text, obligatoire)
      - `source` (text, obligatoire)
      - `pub_date` (timestamptz, obligatoire)
      - `created_at` (timestamptz, par défaut now())

  2. Sécurité
    - Active RLS sur la table `articles`
    - Ajoute une policy permettant la lecture aux utilisateurs authentifiés
*/

CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  link text NOT NULL,
  source text NOT NULL,
  pub_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all authenticated users"
  ON articles
  FOR SELECT
  TO authenticated
  USING (true);