-- ============================================================================
-- RAG Architecture - Migration Scope Global/User
-- À exécuter APRÈS 000_rag_init.sql
-- ============================================================================

-- ============================================================================
-- 1. AJOUTER LA COLONNE SCOPE
-- ============================================================================

-- Ajouter scope aux documents (global = officiel, user = personnel)
ALTER TABLE public.rag_documents
ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'user'
CHECK (scope IN ('global', 'user'));

-- Ajouter scope aux chunks (pour recherche optimisée)
ALTER TABLE public.rag_chunks
ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'user'
CHECK (scope IN ('global', 'user'));

-- Index pour filtrer par scope
CREATE INDEX IF NOT EXISTS rag_documents_scope_idx ON public.rag_documents(scope);
CREATE INDEX IF NOT EXISTS rag_chunks_scope_idx ON public.rag_chunks(scope);

-- ============================================================================
-- 2. METTRE À JOUR LES RLS POLICIES POUR DOCUMENTS GLOBAUX
-- ============================================================================

-- Supprimer l'ancienne policy SELECT
DROP POLICY IF EXISTS "rag_documents_select_own" ON public.rag_documents;

-- Nouvelle policy: voir ses propres docs OU les docs globaux
CREATE POLICY "rag_documents_select_own_or_global" ON public.rag_documents
    FOR SELECT
    USING (auth.uid() = user_id OR scope = 'global');

-- ============================================================================
-- 3. METTRE À JOUR LES RLS POLICIES POUR CHUNKS GLOBAUX
-- ============================================================================

-- Supprimer l'ancienne policy SELECT
DROP POLICY IF EXISTS "rag_chunks_select_own" ON public.rag_chunks;

-- Nouvelle policy: voir ses propres chunks OU les chunks globaux
CREATE POLICY "rag_chunks_select_own_or_global" ON public.rag_chunks
    FOR SELECT
    USING (auth.uid() = user_id OR scope = 'global');

-- ============================================================================
-- 4. METTRE À JOUR LA FONCTION match_rag_chunks POUR INCLURE SCOPE
-- ============================================================================

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS public.match_rag_chunks(UUID, vector(1536), INTEGER, UUID, FLOAT);

-- Recréer avec scope dans le retour ET recherche globale
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
    similarity FLOAT,
    scope TEXT  -- ✅ AJOUTÉ: Retourne le scope
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
        1 - (c.embedding <=> p_query_embedding) AS similarity,
        c.scope  -- ✅ AJOUTÉ
    FROM public.rag_chunks c
    INNER JOIN public.rag_documents d ON d.id = c.document_id
    WHERE
        -- ✅ MODIFIÉ: Cherche dans les chunks de l'utilisateur OU les chunks globaux
        (c.user_id = p_user_id OR c.scope = 'global')
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
-- 5. VÉRIFICATION
-- ============================================================================

DO $$
BEGIN
    -- Vérifier que la colonne scope existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rag_documents' AND column_name = 'scope'
    ) THEN
        RAISE EXCEPTION 'Colonne scope non créée sur rag_documents!';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rag_chunks' AND column_name = 'scope'
    ) THEN
        RAISE EXCEPTION 'Colonne scope non créée sur rag_chunks!';
    END IF;

    RAISE NOTICE '✅ Migration scope terminée avec succès!';
    RAISE NOTICE '   - Colonne scope ajoutée aux tables rag_documents et rag_chunks';
    RAISE NOTICE '   - RLS policies mises à jour pour permettre accès aux docs globaux';
    RAISE NOTICE '   - Fonction match_rag_chunks mise à jour (recherche global + user)';
END $$;
