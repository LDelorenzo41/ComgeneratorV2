-- Migration: Création des tables pour l'application de feedback testeurs
-- Date: 2026-03-22

-- Table principale : une entrée par session de feedback (un testeur)
CREATE TABLE feedback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_name TEXT,
  tester_email TEXT,
  matiere TEXT,
  niveau TEXT,
  anciennete INT,
  a_achete_tokens BOOLEAN,
  prevoit_acheter TEXT,
  raison_achat TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table des notes (1-5) par question
CREATE TABLE feedback_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  question_key TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_ratings_session ON feedback_ratings(session_id);
CREATE INDEX idx_feedback_ratings_section ON feedback_ratings(section);

-- Table des commentaires libres
CREATE TABLE feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_comments_session ON feedback_comments(session_id);
CREATE INDEX idx_feedback_comments_section ON feedback_comments(section);

-- RLS : INSERT public (anon), SELECT réservé aux admins
ALTER TABLE feedback_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_sessions" ON feedback_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_read_sessions" ON feedback_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true)
);

ALTER TABLE feedback_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_ratings" ON feedback_ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_read_ratings" ON feedback_ratings FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true)
);

ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_comments" ON feedback_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_read_comments" ON feedback_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true)
);
