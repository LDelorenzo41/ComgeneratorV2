-- Migration: Create rag_folders table and add folder_id to rag_documents
-- Safe: adds new table + nullable column, no impact on existing data
-- Idempotent: safe to replay

-- 1. Create rag_folders table
CREATE TABLE IF NOT EXISTS public.rag_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rag_folders_name_user_unique UNIQUE (user_id, name)
);

-- 2. Add folder_id to rag_documents (nullable for backward compatibility)
ALTER TABLE public.rag_documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.rag_folders(id) ON DELETE SET NULL;

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_rag_folders_user_id ON public.rag_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_folder_id ON public.rag_documents(folder_id);

-- 4. RLS policies for rag_folders (idempotent: drop before create)
ALTER TABLE public.rag_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own folders" ON public.rag_folders;
CREATE POLICY "Users can read own folders" ON public.rag_folders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own folders" ON public.rag_folders;
CREATE POLICY "Users can insert own folders" ON public.rag_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own folders" ON public.rag_folders;
CREATE POLICY "Users can update own folders" ON public.rag_folders
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own folders" ON public.rag_folders;
CREATE POLICY "Users can delete own folders" ON public.rag_folders
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Trigger to auto-update updated_at on rag_folders (idempotent)
CREATE OR REPLACE FUNCTION public.update_rag_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rag_folders_updated_at ON public.rag_folders;
CREATE TRIGGER trg_rag_folders_updated_at
  BEFORE UPDATE ON public.rag_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rag_folders_updated_at();

-- 6. Cross-user protection: ensure folder_id on rag_documents belongs to the same user
CREATE OR REPLACE FUNCTION public.validate_folder_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.folder_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.rag_folders
      WHERE id = NEW.folder_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'folder_id does not belong to the same user_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_folder_owner ON public.rag_documents;
CREATE TRIGGER trg_validate_folder_owner
  BEFORE INSERT OR UPDATE OF folder_id ON public.rag_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_folder_owner();