/*
  # Initial Schema Setup

  1. New Tables
    - `subjects`
      - `id` (uuid, primary key)
      - `name` (text)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `criteria`
      - `id` (uuid, primary key)
      - `subject_id` (uuid, references subjects)
      - `name` (text)
      - `importance` (integer)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
    - Add trigger for updating `updated_at` column
*/

-- Création de la table subjects
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Création de la table criteria
CREATE TABLE IF NOT EXISTS criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  importance integer NOT NULL CHECK (importance BETWEEN 1 AND 3),
  created_at timestamptz DEFAULT now()
);

-- Activation de RLS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria ENABLE ROW LEVEL SECURITY;

-- Policies pour subjects
CREATE POLICY "Users can view their own subjects"
  ON subjects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subjects"
  ON subjects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subjects"
  ON subjects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subjects"
  ON subjects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies pour criteria
CREATE POLICY "Users can view criteria of their subjects"
  ON criteria
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM subjects 
    WHERE subjects.id = criteria.subject_id 
    AND subjects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create criteria for their subjects"
  ON criteria
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM subjects 
    WHERE subjects.id = subject_id 
    AND subjects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update criteria of their subjects"
  ON criteria
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM subjects 
    WHERE subjects.id = criteria.subject_id 
    AND subjects.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM subjects 
    WHERE subjects.id = subject_id 
    AND subjects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete criteria of their subjects"
  ON criteria
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM subjects 
    WHERE subjects.id = criteria.subject_id 
    AND subjects.user_id = auth.uid()
  ));

-- Trigger pour mettre à jour updated_at
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ language 'plpgsql';
EXCEPTION
  WHEN duplicate_function THEN NULL;
END $$;

DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();