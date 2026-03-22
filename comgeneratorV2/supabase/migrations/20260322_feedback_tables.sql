-- Migration: Création des tables pour l'application de feedback testeurs
-- Date: 2026-03-22

-- ============================================================
-- Table principale : une entrée par session de feedback (un testeur)
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_name TEXT,
  tester_email TEXT NOT NULL,
  matiere TEXT,
  niveau TEXT,
  anciennete INT CHECK (anciennete IS NULL OR (anciennete >= 0 AND anciennete <= 50)),
  a_achete_tokens BOOLEAN,
  prevoit_acheter TEXT,
  raison_achat TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unicité sur l'email (une seule réponse par testeur)
CREATE UNIQUE INDEX IF NOT EXISTS feedback_sessions_tester_email_unique
  ON feedback_sessions (LOWER(tester_email));

-- ============================================================
-- Table des notes (1-5) par question
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  question_key TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Empêcher les doublons : une seule note par question par session
  CONSTRAINT feedback_ratings_unique_question UNIQUE (session_id, section, question_key)
);

CREATE INDEX IF NOT EXISTS idx_feedback_ratings_session ON feedback_ratings(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_ratings_section ON feedback_ratings(section);

-- ============================================================
-- Table des commentaires libres
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_comments_session ON feedback_comments(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_section ON feedback_comments(section);

-- ============================================================
-- RLS : INSERT réservé à anon, SELECT réservé aux admins
-- ============================================================

-- feedback_sessions
ALTER TABLE feedback_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_sessions" ON feedback_sessions;
CREATE POLICY "anon_insert_sessions" ON feedback_sessions
  FOR INSERT TO anon
  WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read_sessions" ON feedback_sessions;
CREATE POLICY "admin_read_sessions" ON feedback_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true)
  );

-- feedback_ratings
ALTER TABLE feedback_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_ratings" ON feedback_ratings;
CREATE POLICY "anon_insert_ratings" ON feedback_ratings
  FOR INSERT TO anon
  WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read_ratings" ON feedback_ratings;
CREATE POLICY "admin_read_ratings" ON feedback_ratings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true)
  );

-- feedback_comments
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_comments" ON feedback_comments;
CREATE POLICY "anon_insert_comments" ON feedback_comments
  FOR INSERT TO anon
  WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read_comments" ON feedback_comments;
CREATE POLICY "admin_read_comments" ON feedback_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true)
  );