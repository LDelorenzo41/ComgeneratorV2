-- ============================================================================
-- MIGRATION SNAPSHOT : État RLS complet au 2 mars 2026
-- ============================================================================
-- But : versionner l'état exact des RLS et policies de production.
-- Source : requête pg_policies + pg_class.relrowsecurity sur Supabase prod.
-- Idempotent : ALTER TABLE ENABLE RLS est no-op si déjà actif ;
--              DROP POLICY IF EXISTS avant chaque CREATE POLICY.
-- Aucune modification de logique : miroir exact de l'existant.
-- 23 tables, 64 policies.
-- ============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. appreciations (1 policy)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.appreciations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own appreciations" ON public.appreciations;
CREATE POLICY "Users can manage their own appreciations"
  ON public.appreciations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. articles (1 policy)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.articles;
CREATE POLICY "Allow read access for authenticated users"
  ON public.articles
  FOR SELECT
  TO authenticated
  USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. chatbot_answers (4 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.chatbot_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chatbot answers" ON public.chatbot_answers;
CREATE POLICY "Users can view own chatbot answers"
  ON public.chatbot_answers
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chatbot answers" ON public.chatbot_answers;
CREATE POLICY "Users can insert own chatbot answers"
  ON public.chatbot_answers
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chatbot answers" ON public.chatbot_answers;
CREATE POLICY "Users can update own chatbot answers"
  ON public.chatbot_answers
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chatbot answers" ON public.chatbot_answers;
CREATE POLICY "Users can delete own chatbot answers"
  ON public.chatbot_answers
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. consent_logs (2 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can insert consent logs" ON public.consent_logs;
CREATE POLICY "Service role can insert consent logs"
  ON public.consent_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own consent logs" ON public.consent_logs;
CREATE POLICY "Users can view own consent logs"
  ON public.consent_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. criteria (4 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view criteria of their subjects" ON public.criteria;
CREATE POLICY "Users can view criteria of their subjects"
  ON public.criteria
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM subjects
       WHERE subjects.id = criteria.subject_id
         AND subjects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create criteria for their subjects" ON public.criteria;
CREATE POLICY "Users can create criteria for their subjects"
  ON public.criteria
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM subjects
       WHERE subjects.id = criteria.subject_id
         AND subjects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update criteria of their subjects" ON public.criteria;
CREATE POLICY "Users can update criteria of their subjects"
  ON public.criteria
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM subjects
       WHERE subjects.id = criteria.subject_id
         AND subjects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM subjects
       WHERE subjects.id = criteria.subject_id
         AND subjects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete criteria of their subjects" ON public.criteria;
CREATE POLICY "Users can delete criteria of their subjects"
  ON public.criteria
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM subjects
       WHERE subjects.id = criteria.subject_id
         AND subjects.user_id = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. deleted_users_blacklist (3 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.deleted_users_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow checking blacklisted emails" ON public.deleted_users_blacklist;
CREATE POLICY "Allow checking blacklisted emails"
  ON public.deleted_users_blacklist
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service can add deleted emails" ON public.deleted_users_blacklist;
CREATE POLICY "Service can add deleted emails"
  ON public.deleted_users_blacklist
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can manage blacklist" ON public.deleted_users_blacklist;
CREATE POLICY "Service can manage blacklist"
  ON public.deleted_users_blacklist
  FOR ALL
  TO service_role
  USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. edge_function_logs (2 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read logs" ON public.edge_function_logs;
CREATE POLICY "Admins can read logs"
  ON public.edge_function_logs
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
        FROM profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Service role full access" ON public.edge_function_logs;
CREATE POLICY "Service role full access"
  ON public.edge_function_logs
  FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);


-- ══════════════════════════════════════════════════════════════════════════════
-- 8. lessons (2 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user to read own lessons" ON public.lessons;
CREATE POLICY "Allow user to read own lessons"
  ON public.lessons
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user to insert own lessons" ON public.lessons;
CREATE POLICY "Allow user to insert own lessons"
  ON public.lessons
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 9. lessons_bank (1 policy)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.lessons_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own lessons" ON public.lessons_bank;
CREATE POLICY "Users can manage their own lessons"
  ON public.lessons_bank
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════
-- 10. newsletter_logs (2 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.newsletter_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view newsletter logs" ON public.newsletter_logs;
CREATE POLICY "Admins can view newsletter logs"
  ON public.newsletter_logs
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
        FROM profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can insert newsletter logs" ON public.newsletter_logs;
CREATE POLICY "Admins can insert newsletter logs"
  ON public.newsletter_logs
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.is_admin = true
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 11. profiles (3 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their profile" ON public.profiles;
CREATE POLICY "Users can read their profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their profile" ON public.profiles;
CREATE POLICY "Users can insert their profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their profile" ON public.profiles;
CREATE POLICY "Users can update their profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 12. promo_campaigns (2 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.promo_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage campaigns" ON public.promo_campaigns;
CREATE POLICY "Admins can manage campaigns"
  ON public.promo_campaigns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Users can read active campaigns" ON public.promo_campaigns;
CREATE POLICY "Users can read active campaigns"
  ON public.promo_campaigns
  FOR SELECT
  TO authenticated
  USING ((is_active = true) AND (expires_at > now()));


-- ══════════════════════════════════════════════════════════════════════════════
-- 13. promo_redemptions (3 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own redemptions" ON public.promo_redemptions;
CREATE POLICY "Users can view own redemptions"
  ON public.promo_redemptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own redemptions" ON public.promo_redemptions;
CREATE POLICY "Users can create own redemptions"
  ON public.promo_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all redemptions" ON public.promo_redemptions;
CREATE POLICY "Admins can view all redemptions"
  ON public.promo_redemptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.is_admin = true
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 14. rag_chunks (4 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rag_chunks_select_own_or_global" ON public.rag_chunks;
CREATE POLICY "rag_chunks_select_own_or_global"
  ON public.rag_chunks
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id) OR (scope = 'global'::text));

DROP POLICY IF EXISTS "rag_chunks_insert_own" ON public.rag_chunks;
CREATE POLICY "rag_chunks_insert_own"
  ON public.rag_chunks
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_chunks_update_own" ON public.rag_chunks;
CREATE POLICY "rag_chunks_update_own"
  ON public.rag_chunks
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_chunks_delete_own" ON public.rag_chunks;
CREATE POLICY "rag_chunks_delete_own"
  ON public.rag_chunks
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 15. rag_conversations (4 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.rag_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rag_conversations_select_own" ON public.rag_conversations;
CREATE POLICY "rag_conversations_select_own"
  ON public.rag_conversations
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_conversations_insert_own" ON public.rag_conversations;
CREATE POLICY "rag_conversations_insert_own"
  ON public.rag_conversations
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_conversations_update_own" ON public.rag_conversations;
CREATE POLICY "rag_conversations_update_own"
  ON public.rag_conversations
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_conversations_delete_own" ON public.rag_conversations;
CREATE POLICY "rag_conversations_delete_own"
  ON public.rag_conversations
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 16. rag_documents (4 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rag_documents_select_own_or_global" ON public.rag_documents;
CREATE POLICY "rag_documents_select_own_or_global"
  ON public.rag_documents
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id) OR (scope = 'global'::text));

DROP POLICY IF EXISTS "rag_documents_insert_own" ON public.rag_documents;
CREATE POLICY "rag_documents_insert_own"
  ON public.rag_documents
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_documents_update_own" ON public.rag_documents;
CREATE POLICY "rag_documents_update_own"
  ON public.rag_documents
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_documents_delete_own" ON public.rag_documents;
CREATE POLICY "rag_documents_delete_own"
  ON public.rag_documents
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 17. rag_messages (4 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.rag_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rag_messages_select_own" ON public.rag_messages;
CREATE POLICY "rag_messages_select_own"
  ON public.rag_messages
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_messages_insert_own" ON public.rag_messages;
CREATE POLICY "rag_messages_insert_own"
  ON public.rag_messages
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_messages_update_own" ON public.rag_messages;
CREATE POLICY "rag_messages_update_own"
  ON public.rag_messages
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rag_messages_delete_own" ON public.rag_messages;
CREATE POLICY "rag_messages_delete_own"
  ON public.rag_messages
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 18. rss_feeds (1 policy)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.rss_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rss_feeds read for all authenticated" ON public.rss_feeds;
CREATE POLICY "rss_feeds read for all authenticated"
  ON public.rss_feeds
  FOR SELECT
  TO authenticated
  USING (is_active = true);


-- ══════════════════════════════════════════════════════════════════════════════
-- 19. scenarios_bank (4 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.scenarios_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scenarios" ON public.scenarios_bank;
CREATE POLICY "Users can view own scenarios"
  ON public.scenarios_bank
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own scenarios" ON public.scenarios_bank;
CREATE POLICY "Users can insert own scenarios"
  ON public.scenarios_bank
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own scenarios" ON public.scenarios_bank;
CREATE POLICY "Users can update own scenarios"
  ON public.scenarios_bank
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own scenarios" ON public.scenarios_bank;
CREATE POLICY "Users can delete own scenarios"
  ON public.scenarios_bank
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 20. signatures (4 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their signatures" ON public.signatures;
CREATE POLICY "Users can read their signatures"
  ON public.signatures
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their signatures" ON public.signatures;
CREATE POLICY "Users can insert their signatures"
  ON public.signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their signatures" ON public.signatures;
CREATE POLICY "Users can update their signatures"
  ON public.signatures
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their signatures" ON public.signatures;
CREATE POLICY "Users can delete their signatures"
  ON public.signatures
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 21. subjects (4 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subjects" ON public.subjects;
CREATE POLICY "Users can view their own subjects"
  ON public.subjects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own subjects" ON public.subjects;
CREATE POLICY "Users can create their own subjects"
  ON public.subjects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own subjects" ON public.subjects;
CREATE POLICY "Users can update their own subjects"
  ON public.subjects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own subjects" ON public.subjects;
CREATE POLICY "Users can delete their own subjects"
  ON public.subjects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 22. transactions (1 policy)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions"
  ON public.transactions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════
-- 23. user_rss_preferences (4 policies)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.user_rss_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user owns their rss prefs - select" ON public.user_rss_preferences;
CREATE POLICY "user owns their rss prefs - select"
  ON public.user_rss_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user owns their rss prefs - insert" ON public.user_rss_preferences;
CREATE POLICY "user owns their rss prefs - insert"
  ON public.user_rss_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user owns their rss prefs - update" ON public.user_rss_preferences;
CREATE POLICY "user owns their rss prefs - update"
  ON public.user_rss_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user owns their rss prefs - delete" ON public.user_rss_preferences;
CREATE POLICY "user owns their rss prefs - delete"
  ON public.user_rss_preferences
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
