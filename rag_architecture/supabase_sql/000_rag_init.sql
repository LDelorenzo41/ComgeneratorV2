-- ============================================================================
-- RAG Architecture - Migration Complète pour ProfAssist
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ============================================================================

-- ============================================================================
-- 1. ACTIVATION DES EXTENSIONS
-- ============================================================================

-- Extension pgvector pour les embeddings
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================================
-- 2. CRÉATION DES TABLES
-- ============================================================================

-- Table des documents uploadés par les utilisateurs
CREATE TABLE IF NOT EXISTS public.rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'upload',
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'error')),
    error_message TEXT,
    chunk_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des chunks avec embeddings
CREATE TABLE IF NOT EXISTS public.rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small/ada-002 = 1536 dimensions
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des conversations (historique des chats)
CREATE TABLE IF NOT EXISTS public.rag_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Nouvelle conversation',
    mode TEXT NOT NULL DEFAULT 'corpus_only' CHECK (mode IN ('corpus_only', 'corpus_plus_ai')),
    document_filter_id UUID REFERENCES public.rag_documents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des messages dans les conversations
CREATE TABLE IF NOT EXISTS public.rag_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.rag_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]', -- [{document_id, chunk_id, chunk_index, excerpt, score}]
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEX
-- ============================================================================

-- Index vectoriel HNSW pour recherche rapide de similarité
-- HNSW est recommandé pour les performances en production
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
ON public.rag_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index standards pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS rag_chunks_user_id_idx ON public.rag_chunks(user_id);
CREATE INDEX IF NOT EXISTS rag_chunks_document_id_idx ON public.rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS rag_chunks_content_hash_idx ON public.rag_chunks(content_hash);

CREATE INDEX IF NOT EXISTS rag_documents_user_id_idx ON public.rag_documents(user_id);
CREATE INDEX IF NOT EXISTS rag_documents_status_idx ON public.rag_documents(status);

CREATE INDEX IF NOT EXISTS rag_conversations_user_id_idx ON public.rag_conversations(user_id);
CREATE INDEX IF NOT EXISTS rag_messages_conversation_id_idx ON public.rag_messages(conversation_id);
CREATE INDEX IF NOT EXISTS rag_messages_user_id_idx ON public.rag_messages(user_id);

-- ============================================================================
-- 4. TRIGGERS POUR UPDATED_AT
-- ============================================================================

-- Fonction générique pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur rag_documents
DROP TRIGGER IF EXISTS update_rag_documents_updated_at ON public.rag_documents;
CREATE TRIGGER update_rag_documents_updated_at
    BEFORE UPDATE ON public.rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger sur rag_conversations
DROP TRIGGER IF EXISTS update_rag_conversations_updated_at ON public.rag_conversations;
CREATE TRIGGER update_rag_conversations_updated_at
    BEFORE UPDATE ON public.rag_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Activer RLS sur toutes les tables RAG
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5.1 Policies pour rag_documents
-- ============================================================================

-- SELECT: Un user ne peut voir que ses documents
DROP POLICY IF EXISTS "rag_documents_select_own" ON public.rag_documents;
CREATE POLICY "rag_documents_select_own" ON public.rag_documents
    FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: Un user ne peut créer que pour lui-même
DROP POLICY IF EXISTS "rag_documents_insert_own" ON public.rag_documents;
CREATE POLICY "rag_documents_insert_own" ON public.rag_documents
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: Un user ne peut modifier que ses documents
DROP POLICY IF EXISTS "rag_documents_update_own" ON public.rag_documents;
CREATE POLICY "rag_documents_update_own" ON public.rag_documents
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: Un user ne peut supprimer que ses documents
DROP POLICY IF EXISTS "rag_documents_delete_own" ON public.rag_documents;
CREATE POLICY "rag_documents_delete_own" ON public.rag_documents
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 5.2 Policies pour rag_chunks
-- ============================================================================

DROP POLICY IF EXISTS "rag_chunks_select_own" ON public.rag_chunks;
CREATE POLICY "rag_chunks_select_own" ON public.rag_chunks
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_chunks_insert_own" ON public.rag_chunks;
CREATE POLICY "rag_chunks_insert_own" ON public.rag_chunks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_chunks_update_own" ON public.rag_chunks;
CREATE POLICY "rag_chunks_update_own" ON public.rag_chunks
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_chunks_delete_own" ON public.rag_chunks;
CREATE POLICY "rag_chunks_delete_own" ON public.rag_chunks
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 5.3 Policies pour rag_conversations
-- ============================================================================

DROP POLICY IF EXISTS "rag_conversations_select_own" ON public.rag_conversations;
CREATE POLICY "rag_conversations_select_own" ON public.rag_conversations
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_conversations_insert_own" ON public.rag_conversations;
CREATE POLICY "rag_conversations_insert_own" ON public.rag_conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_conversations_update_own" ON public.rag_conversations;
CREATE POLICY "rag_conversations_update_own" ON public.rag_conversations
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_conversations_delete_own" ON public.rag_conversations;
CREATE POLICY "rag_conversations_delete_own" ON public.rag_conversations
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 5.4 Policies pour rag_messages
-- ============================================================================

DROP POLICY IF EXISTS "rag_messages_select_own" ON public.rag_messages;
CREATE POLICY "rag_messages_select_own" ON public.rag_messages
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_messages_insert_own" ON public.rag_messages;
CREATE POLICY "rag_messages_insert_own" ON public.rag_messages
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_messages_update_own" ON public.rag_messages;
CREATE POLICY "rag_messages_update_own" ON public.rag_messages
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_messages_delete_own" ON public.rag_messages;
CREATE POLICY "rag_messages_delete_own" ON public.rag_messages
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 6. FONCTION DE RECHERCHE VECTORIELLE
-- ============================================================================

-- Fonction principale de recherche de chunks par similarité
CREATE OR REPLACE FUNCTION public.match_rag_chunks(
    p_user_id UUID,
    p_query_embedding vector(1536),
    p_match_count INTEGER DEFAULT 5,
    p_document_id UUID DEFAULT NULL,
    p_similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    document_title TEXT,
    chunk_index INTEGER,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS chunk_id,
        c.document_id,
        d.title AS document_title,
        c.chunk_index,
        c.content,
        1 - (c.embedding <=> p_query_embedding) AS similarity
    FROM public.rag_chunks c
    INNER JOIN public.rag_documents d ON d.id = c.document_id
    WHERE
        c.user_id = p_user_id
        AND c.embedding IS NOT NULL
        AND (p_document_id IS NULL OR c.document_id = p_document_id)
        AND (1 - (c.embedding <=> p_query_embedding)) >= p_similarity_threshold
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$;

-- Accorder les droits d'exécution
GRANT EXECUTE ON FUNCTION public.match_rag_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_rag_chunks TO service_role;

-- ============================================================================
-- 7. FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction pour mettre à jour le compte de chunks d'un document
CREATE OR REPLACE FUNCTION public.update_document_chunk_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.rag_documents
        SET chunk_count = chunk_count + 1
        WHERE id = NEW.document_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.rag_documents
        SET chunk_count = chunk_count - 1
        WHERE id = OLD.document_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour maintenir le compte de chunks
DROP TRIGGER IF EXISTS update_chunk_count_on_insert ON public.rag_chunks;
CREATE TRIGGER update_chunk_count_on_insert
    AFTER INSERT ON public.rag_chunks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_document_chunk_count();

DROP TRIGGER IF EXISTS update_chunk_count_on_delete ON public.rag_chunks;
CREATE TRIGGER update_chunk_count_on_delete
    AFTER DELETE ON public.rag_chunks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_document_chunk_count();

-- Fonction pour supprimer les chunks existants d'un document (idempotence)
CREATE OR REPLACE FUNCTION public.delete_document_chunks(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.rag_chunks WHERE document_id = p_document_id;
    UPDATE public.rag_documents SET chunk_count = 0 WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_document_chunks TO service_role;

-- ============================================================================
-- 8. VÉRIFICATION FINALE
-- ============================================================================

-- Vérifier que l'extension vector est bien installée
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'Extension pgvector non installée!';
    END IF;
END $$;

-- Message de succès
DO $$
BEGIN
    RAISE NOTICE '✅ Migration RAG terminée avec succès!';
    RAISE NOTICE '   - Tables créées: rag_documents, rag_chunks, rag_conversations, rag_messages';
    RAISE NOTICE '   - Index HNSW créé sur rag_chunks.embedding';
    RAISE NOTICE '   - RLS activé sur toutes les tables';
    RAISE NOTICE '   - Fonction match_rag_chunks disponible';
END $$;
