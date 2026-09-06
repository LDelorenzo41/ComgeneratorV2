-- 20260906d_rollback_delete_user_account.sql
--
-- 🚨 RETOUR ARRIÈRE — la suppression de compte échoue depuis 20260906b
--
-- À APPLIQUER dans l'éditeur SQL du dashboard Supabase.
--
-- ============================================================================
-- Pourquoi un retour arrière plutôt qu'un correctif
-- ============================================================================
-- La suppression de compte est un droit (RGPD art. 17) et l'interface affiche
-- « Une erreur est survenue lors de la suppression ». Une suppression
-- INCOMPLÈTE vaut mieux qu'une suppression IMPOSSIBLE : on rétablit d'abord la
-- version qui fonctionnait depuis des mois, on diagnostique ensuite.
--
-- Je ne connais pas encore le message d'erreur PostgreSQL exact. Corriger à
-- l'aveugle est précisément ce qui a causé la panne d'inscription ce matin :
-- on ne recommence pas.
--
-- Cette fonction est la définition d'ORIGINE, restituée à l'identique depuis
-- l'extraction faite en production le 06/09/2026 par
-- `SELECT pg_get_functiondef('public.delete_user_account()'::regprocedure)`.
-- Rien n'y est ajouté, rien n'y est retiré.
--
-- ============================================================================
-- Ce que ce retour arrière implique, en toute transparence
-- ============================================================================
-- 1. La suppression redevient INCOMPLÈTE : scenarios_bank, chatbot_answers,
--    rag_documents, rag_chunks, rag_conversations, rag_folders et les fichiers
--    du bucket Storage survivent au compte. C'est l'état antérieur à
--    aujourd'hui, celui dans lequel le service a toujours tourné — mais la
--    politique de confidentialité désormais en ligne promet un effacement
--    complet. Cet écart doit être refermé rapidement, par un correctif
--    diagnostiqué, pas par un nouveau pari.
-- 2. L'INSERT dans deleted_users_blacklist revient : le garde-fou
--    anti-réinscription redevient actif. Effet de bord favorable — la faille
--    des 10 000 tokens regagnés à chaque réinscription se referme.
-- 3. Le `SET search_path` disparaît de nouveau. C'était un durcissement
--    souhaitable, il sera réintroduit avec le correctif diagnostiqué.

CREATE OR REPLACE FUNCTION public.delete_user_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  user_email text;
BEGIN
  -- Récupérer l'email avant suppression
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();

  -- Ajouter à la blacklist
  INSERT INTO deleted_users_blacklist (email) VALUES (user_email)
  ON CONFLICT (email) DO NOTHING;

  -- Supprimer toutes les données
  DELETE FROM transactions WHERE user_id = auth.uid();
  DELETE FROM appreciations WHERE user_id = auth.uid();
  DELETE FROM lessons WHERE user_id = auth.uid();
  DELETE FROM lessons_bank WHERE user_id = auth.uid();
  DELETE FROM signatures WHERE user_id = auth.uid();
  DELETE FROM subjects WHERE user_id = auth.uid();
  DELETE FROM user_rss_preferences WHERE user_id = auth.uid();
  DELETE FROM profiles WHERE user_id = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$function$;

-- ⚠️ DÉPENDANCE À CONNAÎTRE : cet `ON CONFLICT (email)` exige une contrainte
-- d'unicité sur la COLONNE `email`. Le correctif d'urgence 20260906c a recréé
-- la table avec un index unique sur `lower(email)`, ce qui ne satisfait PAS
-- `ON CONFLICT (email)`. La ligne ci-dessous ajoute la contrainte manquante ;
-- sans elle, la suppression de compte échouerait avec
-- « there is no unique or exclusion constraint matching the ON CONFLICT
-- specification ».

CREATE UNIQUE INDEX IF NOT EXISTS deleted_users_blacklist_email_unique
  ON public.deleted_users_blacklist (email);

-- Même prudence sur le NOT NULL : la table d'origine tolérait peut-être un
-- email absent. Mon correctif d'urgence 20260906c a posé un NOT NULL qui n'y
-- était pas forcément. On le relâche pour que la fonction restituée se
-- comporte exactement comme avant.
ALTER TABLE public.deleted_users_blacklist ALTER COLUMN email DROP NOT NULL;

-- ============================================================================
-- VÉRIFICATION IMMÉDIATE
-- ============================================================================
-- Créer un compte jetable, puis le supprimer depuis les réglages.
-- L'opération doit se dérouler sans message d'erreur.
--
-- ============================================================================
-- DIAGNOSTIC — à exécuter et à transmettre, pour le correctif définitif
-- ============================================================================
--
-- 1. Le message d'erreur PostgreSQL exact. Il est visible dans le navigateur :
--    ouvrir les outils de développement (F12) → onglet Réseau → relancer une
--    suppression → cliquer la requête `rpc/delete_user_account` → onglet
--    Réponse. Le corps JSON contient `message`, `details` et `hint`. C'est
--    l'information décisive, tout le reste n'est que conjecture.
--
-- 2. Propriétaire et mode des deux fonctions sensibles — une fonction
--    SECURITY DEFINER s'exécute avec les droits de son PROPRIÉTAIRE, et c'est
--    lui qui doit pouvoir écrire dans storage.objects :
--
--        SELECT p.proname,
--               pg_get_userbyid(p.proowner) AS proprietaire,
--               p.prosecdef                 AS security_definer
--          FROM pg_proc p
--          JOIN pg_namespace n ON n.oid = p.pronamespace
--         WHERE n.nspname = 'public'
--           AND p.proname IN ('delete_user_account', 'handle_new_user');
--
-- 3. Premier suspect — le droit d'écriture sur le Storage, seul schéma
--    nouvellement touché par 20260906b :
--
--        SELECT has_table_privilege('postgres', 'storage.objects', 'DELETE')
--            AS postgres_peut_supprimer_des_fichiers;
--
-- 4. Second suspect — une clé étrangère sans CASCADE vers l'une des tables
--    que 20260906b ajoutait à la suppression. `rag_messages` référence
--    `rag_conversations` : si cette contrainte n'est pas ON DELETE CASCADE,
--    supprimer les conversations d'un utilisateur qui en possède fait
--    échouer toute la fonction.
--
--        SELECT conrelid::regclass  AS table_source,
--               conname,
--               confrelid::regclass AS table_cible,
--               CASE confdeltype WHEN 'c' THEN 'CASCADE'
--                                WHEN 'a' THEN 'NO ACTION'
--                                WHEN 'r' THEN 'RESTRICT'
--                                WHEN 'n' THEN 'SET NULL'
--                                WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
--          FROM pg_constraint
--         WHERE contype = 'f'
--           AND confrelid::regclass::text IN (
--                 'rag_conversations', 'rag_documents', 'rag_folders',
--                 'rag_chunks', 'scenarios_bank', 'chatbot_answers',
--                 'subjects', 'profiles')
--         ORDER BY 3, 1;
