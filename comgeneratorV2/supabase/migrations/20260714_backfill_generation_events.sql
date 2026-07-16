-- ============================================================================
-- Reprise d'historique du journal des générations.
-- Le journal (generation_events) démarre vide : sans reprise, le dashboard
-- admin et « Mon année avec ProfAssist » affichent 0 alors que les banques
-- contiennent des mois d'activité. Chaque enregistrement en banque correspond
-- à au moins une génération : on le réinjecte avec sa date d'origine.
--
-- Limites assumées :
--  - les générations non sauvegardées en banque restent inconnues (plancher) ;
--  - synthèses et chatbot ne sont pas repris ici : leurs historiques vivent
--    déjà dans edge_function_logs, affiché tel quel par le dashboard ;
--  - exercices et communications n'ont aucune trace historique.
-- ============================================================================

-- Distinguer les lignes reprises des lignes vivantes, et rendre la reprise
-- ré-exécutable sans doublon.
ALTER TABLE public.generation_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'live';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.generation_events WHERE source = 'backfill') THEN

    INSERT INTO public.generation_events (user_id, kind, created_at, source)
    SELECT user_id, 'appreciation', created_at, 'backfill'
    FROM public.appreciations
    WHERE user_id IS NOT NULL AND created_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = user_id);

    INSERT INTO public.generation_events (user_id, kind, created_at, source)
    SELECT user_id, 'lesson', created_at, 'backfill'
    FROM public.lessons_bank
    WHERE user_id IS NOT NULL AND created_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = user_id);

    INSERT INTO public.generation_events (user_id, kind, created_at, source)
    SELECT user_id, 'scenario', created_at, 'backfill'
    FROM public.scenarios_bank
    WHERE user_id IS NOT NULL AND created_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = user_id);

  END IF;
END
$$;
