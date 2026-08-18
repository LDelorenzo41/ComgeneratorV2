# ProfAssist — dossier de contexte stratégique

*Établi le 17 août 2026, à l'issue d'un audit complet de l'architecture.
Ce document est la mémoire du projet : il consigne les mesures, les décisions,
leurs justifications, et les hypothèses que les mesures ont invalidées.
À lire avant toute décision d'architecture ; à mettre à jour après chaque
décision structurante.*

---

## 1. L'objectif réel

L'exploitant part en **retraite progressive** de l'Éducation nationale et doit
**fermer sa micro-entreprise début mai 2027**. À cette date :

- plus aucun revenu ne peut être encaissé — contrainte de statut, pas arbitrage commercial ;
- aucun coût récurrent ne doit subsister.

L'objectif n'est donc pas la croissance mais la **survie de l'outil à coût nul**.
Repli assumé si l'exploitation devenait trop lourde : fermeture annoncée avec un
an de préavis.

**Conséquence méthodologique** : toute proposition d'optimisation de croissance,
de monétisation ou de mise à l'échelle est hors sujet. Le seul critère est la
réduction du coût d'exploitation et de la charge de maintenance.

---

## 2. Les mesures de production (17 août 2026)

Toutes issues de requêtes SQL réelles. Ce sont elles qui ont tranché les
décisions, contre plusieurs intuitions de départ.

### Base d'utilisateurs

| Indicateur | Valeur |
|---|---|
| Comptes inscrits | **678** |
| Utilisateurs ayant constitué une banque de séances | **40** |
| …une banque d'appréciations | 20 |
| …une banque de scénarios | 18 |
| Utilisateurs actifs par mois (generation_events) | 2 à 20 |
| Générations sur 12 mois | 346 *(minoré, voir § 3)* |

### Économie

| Indicateur | Valeur |
|---|---|
| Clients payants depuis le lancement | **12** |
| Chiffre d'affaires cumulé | **71 €** (hors 16 transactions de test internes, 68,50 €) |
| Taux de conversion inscription → achat | **1,8 %** |
| Transactions totales / abouties | 34 / 28 |
| Coût IA réel | **de l'ordre de quelques euros par an** |

### Volumes de données — le chiffre qui a tout changé

| Table | Contenus | Utilisateurs | Taille estimée |
|---|---|---|---|
| `lessons_bank` | 169 | 40 | ~2,5 Mo |
| `appreciations` | 83 | 20 | ~0,12 Mo |
| `scenarios_bank` | 54 | 18 | ~1,1 Mo |
| `chatbot_answers` | 8 | 2 | ~0,03 Mo |
| **Banque totale** | **314** | ~40–60 | **~3,7 Mo** |
| Fichiers RAG (bucket) | 76 | 8 | 3,8 Mo |
| `subjects` / `signatures` / `transactions` | 310 / 6 / 34 | — | négligeable |

**L'intégralité des données utilisateurs tient dans moins de 10 Mo**, soit ~75 Ko
par utilisateur installé. Projection à 10 000 utilisateurs du même profil :
~750 Mo, un dixième du quota d'un plan Supabase Pro.

### Chatbot RAG

| Indicateur | Valeur |
|---|---|
| Comptes l'ayant utilisé, depuis toujours | **6**, dont 3 comptes internes |
| Consommation des 3 utilisateurs externes | **8 032 tokens ≈ 0,003 €** |
| Appels sur 7 mois instrumentés | 36, pour 69 656 tokens ≈ 0,02 € |
| Documents personnels déposés | 17, par 8 comptes (5 externes à 1 document) |
| Corpus global (admin) | 58 documents |
| Réponses sauvegardées en banque | 8, **toutes sur des comptes internes** |

---

## 3. Angles morts de mesure — à connaître avant d'exploiter ces chiffres

Deux défauts d'instrumentation faussent les relevés naïfs :

1. **`rag_messages` sous-compte massivement l'usage du chat.** La branche « IA
   seule » de `rag-chat` (utilisateur sans document) retourne *avant* l'étape de
   persistance : ces échanges ne laissent aucune trace. La table ne contenait
   qu'une session de décembre 2025 sur ~112 interactions réelles. **Mesurer
   l'usage du chat via `edge_function_logs`, jamais via `rag_messages`.**

2. **`generation_events` n'est fiable qu'à partir de juillet 2026.** Son backfill
   n'a pas pu reconstituer les synthèses ni les communications, faute de tables
   correspondantes. Les volumes antérieurs sont **minorés**. Seuls juillet et
   août 2026 sont complets — deux mois de vacances scolaires.

---

## 4. Décisions prises

### GO — IA en BYOK

Chaque utilisateur fournira sa propre clé API. C'est l'élément porteur de toute
la stratégie : il supprime le seul coût qui croît avec l'usage.

**Faisabilité exceptionnelle** : l'architecture s'y prêtait déjà sans le savoir.
- Un point de passage client unique : `secureApi.makeRequest()` (9 fonctions IA).
- Un point de passage serveur unique : `resolveAIConfig()`, qui résout endpoint,
  en-tête d'authentification et modèle.
- Un sélecteur de modèle utilisateur **déjà en production** (`aiModelConfig.ts`,
  paramètre `aiModel`), qui a validé le circuit de bout en bout.

Le BYOK est donc un changement de configuration par requête, pas une refonte.
Les prompts — le véritable actif produit — restent côté serveur.

**Architecture retenue : clé côté client, transmise par requête, jamais
persistée côté serveur** (option B des quatre étudiées). Elle réutilise
l'intégralité des Edge Functions, conserve les prompts et les garde-fous côté
serveur, et n'expose ProfAssist à aucune responsabilité de dépositaire. Une
option « clé chiffrée au repos » (Vault Supabase) reste possible plus tard, en
opt-in, pour le confort multi-appareils.

**Préalable non négociable** : ne pas accepter de clés utilisateurs tant que les
`console.log` de réponses IA, le CORS ouvert et la policy d'auto-promotion admin
ne sont pas corrigés (§ 7).

**Mise en garde sur l'argumentaire** : le BYOK ne doit pas être présenté comme un
levier d'adoption. Pour un enseignant non technicien, créer un compte chez un
fournisseur d'IA et générer une clé est vraisemblablement *plus difficile* que de
payer 3,50 € une fois. `BYOK_REQUIRED` doit rester un plafond appliqué aux
utilisateurs installés, **jamais une porte d'entrée**.

### NO-GO — migration du stockage de la Banque

Étudiée sérieusement (Supabase, Google Drive utilisateur, stockage local,
fichier d'export, R2/B2), puis **abandonnée faute d'objet** : 3,7 Mo pour
l'ensemble des banques. Déplacer les données structurées hors de Supabase
économiserait des **centimes par an** au prix d'une réécriture complète des
quatre banques, de la perte de la recherche SQL et de la RLS.

Corollaire : les chantiers « quotas et rétention » et « sauvegarde Google Drive »
sont **reportés sine die**. Seule subsiste la purge des logs et conversations
RAG, pour un motif RGPD et non volumétrique.

### FAIT — export `.profassist`

Le besoin réel derrière la question du stockage n'était pas économique mais celui
de la **propriété et de la portabilité**. Il est couvert par l'export.

Format retenu : **page HTML autonome**. Une extension propriétaire ou un `.json`
n'est associé à aucune application — l'utilisateur se retrouverait devant un
fichier qu'il ne peut pas ouvrir, et la promesse « repartez avec votre travail »
ne serait pas tenue. Le document HTML s'ouvre d'un double-clic dans tout
navigateur, se lit, se cherche, s'imprime en PDF, et embarque les données brutes
dans un bloc `<script type="application/json">` pour permettre une réimportation.

*Import : à faire dans un lot ultérieur (il écrit en base, donc hors fenêtre de gel).*

### FAIT — sauvegarde automatique

Dump nocturne chiffré AES256, conservé 90 jours en artifact GitHub.
Le plan Supabase Pro (276 €/an) a été **écarté comme disproportionné** au regard
de 71 € de chiffre d'affaires cumulé et de volumes 3 ordres de grandeur sous les
limites du plan gratuit.

### EN COURS — chat et RAG réservés à l'admin

Justification : 3 utilisateurs externes, 0,003 € de consommation totale, aucun
usage depuis des mois, et une fonctionnalité destinée à disparaître. Continuer à
l'exposer à la rentrée reviendrait à promettre un service qu'on va retirer.

Neutralisation de la surface utilisateur, **sans suppression de code ni de
données** : le corpus global de 58 documents construit côté admin est un actif à
préserver, et la décision reste réversible.

Gain associé : les trois difficultés majeures du chantier BYOK disparaissent
(cohérence des embeddings, clé Cohere, fonctions à modèles figés). `rag-chat` et
`rag-ingest` sortent du périmètre BYOK et restent en mode managé sur la clé
plateforme, pour un usage d'une seule personne.

---

## 5. Hypothèses invalidées par les mesures

Consignées pour qu'une session future ne les reprenne pas à son compte.

| Hypothèse de départ | Réalité mesurée |
|---|---|
| Le stockage de la Banque est un poste de coût à maîtriser | 3,7 Mo au total — sujet inexistant |
| Un utilisateur pèse 1 à 3 Mo | ~75 Ko — facteur 20 d'écart |
| Un seul utilisateur a jamais utilisé le chat | 6 comptes ; `rag_messages` sous-comptait à cause d'un retour anticipé |
| Le plan Supabase Pro est « l'assurance la moins chère » | 276 €/an contre 71 € de CA cumulé — disproportionné |
| Les acheteurs de l'option Banque à +1 € ont un fondement de remboursement | Ils ont reçu ce qu'ils ont acheté ; le grief est d'équité, pas de non-livraison |
| Arrêter les ventes est urgent (obligations « sans expiration ») | Honorer tous les soldes coûte < 10 € — aucune urgence |
| Le coût IA managé est le problème économique du moment | Quelques euros par an ; le vrai facteur limitant est la conversion (1,8 %) |

**Leçon de méthode** : une requête SQL de trente secondes a écarté plusieurs
semaines de chantier. Mesurer avant de concevoir.

---

## 6. Feuille de route

| Échéance | Jalon |
|---|---|
| août – mi-sept. 2026 | Rentrée. Fenêtre de gel : rien de risqué. Export et sauvegarde livrés. Chat/RAG en admin-only. |
| mi-sept. – déc. 2026 | Lot 0 (hygiène et sécurité, § 7), puis socle BYOK — livré en continu, invisible derrière un drapeau. |
| janvier 2027 | Ouverture du BYOK à tous, **en option** à côté des crédits. Annonce publique de la trajectoire. |
| février 2027 | Observation, accompagnement, aucune contrainte imposée. |
| **1ᵉʳ mars 2027** | **Arrêt de la vente de packs** (annoncé dès janvier). Le remplaçant existe et est éprouvé. |
| **début mai 2027** | **Fermeture de la micro-entreprise.** Clôture Stripe. Les soldes acquis restent utilisables. |
| ensuite | ProfAssist gratuit, ~12 €/an. |

### Extinction du mode managé : elle est automatique

Le système refuse déjà une génération lorsque le solde atteint zéro. Une fois les
ventes arrêtées et les dotations suspendues, le mode managé disparaît **de
lui-même**, compte par compte — sans date couperet ni utilisateur interrompu.

Règle énoncée aux utilisateurs : *« votre solde reste utilisable jusqu'à
épuisement ; au-delà, votre clé personnelle prend le relais »*. Coût total
inférieur à 10 €.

### Reste-à-charge visé

| Poste | Coût annuel |
|---|---|
| Supabase, Netlify, Resend, GitHub | 0 € (paliers gratuits, marge de 3 ordres de grandeur) |
| IA | 0 € (BYOK) |
| Nom de domaine | ~12 € |

---

## 7. Dette technique et risques identifiés

### À corriger avant d'accepter des clés API d'utilisateurs (lot 0)

| Gravité | Constat | Localisation |
|---|---|---|
| Haute | Réponses IA complètes (noms d'élèves) écrites dans les logs | `generate:623`, `synthesis:338` |
| Haute | Policy UPDATE de `profiles` sans restriction de colonne → auto-promotion admin possible, donc création de codes promo | snapshot RLS `20260302` |
| Haute | `rag-chat` : ni contrôle de solde ni rate-limit avant 5 appels fournisseur | `rag-chat/index.ts` |
| Moyenne | `deleted_users_blacklist` lisible par `anon` : e-mails de comptes supprimés exposés | policies |
| Moyenne | CORS `*` codé en dur dans 7+ fonctions alors que le helper `ALLOWED_ORIGINS` existe | plusieurs Edge Functions |
| Moyenne | `create-checkout-session` : `userId` pris du body sans vérification du JWT | `create-checkout-session:45-63` |

*Correctif recommandé pour l'auto-promotion : un **trigger additif** calqué sur
`trg_block_client_token_increase` (motif éprouvé, réversible d'un `DROP TRIGGER`),
plutôt qu'une réécriture de policy risquant de bloquer les mises à jour légitimes.*

### Incohérences produit

- **`has_bank_access`** : le trigger d'inscription l'accorde à **tous** les
  nouveaux comptes, alors que l'option est vendue +1 €. Et `verify-payment` la
  **révoque** à l'achat d'un pack sans option — un client qui paie perd donc une
  fonction qu'il utilisait. Le verrou n'existe qu'à l'écriture, uniquement côté
  client, et aucune policy RLS ne le vérifie.
- **Dotation d'inscription** : 10 000 crédits ≈ *un* scénario, ou deux séances.
  Hypothèse la plus probable pour expliquer 1,8 % de conversion. Trois chiffres
  contradictoires circulent (10 000 en base, 20 000 dans le JSON-LD, 30 000 sur
  la page d'accueil).
- **Doublon `lessons` / `lessons_bank`** : même contenu stocké deux fois.

### Gouvernance du schéma

- 18 tables sur 29 et 6 fonctions RPC créées hors migrations (dashboard).
- **L'index vectoriel HNSW n'est versionné nulle part** : une reconstruction
  depuis le dépôt donnerait un RAG en scan séquentiel.
- Policies Storage non versionnées.
- Trous de cascade à la suppression de compte ; le nettoyage repose sur la RPC
  `delete_user_account()`, absente du dépôt donc non auditable.
- `rag_messages.user_id` n'est jamais renseigné → lignes orphelines, impossibles
  à purger par utilisateur.
- Un job `pg_cron` « refresh-articles » n'a probablement jamais été désinscrit.

### RGPD — points à faire valider

- Conversations RAG conservées indéfiniment, sans interface de consultation ni
  d'effacement. **Le point le plus urgent.**
- Qualification du flux BYOK (qui est responsable de traitement) et mention en CGU.
- Sort des soldes prépayés à la fermeture de la micro-entreprise.
- Statut du service une fois mis à disposition gratuitement par un particulier.
- Rétention de `consent_logs` et `edge_function_logs`.

*Aucune conclusion juridique n'est formulée ici : ces points relèvent d'un
expert-comptable et, le cas échéant, d'un conseil juridique.*

---

## 8. Questions ouvertes

1. **Dotation d'essai après mai 2027** : la maintenir coûte ~7 €/an et préserve
   le parcours « essayer avant de configurer une clé » ; la supprimer impose une
   clé API dès la première visite. *Recommandation : la maintenir.*
2. **Relever la dotation d'inscription** de 10 000 à 50 000 crédits ? Coût
   ~0,04 € par inscription. Hypothèse la moins chère à tester sur la conversion.
3. **Utilisateurs pénalisés par `has_bank_access`** : requête à passer pour
   identifier ceux qui ont du contenu en banque et l'accès révoqué.
4. **Transmission en logiciel libre** : le dépôt est déjà sous licence MIT. Le
   publier avec une documentation d'auto-hébergement préserverait le travail sans
   créer d'obligation. Voie de sortie à coût nul, préparable à tout moment.

---

## 9. Requêtes de référence

```sql
-- Photo de la Banque : à rejouer après toute intervention, les quatre nombres
-- doivent être stables ou croissants (référence du 17/08 : 83 / 169 / 54 / 8)
select 'appreciations'   as table_, count(*) as lignes, count(distinct user_id) as users from appreciations
union all select 'lessons_bank',    count(*), count(distinct user_id) from lessons_bank
union all select 'scenarios_bank',  count(*), count(distinct user_id) from scenarios_bank
union all select 'chatbot_answers', count(*), count(distinct user_id) from chatbot_answers;

-- Engagement total en crédits prépayés, converti en coût fournisseur réel
select count(*) as comptes, sum(tokens) as credits_en_circulation,
       round(sum(tokens) * 0.88 / 1000000.0, 2) as cout_max_usd_si_tout_consomme
from profiles;

-- Taille réelle par table (la seule mesure qui tranche un débat de volumétrie)
select relname, pg_size_pretty(pg_total_relation_size(c.oid)) as total
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc;

-- Usage réel du chat : via edge_function_logs, JAMAIS via rag_messages (§ 3)
select date_trunc('month', created_at)::date as mois, count(*) as appels, sum(tokens_used) as tokens
from edge_function_logs where function_name = 'rag-chat' group by 1 order by 1;
```
