-- Migration pour corriger les tokens par défaut
-- Fichier: supabase/migrations/YYYYMMDDHHMMSS_fix_default_tokens.sql

-- 1. Mettre à jour la valeur par défaut à 10000
ALTER TABLE profiles ALTER COLUMN tokens SET DEFAULT 10000;

-- 2. Mettre à jour la fonction de création d'utilisateur
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, tokens, has_bank_access)
  VALUES (new.id, 10000, true);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;