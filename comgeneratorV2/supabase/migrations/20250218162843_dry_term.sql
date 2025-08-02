/*
  # Create articles table

  1. New Tables
    - `articles`
      - `id` (uuid, primary key)
      - `title` (text, not null)
      - `description` (text)
      - `link` (text, not null)
      - `source` (text, not null)
      - `pub_date` (timestamptz, not null)
      - `image_url` (text)
      - `created_at` (timestamptz, default: now())

  2. Security
    - Enable RLS on `articles` table
    - Add policy for authenticated users to read articles
*/

-- Create articles table
CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  link text NOT NULL,
  source text NOT NULL,
  pub_date timestamptz NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Create policy for reading articles
CREATE POLICY "Allow read access for authenticated users"
  ON articles
  FOR SELECT
  TO authenticated
  USING (true);