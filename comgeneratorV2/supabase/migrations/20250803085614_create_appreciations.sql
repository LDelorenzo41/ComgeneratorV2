/*
  # Création de la table appreciations

  1. Table
    - id uuid PK
    - user_id uuid
    - detailed text
    - summary text
    - tag text
    - created_at timestamptz

  2. Sécurité
    - Activation de RLS
    - Policies SELECT/INSERT limitées à auth.uid() = user_id
*/

-- Création de la table
CREATE TABLE IF NOT EXISTS appreciations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  detailed text,
  summary text,
  tag text,
  created_at timestamptz DEFAULT now()
);

-- Activation de RLS
ALTER TABLE appreciations ENABLE ROW LEVEL SECURITY;

-- Policy pour SELECT
CREATE POLICY "Users can view their own appreciations"
  ON appreciations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy pour INSERT
CREATE POLICY "Users can create their own appreciations"
  ON appreciations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
