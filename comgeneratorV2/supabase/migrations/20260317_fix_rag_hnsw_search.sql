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
AS $$
DECLARE
  query_vec vector(1536);
BEGIN
  query_vec := p_query_embedding::vector(1536);

  -- Augmenter ef_search pour améliorer la précision HNSW (défaut pgvector = 40)
  -- set_config avec local_only=true limite l'effet à la transaction courante
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
AS $$
DECLARE
  query_vec vector(1536);
BEGIN
  query_vec := p_query_embedding::vector(1536);

  -- Forcer la recherche séquentielle (exacte) en désactivant les index
  -- set_config avec local_only=true limite l'effet à la transaction courante
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
-- SECURITY DEFINER est nécessaire car les Edge Functions appellent via le client
-- Supabase avec le token utilisateur, mais la requête doit bypasser les RLS
-- sur rag_chunks/rag_documents pour joindre et filtrer correctement.
GRANT EXECUTE ON FUNCTION public.match_rag_chunks(text, float, int, uuid, uuid) TO authenticated, service_role;

-- match_rag_chunks_exact : service_role uniquement (fallback coûteux, appelé depuis Edge Functions)
-- Note: SECURITY DEFINER requis pour les mêmes raisons que match_rag_chunks.
REVOKE ALL ON FUNCTION public.match_rag_chunks_exact(text, float, int, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_rag_chunks_exact(text, float, int, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_rag_chunks_exact(text, float, int, uuid, uuid) TO service_role;

-- Note: p_user_id = NULL retourne volontairement 0 résultats (pas de user = pas de données).
-- Ce comportement est voulu : toute recherche RAG doit être scopée à un utilisateur.