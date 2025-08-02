/*
  # Création de la table profiles

  1. Nouvelle table
    - `profiles`
      - `user_id` (uuid, référence auth.users)
      - `tokens` (integer, par défaut 10000)
  2. Sécurité
    - Activation de la RLS
    - Policies pour que chaque utilisateur puisse gérer son solde de jetons
*/

-- Création de la table
CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens integer NOT NULL DEFAULT 10000
);

-- Activation de la RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- L'utilisateur peut lire son profil
CREATE POLICY "Users can read their profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- L'utilisateur peut créer son profil
CREATE POLICY "Users can insert their profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- L'utilisateur peut mettre à jour son profil
CREATE POLICY "Users can update their profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);