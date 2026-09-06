-- 20260906_drop_feedback_tables.sql
--
-- Purge des données de la campagne de feedback testeurs, terminée.
--
-- Contexte : la surface applicative a été retirée du front (pages, routes,
-- liens, drapeau FEEDBACK_ENABLED). Il ne reste plus aucun code qui lise ou
-- écrive ces tables. Les données subsistantes — nom, adresse e-mail, matière,
-- niveau, ancienneté, intentions d'achat et commentaires libres de testeurs —
-- n'ont donc plus aucune finalité. Le RGPD demande de ne pas les conserver
-- au-delà de ce qui est nécessaire : on les supprime.
--
-- ⚠️ IRRÉVERSIBLE. Si vous souhaitez garder une trace des enseignements de la
-- campagne, exportez AVANT d'exécuter ce script — une fois les tables
-- supprimées, seule une sauvegarde nocturne permettrait de les récupérer.
-- Export possible depuis l'éditeur SQL du dashboard (bouton « Download CSV ») :
--
--     SELECT fs.created_at, fs.matiere, fs.niveau, fs.anciennete,
--            fs.a_achete_tokens, fs.prevoit_acheter, fs.raison_achat,
--            fr.section, fr.question_key, fr.rating,
--            fc.section AS comment_section, fc.comment
--       FROM feedback_sessions fs
--       LEFT JOIN feedback_ratings  fr ON fr.session_id = fs.id
--       LEFT JOIN feedback_comments fc ON fc.session_id = fs.id
--      WHERE fs.completed = true
--      ORDER BY fs.created_at;
--
-- Cette requête omet volontairement tester_name et tester_email : les
-- enseignements de la campagne n'ont pas besoin de l'identité des testeurs.

-- ============================================================================
-- 1. La RPC de récompense, EN PREMIER
-- ============================================================================
-- claim_feedback_reward() vérifie l'existence d'une ligne dans
-- feedback_sessions avant de créditer 30 000 tokens. Supprimer les tables sans
-- retirer d'abord la fonction laisserait une RPC exécutable par tout compte
-- authentifié pointant vers une table absente : elle échouerait à chaque appel
-- au lieu de ne pas exister. On la retire donc avant ses dépendances.
--
-- Aucun crédit n'est perdu : la fonction exigeait un feedback complet, elle
-- était donc déjà sans effet pour quiconque n'avait pas répondu, et
-- profiles.feedback_reward_claimed conserve la trace de qui a été crédité.

DROP FUNCTION IF EXISTS public.claim_feedback_reward();

-- ============================================================================
-- 2. Les trois tables
-- ============================================================================
-- Ordre : les tables filles avant la table mère. Les contraintes de clé
-- étrangère sont en ON DELETE CASCADE, mais l'ordre explicite évite de
-- dépendre d'un CASCADE au niveau du DROP, qui emporterait silencieusement
-- tout objet inconnu qui viendrait à en dépendre.

DROP TABLE IF EXISTS public.feedback_comments;
DROP TABLE IF EXISTS public.feedback_ratings;
DROP TABLE IF EXISTS public.feedback_sessions;

-- ============================================================================
-- 3. Ce qui est volontairement CONSERVÉ
-- ============================================================================
-- profiles.feedback_reward_claimed n'est pas supprimée. Ce booléen est la
-- seule trace comptable des 30 000 tokens versés à certains comptes : la RPC
-- créditait profiles.tokens directement, sans écriture dans credit_ledger.
-- La colonne ne contient aucune donnée personnelle au-delà de ce fait, elle
-- ne coûte rien, et la perdre rendrait un écart de solde inexplicable.
--
-- Pour la supprimer malgré tout, une fois certain de ne plus avoir à
-- justifier ces soldes :
--
--     ALTER TABLE public.profiles DROP COLUMN IF EXISTS feedback_reward_claimed;

-- ============================================================================
-- Vérification attendue après application
-- ============================================================================
--
--     SELECT to_regclass('public.feedback_sessions'),
--            to_regclass('public.feedback_ratings'),
--            to_regclass('public.feedback_comments');
--     -- doit renvoyer trois NULL
--
--     SELECT proname FROM pg_proc WHERE proname = 'claim_feedback_reward';
--     -- doit renvoyer zéro ligne
