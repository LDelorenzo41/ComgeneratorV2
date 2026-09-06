-- _sonde_delete_user_account.sql
--
-- OUTIL DE DIAGNOSTIC — n'est pas une migration (préfixe `_`).
--
-- Objectif : savoir QUELLE étape de la version 20260906b faisait échouer la
-- suppression de compte. Le retour arrière ayant rétabli la fonction d'origine,
-- l'erreur n'est plus reproductible par l'interface : on la provoque ici, dans
-- un cadre maîtrisé, et on la capture étape par étape au lieu de s'arrêter à
-- la première.

-- ############################################################################
-- ÉTAPE 1 — Trois questions en lecture seule. Aucun risque, à lancer d'abord.
--           Elles suffiront peut-être à trancher.
-- ############################################################################

-- 1.a Sous quelle identité s'exécutent les fonctions SECURITY DEFINER.
--     C'est le propriétaire, pas l'appelant, dont les droits comptent.
SELECT p.proname                        AS fonction,
       pg_get_userbyid(p.proowner)      AS proprietaire,
       p.prosecdef                      AS security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('delete_user_account', 'handle_new_user');

-- 1.b PREMIER SUSPECT — le Storage était le seul schéma que ma version
--     touchait pour la première fois. Remplacer <PROPRIETAIRE> par la valeur
--     renvoyée en 1.a.
SELECT has_table_privilege('<PROPRIETAIRE>', 'storage.objects', 'DELETE')
         AS peut_supprimer_des_fichiers,
       has_table_privilege('<PROPRIETAIRE>', 'storage.objects', 'SELECT')
         AS peut_lire_le_storage;

-- 1.c SECOND SUSPECT — une clé étrangère sans CASCADE vers l'une des tables
--     que ma version ajoutait à la suppression. Toute ligne « NO ACTION » ou
--     « RESTRICT » est un candidat sérieux.
SELECT conrelid::regclass  AS table_source,
       conname             AS contrainte,
       confrelid::regclass AS table_cible,
       CASE confdeltype WHEN 'c' THEN 'CASCADE'
                        WHEN 'a' THEN 'NO ACTION'
                        WHEN 'r' THEN 'RESTRICT'
                        WHEN 'n' THEN 'SET NULL'
                        WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
  FROM pg_constraint
 WHERE contype = 'f'
   AND confrelid::regclass::text IN (
         'rag_conversations', 'rag_documents', 'rag_folders', 'rag_chunks',
         'scenarios_bank', 'chatbot_answers', 'subjects', 'profiles')
 ORDER BY 3, 1;

-- ############################################################################
-- ÉTAPE 2 — La sonde. À ne lancer que sur un COMPTE JETABLE.
-- ############################################################################
--
-- ⚠️ CETTE SONDE SUPPRIME RÉELLEMENT LES DONNÉES DU COMPTE VISÉ.
--    Elle reproduit fidèlement l'enchaînement de ma version, sans annulation :
--    c'est le seul moyen d'être fidèle, car les suppressions y sont
--    cumulatives — une table parente ne peut partir qu'une fois ses filles
--    parties. Une sonde qui annulerait chaque étape signalerait des échecs
--    imaginaires.
--
--    NE JAMAIS lui passer l'identifiant de votre compte, ni celui d'un
--    utilisateur réel.
--
-- MODE D'EMPLOI
--   1. Créer un compte jetable depuis l'application.
--   2. Avec ce compte : créer une matière, générer et ENREGISTRER une
--      appréciation, puis enregistrer un scénario en banque. Cela garantit
--      que les tables concernées contiennent bien quelque chose à supprimer —
--      une table vide ne révélerait ni violation de clé étrangère, ni rien.
--   3. Récupérer son identifiant :
--          SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
--   4. Exécuter le bloc ci-dessous, puis lancer la sonde avec cet identifiant.
--   5. M'envoyer le tableau renvoyé, tel quel.

CREATE OR REPLACE FUNCTION public.probe_delete_user_account(p_uid uuid)
RETURNS TABLE(ordre int, etape text, resultat text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $probe$
DECLARE
  v_table text;
  v_n     int := 0;
  -- Exactement la liste et l'ordre de 20260906b.
  v_tables constant text[] := ARRAY[
    'rag_chunks', 'rag_conversations', 'rag_documents', 'rag_folders',
    'chatbot_answers', 'scenarios_bank', 'lessons_bank', 'lessons',
    'appreciations', 'signatures', 'subjects', 'user_rss_preferences',
    'transactions', 'profiles'
  ];
BEGIN
  IF p_uid IS NULL THEN
    ordre := 0; etape := 'paramètre';
    resultat := 'ERREUR — fournir l''identifiant d''un compte jetable';
    RETURN NEXT; RETURN;
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    v_n := v_n + 1;
    ordre := v_n; etape := v_table;

    IF to_regclass('public.' || quote_ident(v_table)) IS NULL THEN
      resultat := 'ignorée — table absente';
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = v_table
         AND column_name = 'user_id'
    ) THEN
      resultat := 'ignorée — pas de colonne user_id';
    ELSE
      -- Le sous-bloc EXCEPTION isole l'étape : un échec est capturé et
      -- annulé, la sonde continue et dresse le tableau complet au lieu de
      -- s'arrêter au premier obstacle.
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_table)
          USING p_uid;
        resultat := 'OK';
      EXCEPTION WHEN OTHERS THEN
        resultat := '❌ ÉCHEC [' || SQLSTATE || '] ' || SQLERRM;
      END;
    END IF;
    RETURN NEXT;
  END LOOP;

  -- Premier suspect : le Storage.
  v_n := v_n + 1; ordre := v_n; etape := 'storage.objects (bucket rag-documents)';
  BEGIN
    DELETE FROM storage.objects
     WHERE bucket_id = 'rag-documents'
       AND name LIKE p_uid::text || '/%';
    resultat := 'OK';
  EXCEPTION WHEN OTHERS THEN
    resultat := '❌ ÉCHEC [' || SQLSTATE || '] ' || SQLERRM;
  END;
  RETURN NEXT;

  -- Dernière étape : le compte lui-même.
  v_n := v_n + 1; ordre := v_n; etape := 'auth.users';
  BEGIN
    DELETE FROM auth.users WHERE id = p_uid;
    resultat := 'OK';
  EXCEPTION WHEN OTHERS THEN
    resultat := '❌ ÉCHEC [' || SQLSTATE || '] ' || SQLERRM;
  END;
  RETURN NEXT;

  RETURN;
END;
$probe$;

-- Lancer la sonde — REMPLACER l'identifiant par celui du compte jetable :
--
--     SELECT * FROM public.probe_delete_user_account('00000000-0000-0000-0000-000000000000')
--      ORDER BY ordre;

-- ############################################################################
-- ÉTAPE 3 — Ménage. À exécuter une fois le tableau récupéré.
-- ############################################################################
--
--     DROP FUNCTION IF EXISTS public.probe_delete_user_account(uuid);
