-- Migration: Drop old match_rag_chunks overloads that cause PGRST203 ambiguity
-- Problem: CREATE OR REPLACE does not remove old function signatures.
--   PostgREST cannot choose between two overloads with the same param names
--   but different parameter order:
--     OLD: (p_user_id uuid, p_query_embedding text, p_match_count int, p_document_id uuid, p_similarity_threshold float8)
--     NEW: (p_query_embedding text, p_similarity_threshold float8, p_match_count int, p_user_id uuid, p_document_id uuid)
-- Solution: Drop the old signature explicitly, keep only the new one.

-- Drop OLD signature (p_user_id first)
DROP FUNCTION IF EXISTS public.match_rag_chunks(uuid, text, integer, uuid, double precision);

-- Also drop any old match_rag_chunks_exact with wrong param order
DROP FUNCTION IF EXISTS public.match_rag_chunks_exact(uuid, text, integer, uuid, double precision);

-- Re-create the correct versions to be absolutely sure
-- (idempotent with 20260317_fix_rag_hnsw_search.sql)

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

-- Permissions
GRANT EXECUTE ON FUNCTION public.match_rag_chunks(text, float, int, uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.match_rag_chunks_exact(text, float, int, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_rag_chunks_exact(text, float, int, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_rag_chunks_exact(text, float, int, uuid, uuid) TO service_role;
