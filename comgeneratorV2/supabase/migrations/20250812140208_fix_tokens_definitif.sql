/*
  # Correction définitive des tokens par défaut

  1. Changements
    - Force les tokens par défaut à 10000 (au lieu de 100000)
    - Corrige tous les profils existants qui ont trop de tokens
    - Met à jour la fonction handle_new_user() pour créer avec 10000 tokens

  2. Sécurité
    - Maintien des politiques RLS existantes
*/

-- 1. Corriger la valeur par défaut des tokens
ALTER TABLE profiles ALTER COLUMN tokens SET DEFAULT 10000;

-- 2. Corriger tous les profils qui ont trop de tokens (erreur des tests)
UPDATE profiles SET tokens = 10000 WHERE tokens > 50000;

-- 3. Corriger la fonction pour créer avec 10000 tokens
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, tokens)
  VALUES (new.id, 10000);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;