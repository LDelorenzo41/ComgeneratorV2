-- Migration: Fix RAG HNSW search returning 0 results
-- Problem: HNSW index with low ef_search misses results, especially after adding new chunks
-- Solution:
--   1. Recreate match_rag_chunks with hnsw.ef_search = 400 (tuning recall)
--   2. Create match_rag_chunks_exact as emergency fallback (service_role only)
--
-- Tuning note: ef_search=400 trades ~2-3x latency for significantly better recall.
-- Default pgvector ef_search is 40, which causes missed results on small-to-medium
-- datasets after index updates. 400 is a safe production value for <100k vectors.

-- =====================================================
-- 1. Recreate match_rag_chunks with higher ef_search
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
SET hnsw.ef_search = 400
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
--    RESTRICTED to service_role only — this is an emergency
--    fallback called from Edge Functions (which use service_role).
--    Potentially expensive on large tables, must stay exceptional.
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
SET enable_indexscan = off
SET enable_bitmapscan = off
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
-- 3. Permissions
-- =====================================================
-- match_rag_chunks : accessible depuis l'app (authenticated) et le backend (service_role)
GRANT EXECUTE ON FUNCTION match_rag_chunks TO authenticated, service_role;

-- match_rag_chunks_exact : service_role uniquement (fallback coûteux, appelé depuis Edge Functions)
REVOKE ALL ON FUNCTION match_rag_chunks_exact FROM PUBLIC;
REVOKE ALL ON FUNCTION match_rag_chunks_exact FROM authenticated;
GRANT EXECUTE ON FUNCTION match_rag_chunks_exact TO service_role;
