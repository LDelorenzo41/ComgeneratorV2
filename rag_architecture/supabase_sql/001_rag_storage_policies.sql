-- ============================================================================
-- RAG Storage Policies - Bucket et RLS pour Supabase Storage
-- À exécuter APRÈS avoir créé le bucket 'rag-documents' dans le Dashboard
-- ============================================================================

-- Note: Le bucket doit être créé manuellement dans le Dashboard Supabase:
-- Storage > New bucket > Name: "rag-documents" > Private: ✓

-- ============================================================================
-- 1. POLICIES POUR LE BUCKET rag-documents
-- ============================================================================

-- Convention de path: {user_id}/{document_id}/{filename}
-- Exemple: 123e4567-e89b-12d3-a456-426614174000/abc123/mon_document.pdf

-- SELECT: Un user peut lire uniquement ses fichiers
DROP POLICY IF EXISTS "rag_storage_select_own" ON storage.objects;
CREATE POLICY "rag_storage_select_own" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'rag-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- INSERT: Un user peut uploader uniquement dans son dossier
DROP POLICY IF EXISTS "rag_storage_insert_own" ON storage.objects;
CREATE POLICY "rag_storage_insert_own" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'rag-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- UPDATE: Un user peut modifier uniquement ses fichiers
DROP POLICY IF EXISTS "rag_storage_update_own" ON storage.objects;
CREATE POLICY "rag_storage_update_own" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'rag-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'rag-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- DELETE: Un user peut supprimer uniquement ses fichiers
DROP POLICY IF EXISTS "rag_storage_delete_own" ON storage.objects;
CREATE POLICY "rag_storage_delete_own" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'rag-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ============================================================================
-- 2. VÉRIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Storage policies RAG créées!';
    RAISE NOTICE '   Convention de path: {user_id}/{document_id}/{filename}';
    RAISE NOTICE '   Bucket requis: rag-documents (privé)';
END $$;
