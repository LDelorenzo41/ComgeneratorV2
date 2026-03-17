-- Migration: Fix RAG HNSW search returning 0 results
-- Problem: HNSW index with low ef_search misses results, especially after adding new chunks
-- Solution:
--   1. Recreate match_rag_chunks with SET LOCAL hnsw.ef_search = 400
--   2. Create match_rag_chunks_exact as fallback (forces sequential scan)

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
AS $$
DECLARE
  query_vec vector(1536);
BEGIN
  -- Convertir le texte en vecteur
  query_vec := p_query_embedding::vector(1536);

  -- Augmenter ef_search pour améliorer la précision HNSW
  -- SET LOCAL ne persiste que pour la transaction courante
  PERFORM set_config('hnsw.ef_search', '400', true);

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
-- 2. Create exact search fallback (bypasses HNSW index)
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
  -- Convertir le texte en vecteur
  query_vec := p_query_embedding::vector(1536);

  -- Forcer la recherche séquentielle (exacte) au lieu de l'index HNSW
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

  -- Réactiver les index pour les autres requêtes
  PERFORM set_config('enable_indexscan', 'on', true);
  PERFORM set_config('enable_bitmapscan', 'on', true);
END;
$$;

-- =====================================================
-- 3. Helper function for setting config from Edge Functions
-- =====================================================
CREATE OR REPLACE FUNCTION set_config_param(
  param_name text,
  param_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config(param_name, param_value, true);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION match_rag_chunks TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_rag_chunks_exact TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_config_param TO authenticated, service_role;
