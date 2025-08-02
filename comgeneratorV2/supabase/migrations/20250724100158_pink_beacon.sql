/*
  # Mise à jour des tokens par défaut

  1. Changements
    - Modification de la valeur par défaut des tokens à 100000 pour le développement
    - Mise à jour des profils existants pour avoir 100000 tokens
    - Ajout d'un trigger pour créer automatiquement un profil avec 100000 tokens lors de l'inscription

  2. Sécurité
    - Maintien des politiques RLS existantes
*/

-- Modifier la valeur par défaut des tokens
ALTER TABLE profiles ALTER COLUMN tokens SET DEFAULT 100000;

-- Mettre à jour tous les profils existants pour avoir 100000 tokens
UPDATE profiles SET tokens = 100000 WHERE tokens < 100000;

-- Créer une fonction pour créer automatiquement un profil lors de l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, tokens)
  VALUES (new.id, 100000);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer un trigger pour exécuter la fonction lors de l'inscription
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();