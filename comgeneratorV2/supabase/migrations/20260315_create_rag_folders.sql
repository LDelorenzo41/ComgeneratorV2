-- Migration: Create rag_folders table and add folder_id to rag_documents
-- Safe: adds new table + nullable column, no impact on existing data

-- 1. Create rag_folders table
CREATE TABLE IF NOT EXISTS rag_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rag_folders_name_user_unique UNIQUE (user_id, name)
);

-- 2. Add folder_id to rag_documents (nullable for backward compatibility)
ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES rag_folders(id) ON DELETE SET NULL;

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_rag_folders_user_id ON rag_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_folder_id ON rag_documents(folder_id);

-- 4. RLS policies for rag_folders
ALTER TABLE rag_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own folders" ON rag_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders" ON rag_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON rag_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON rag_folders
  FOR DELETE USING (auth.uid() = user_id);
