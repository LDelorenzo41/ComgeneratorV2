# Plan d'action — GRANTs explicites Data API (échéance Supabase du 30/10/2026)

## Contexte

À partir du **30 octobre 2026**, Supabase ne fournira plus de privilèges implicites
aux rôles `anon`, `authenticated` et `service_role` sur le schéma `public`.
Toute table sans `GRANT` explicite deviendra inaccessible via supabase-js /
PostgREST / GraphQL (erreur `42501 — permission denied`).

L'audit du projet a montré :

- ✅ RLS activé sur les 27 tables du schéma `public`, ~67 policies bien scoppées
  (`auth.uid() = user_id` majoritairement) ;
- ✅ fonctions `SECURITY DEFINER` correctement verrouillées
  (`REVOKE ALL FROM PUBLIC` + `GRANT` ciblé) ;
- ❌ **aucun `GRANT` explicite sur les tables** → sans action, l'application
  serait totalement hors service le 30/10/2026 (pas de fuite de données, la
  RLS restant active, mais 100 % des requêtes en erreur).

## Remédiation appliquée

Migration : [`migrations/20260704_grant_data_api_explicit.sql`](migrations/20260704_grant_data_api_explicit.sql)

| Rôle | Privilèges accordés | Justification zéro-régression |
|---|---|---|
| `authenticated` | `SELECT, INSERT, UPDATE, DELETE` sur toutes les tables + `USAGE, SELECT` sur les séquences | Identique aux défauts Supabase actuels ; la RLS reste l'autorité pour chaque ligne. Couvre aussi les tables créées via le dashboard, absentes des migrations. |
| `service_role` | `ALL` sur toutes les tables et séquences | Utilisé par les Edge Functions (34 usages de `SERVICE_ROLE_KEY` recensés), le webhook Stripe et le keep-alive `ping`. |
| `anon` | `INSERT, SELECT` sur `feedback_sessions`, `feedback_ratings`, `feedback_comments` ; `SELECT` sur `deleted_users_blacklist` ; `EXECUTE` sur `unsubscribe_newsletter` et `fetch_rss_articles` | Surface publique réelle vérifiée dans le code : formulaire feedback (`/feedback`, avec `.insert().select()` qui exige SELECT pour le RETURNING), page `/unsubscribe`, policy blacklist ciblant explicitement `anon`. **Aucun autre accès `anon` accordé** — durcissement par rapport aux défauts actuels, sans impact car toutes les autres routes attendent la restauration de session (`AuthLayout`) avant de requêter. |

Points de vigilance respectés :

- Les `REVOKE` délibérés existants ne sont **pas** annulés :
  `match_rag_chunks_exact` reste réservé à `service_role`
  (aucun `GRANT ... ON ALL ROUTINES` global, qui aurait constitué une régression de sécurité).
- Les RPC créées directement en production (`redeem_promo_code`,
  `delete_user_account`, `search_rag_chunks_fts`, `unsubscribe_newsletter`,
  `set_config_param`, `match_rag_chunks_raw`) sont couvertes par des blocs `DO`
  conditionnels : la migration passe même si une fonction est absente
  (environnement local, base reconstruite).
- `ALTER DEFAULT PRIVILEGES` posé pour les **futures** tables/séquences
  (`authenticated` + `service_role` uniquement) : pas de défaut pour `anon`
  ni pour les fonctions, afin de préserver le motif
  `REVOKE ALL FROM PUBLIC + GRANT ciblé` déjà en place.

## Déploiement

1. **Staging / branche de prévisualisation Supabase** :
   `supabase db push` (ou exécution du fichier dans l'éditeur SQL).
2. Dérouler la checklist de tests ci-dessous.
3. **Production** : appliquer la même migration **avant le 30/10/2026**.
4. Si le dashboard Supabase propose le bouton d'activation anticipée du
   nouveau comportement ("Disable default Data API grants"), l'activer en
   staging pour valider en conditions réelles.

## Checklist de tests (non-régression)

Rôle `anon` (déconnecté) :
- [ ] Soumission complète du formulaire `/feedback` (session + ratings + commentaires).
- [ ] Page `/unsubscribe` avec un token valide.
- [ ] Inscription d'un nouvel utilisateur (vérification blacklist + trigger `handle_new_user`).
- [ ] Vérifier qu'un `SELECT` anon sur `profiles`, `transactions`, `rag_documents` est bien refusé.

Rôle `authenticated` :
- [ ] Login, chargement du dashboard (lecture `profiles`, `signatures`).
- [ ] CRUD appreciations, lessons_bank, scenarios_bank, subjects/criteria.
- [ ] Chat RAG complet (upload document, conversation, `match_rag_chunks`).
- [ ] Rédemption d'un code promo (`redeem_promo_code`, lecture `promo_campaigns`).
- [ ] Achat de tokens (Stripe checkout + `verify-payment`).
- [ ] Suppression de compte (`delete_user_account`).

Rôle admin :
- [ ] `/admin/dashboard` (`get_admin_dashboard`).
- [ ] `/admin/newsletter`, `/admin/campaigns`, `/admin/feedback`.

Edge Functions (`service_role`) :
- [ ] `generate`, `rag-chat`, `scenario`, `stripe-webhook`, `send-newsletter`, `fetch-rss`, `ping`.

## Anomalie préexistante détectée (hors périmètre de cette migration)

`src/lib/feedbackApi.ts` fait `.insert().select('id')` en tant que `anon`,
mais aucune policy RLS `SELECT` n'existe pour `anon` sur `feedback_sessions`
(seuls les admins ont un `SELECT`). PostgreSQL exige une policy `SELECT`
pour le `RETURNING` : ce flux est donc susceptible d'échouer **déjà
aujourd'hui**, indépendamment des GRANTs. À tester en priorité ; correctif
possible si le test échoue (décision produit à valider) :

```sql
CREATE POLICY "anon_returning_sessions" ON public.feedback_sessions
  FOR SELECT TO anon USING (false);  -- ou une condition adaptée
```

## Recommandations complémentaires (non bloquantes, non incluses)

1. **RGPD — `deleted_users_blacklist`** : la policy `USING (true)` pour `anon`
   expose la liste des emails supprimés. Remplacer par une fonction
   `SECURITY DEFINER` retournant un booléen, puis retirer le `GRANT SELECT`
   à `anon` sur la table.
2. **Policies `TO public` (~30)** : les remplacer par `TO authenticated`
   (tables `rag_*`, `lessons`, `chatbot_answers`, `scenarios_bank`, logs).
   Sans effet fonctionnel aujourd'hui, mais réduit la surface.
3. **Storage** : aucune policy `storage.objects` versionnée dans les
   migrations. Exporter depuis le dashboard les policies du bucket
   `rag-documents` vers une migration SQL pour traçabilité.
4. **`profiles.is_admin`** : vérifier que la policy `UPDATE` sur `profiles`
   ne permet pas à un utilisateur de modifier lui-même cette colonne.
