-- ============================================================================
-- Journal des générations : alimente les compteurs « Mon année avec
-- ProfAssist » de la page Mon espace. Une ligne par génération réussie.
-- Best-effort côté client : une insertion en échec ne bloque jamais l'outil.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'appreciation', 'synthese', 'lesson', 'exercise', 'scenario', 'communication'
  )),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generation_events_user_created_idx
  ON public.generation_events (user_id, created_at DESC);

ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur n'écrit et ne lit que ses propres événements.
DROP POLICY IF EXISTS "generation_events_insert_own" ON public.generation_events;
CREATE POLICY "generation_events_insert_own"
  ON public.generation_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "generation_events_select_own" ON public.generation_events;
CREATE POLICY "generation_events_select_own"
  ON public.generation_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Grants explicites (les privilèges par défaut du projet couvrent déjà ce cas,
-- réaffirmés ici par cohérence avec GRANTS_DATA_API.md)
GRANT SELECT, INSERT ON public.generation_events TO authenticated;
GRANT ALL ON public.generation_events TO service_role;
