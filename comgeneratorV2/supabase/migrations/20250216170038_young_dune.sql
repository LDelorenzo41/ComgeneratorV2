/*
  # Ajout de la table articles

  1. Nouvelle table
    - `articles` : Stocke les articles RSS
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `link` (text)
      - `source` (text)
      - `pub_date` (timestamptz)
      - `created_at` (timestamptz)

  2. Sécurité
    - Enable RLS
    - Ajouter une policy pour permettre la lecture par tous les utilisateurs authentifiés
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