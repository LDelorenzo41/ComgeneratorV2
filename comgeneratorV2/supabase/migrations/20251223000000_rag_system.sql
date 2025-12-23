-- Migration: RAG System Tables and Functions
-- Description: Creates tables for RAG chatbot with document ingestion, vector search, and conversations

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Table des documents RAG
CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'txt',
  storage_path TEXT,
  mime_type TEXT NOT NULL,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'error')),
  error_message TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  scope TEXT NOT NULL DEFAULT 'user' CHECK (scope IN ('global', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des chunks avec embeddings
CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),  -- text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des conversations
CREATE TABLE IF NOT EXISTS rag_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des messages
CREATE TABLE IF NOT EXISTS rag_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEX
-- ============================================================================

-- Index pour la recherche vectorielle
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
ON rag_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index pour les recherches par document
CREATE INDEX IF NOT EXISTS rag_chunks_document_id_idx ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS rag_chunks_chunk_index_idx ON rag_chunks(chunk_index);

-- Index pour les documents
CREATE INDEX IF NOT EXISTS rag_documents_user_id_idx ON rag_documents(user_id);
CREATE INDEX IF NOT EXISTS rag_documents_scope_idx ON rag_documents(scope);
CREATE INDEX IF NOT EXISTS rag_documents_status_idx ON rag_documents(status);

-- Index pour les conversations
CREATE INDEX IF NOT EXISTS rag_conversations_user_id_idx ON rag_conversations(user_id);
CREATE INDEX IF NOT EXISTS rag_messages_conversation_id_idx ON rag_messages(conversation_id);

-- Index full-text sur le contenu des chunks
CREATE INDEX IF NOT EXISTS rag_chunks_content_trgm_idx ON rag_chunks USING gin(content gin_trgm_ops);

-- ============================================================================
-- FONCTIONS RPC
-- ============================================================================

-- Fonction de recherche vectorielle avec filtrage par scope
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding TEXT,
  match_threshold FLOAT,
  match_count INT,
  p_user_id UUID,
  p_document_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  document_title TEXT,
  chunk_index INT,
  content TEXT,
  similarity FLOAT,
  scope TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_embedding vector(1536);
BEGIN
  -- Convertir le JSON en vecteur
  v_embedding := query_embedding::vector(1536);

  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    d.title as document_title,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> v_embedding) as similarity,
    d.scope
  FROM rag_chunks c
  JOIN rag_documents d ON c.document_id = d.id
  WHERE
    d.status = 'ready'
    AND (
      d.scope = 'global'
      OR d.user_id = p_user_id
    )
    AND (
      p_document_id IS NULL
      OR c.document_id = p_document_id
    )
    AND 1 - (c.embedding <=> v_embedding) > match_threshold
  ORDER BY c.embedding <=> v_embedding
  LIMIT match_count;
END;
$$;

-- Fonction pour incrémenter les tokens beta
CREATE OR REPLACE FUNCTION increment_rag_beta_tokens(
  p_user_id UUID,
  p_tokens INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET
    rag_beta_tokens_used = COALESCE(rag_beta_tokens_used, 0) + p_tokens,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Activer RLS sur les tables
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_messages ENABLE ROW LEVEL SECURITY;

-- Policies pour rag_documents
CREATE POLICY "Users can view global documents"
ON rag_documents FOR SELECT
USING (scope = 'global' AND status = 'ready');

CREATE POLICY "Users can view their own documents"
ON rag_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
ON rag_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
ON rag_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
ON rag_documents FOR DELETE
USING (auth.uid() = user_id);

-- Policies pour rag_chunks
CREATE POLICY "Users can view chunks of accessible documents"
ON rag_chunks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rag_documents d
    WHERE d.id = rag_chunks.document_id
    AND (d.scope = 'global' OR d.user_id = auth.uid())
  )
);

-- Policies pour rag_conversations
CREATE POLICY "Users can manage their own conversations"
ON rag_conversations FOR ALL
USING (auth.uid() = user_id);

-- Policies pour rag_messages
CREATE POLICY "Users can manage messages in their conversations"
ON rag_messages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM rag_conversations c
    WHERE c.id = rag_messages.conversation_id
    AND c.user_id = auth.uid()
  )
);

-- ============================================================================
-- EXTENSION DU PROFIL (si pas déjà présent)
-- ============================================================================

-- Ajouter les colonnes pour le quota beta si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rag_beta_tokens_used'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rag_beta_tokens_used INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rag_beta_tokens_limit'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rag_beta_tokens_limit INTEGER DEFAULT 200000;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rag_beta_reset_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rag_beta_reset_date TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================

-- Créer le bucket pour les documents RAG (via SQL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rag-documents',
  'rag-documents',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le storage
CREATE POLICY "Users can upload to their folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rag-documents'
  AND (
    -- Documents utilisateur dans leur dossier
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Documents globaux (vérification admin à faire côté Edge Function)
    (storage.foldername(name))[1] = 'global'
  )
);

CREATE POLICY "Users can view their documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rag-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] = 'global'
  )
);

CREATE POLICY "Users can delete their documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rag-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rag_documents_updated_at
BEFORE UPDATE ON rag_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rag_conversations_updated_at
BEFORE UPDATE ON rag_conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EXTENSION pg_trgm pour la recherche textuelle
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
