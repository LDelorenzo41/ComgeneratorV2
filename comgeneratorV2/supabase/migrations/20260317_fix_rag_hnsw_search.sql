-- Migration: Fix RAG search functions for Supabase compatibility
-- Problem: hnsw.ef_search cannot be tuned on Supabase (permission denied)
-- Solution:
--   1. match_rag_chunks uses default pgvector ef_search (no tuning)
--   2. match_rag_chunks_exact bypasses HNSW entirely (sequential scan)
--   3. Fallback logic (HNSW → exact) is handled in Edge Functions

-- =====================================================
-- 1. match_rag_chunks — standard HNSW search
-- =====================================================
CREATE OR REPLACE FUNCTION match_rag_chunks(
  p_query_embedding text,
  p_similarity_threshold float DEFAULT 0.3,
  p_match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL,
  p_document_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  content text,
  document_id uuid,
  document_title text,
  similarity float,
  chunk_index int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_vec vector(1536);
BEGIN
  query_vec := p_query_embedding::vector(1536);

  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.document_id,
    d.title AS document_title,
    1 - (c.embedding <=> query_vec) AS similarity,
    c.chunk_index
  FROM rag_chunks c
  JOIN rag_documents d ON d.id = c.document_id
  WHERE
    d.scope = 'user'
    AND d.user_id = p_user_id
    AND d.status = 'ready'
    AND 1 - (c.embedding <=> query_vec) >= p_similarity_threshold
    AND (p_document_id IS NULL OR c.document_id = p_document_id)
  ORDER BY c.embedding <=> query_vec
  LIMIT p_match_count;
END;
$$;

-- =====================================================
-- 2. Exact search fallback (bypasses HNSW index)
--    RESTRICTED to service_role only — emergency fallback
--    called from Edge Functions when HNSW returns 0 results.
-- =====================================================
CREATE OR REPLACE FUNCTION match_rag_chunks_exact(
  p_query_embedding text,
  p_similarity_threshold float DEFAULT 0.3,
  p_match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL,
  p_document_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  content text,
  document_id uuid,
  document_title text,
  similarity float,
  chunk_index int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_vec vector(1536);
BEGIN
  query_vec := p_query_embedding::vector(1536);

  -- Forcer la recherche séquentielle (exacte) en désactivant les index
  -- enable_indexscan / enable_bitmapscan sont des paramètres core PG, pas d'extension
  PERFORM set_config('enable_indexscan', 'off', true);
  PERFORM set_config('enable_bitmapscan', 'off', true);

  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.document_id,
    d.title AS document_title,
    1 - (c.embedding <=> query_vec) AS similarity,
    c.chunk_index
  FROM rag_chunks c
  JOIN rag_documents d ON d.id = c.document_id
  WHERE
    d.scope = 'user'
    AND d.user_id = p_user_id
    AND d.status = 'ready'
    AND 1 - (c.embedding <=> query_vec) >= p_similarity_threshold
    AND (p_document_id IS NULL OR c.document_id = p_document_id)
  ORDER BY c.embedding <=> query_vec
  LIMIT p_match_count;
END;
$$;

-- =====================================================
-- 3. Permissions (signatures qualifiées pour éviter toute ambiguïté)
-- =====================================================

-- match_rag_chunks : accessible depuis l'app (authenticated) et le backend (service_role)
GRANT EXECUTE ON FUNCTION public.match_rag_chunks(text, float, int, uuid, uuid) TO authenticated, service_role;

-- match_rag_chunks_exact : service_role uniquement (fallback coûteux, appelé depuis Edge Functions)
REVOKE ALL ON FUNCTION public.match_rag_chunks_exact(text, float, int, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_rag_chunks_exact(text, float, int, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_rag_chunks_exact(text, float, int, uuid, uuid) TO service_role;

-- Note: p_user_id = NULL retourne volontairement 0 résultats (pas de user = pas de données).
-- Ce comportement est voulu : toute recherche RAG doit être scopée à un utilisateur.
