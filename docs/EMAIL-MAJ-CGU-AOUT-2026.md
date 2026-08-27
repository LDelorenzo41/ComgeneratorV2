# E-mail « mise à jour des conditions » — brouillon à valider

> **Statut : brouillon, rien n'est envoyé.** Version prête à l'emploi dans
> `docs/email-maj-cgu-aout-2026.html`. Ce document est la référence : version
> texte, points à trancher, garde-fous, checklist d'envoi.

## Pourquoi cet e-mail peut partir vers tous les comptes (~670)

- Les CGU, CGV et la politique de confidentialité ont été **substantiellement
  modifiées le 17 août 2026** : retrait de l'assistant documentaire (chatbot) de
  l'offre, nouveau traitement de données (dictée vocale → audio transmis à
  Mistral AI), non-conservation des communications générées.
- La politique de confidentialité du site **s'engage** à informer les
  utilisateurs par e-mail en cas de modification substantielle. Cet envoi
  honore cet engagement — c'est une **information relative au service**
  (exécution du contrat), pas de la prospection : elle ne dépend donc pas de
  l'opt-in newsletter.
- Ce fondement tient tant que le **contenu reste substantiellement
  informatif**. Les améliorations produit y figurent comme *contexte* (une
  phrase, un lien), jamais comme *objet* du message. Voir les garde-fous plus bas.

## Objet de l'e-mail

- **Option A (recommandée)** : `Rentrée 2026 — ce qui change dans ProfAssist (conditions et données personnelles)`
- **Option B (classique)** : `ProfAssist — mise à jour de nos CGU et de notre politique de confidentialité`

Les deux annoncent exactement le contenu ; A tire l'ouverture vers le haut sans
rien promettre que le message ne tient pas.

## Version texte (référence)

---

Bonjour,

C'est la rentrée, et ProfAssist a continué d'évoluer cet été. Certaines de ces
évolutions touchent au traitement de vos données personnelles : conformément à
notre politique de confidentialité, nous vous en informons directement, même si
vous n'êtes pas abonné à la newsletter.

**La dictée vocale arrive dans l'outil Communication.** Vous pouvez désormais
dicter votre brouillon : il est transcrit, puis le formulaire se pré-remplit
automatiquement. Côté données : votre enregistrement audio transite vers
Mistral AI (société française) le temps de la transcription, puis est
immédiatement supprimé. Nous ne conservons jamais votre voix, et Mistral AI
n'utilise pas ces données pour entraîner ses modèles.

**Vos communications ne sont pas conservées.** Les messages générés par l'outil
Communication n'existent que le temps de votre session : rien n'est stocké sur
nos serveurs, sauf si vous copiez ou exportez vous-même le résultat.

**Le choix du moteur d'IA.** Dans vos Paramètres, vous pouvez choisir
Mistral AI comme moteur de génération, en alternative à OpenAI. Vos demandes
sont alors traitées par cette société française.

**L'assistant documentaire (chatbot) quitte l'offre.** Très peu utilisé, il est
retiré de l'interface. Si vous y aviez déposé des documents, répondez
simplement à cet e-mail : nous vous en renverrons une copie ou les
supprimerons, à votre choix.

Les textes à jour (17 août 2026) : CGU · CGV · Politique de confidentialité
[liens vers profassist.net/legal/…]

**Et aussi.** Ces mises à jour accompagnent l'évolution de l'outil : un
huitième outil, les supports pédagogiques (exercices, QCM, fiches élèves
générés depuis vos séances), a notamment rejoint ProfAssist cet été. Le détail
est sur profassist.net.

**Vos préférences e-mail.** Sans action de votre part, vous ne recevrez que les
informations relatives au service, comme celle-ci. Pour être informé des
prochaines évolutions et recevoir des conseils pédagogiques, vous pouvez
activer la newsletter dans vos Paramètres.

Bonne rentrée à vous,

Lionel
ProfAssist — profassist.net

*Pied de page : Vous recevez cet e-mail car vous disposez d'un compte
ProfAssist. Il s'agit d'une information relative au service, indépendante de
vos préférences newsletter. Pour toute question sur vos données, répondez à cet
e-mail ou écrivez à contact-profassist@teachtech.fr.*

---

## Les formules de relance — et pourquoi elles restent dans le cadre

Le levier de réengagement de ce message n'est pas un appel à revenir, il est
dans la construction :

1. **« C'est la rentrée, et ProfAssist a continué d'évoluer cet été »** — le
   signal le plus fort qu'on puisse envoyer à un compte dormant est que
   l'outil est vivant et maintenu. Une phrase factuelle suffit.
2. **La dictée vocale ouvre le message** — c'est la fonctionnalité la plus
   séduisante *et* c'est précisément le nouveau traitement de données qu'on a
   l'obligation de décrire. Ici, l'information légale et l'annonce produit
   sont la même phrase : c'est le seul endroit où l'on peut « vendre » sans
   sortir du cadre.
3. **Les deux points « données »** (non-conservation, Mistral en option) sont
   des arguments de confiance — pour des enseignants qui manipulent des noms
   d'élèves, c'est un motif de retour plus puissant qu'une liste de features.
4. **« Et aussi »** — l'unique phrase promotionnelle autorisée : contexte,
   un lien, pas d'appel à l'action.
5. **Le paragraphe préférences et son bouton « Gérer mes préférences
   e-mail »** récupèrent des opt-in pour les prochaines vraies newsletters —
   et comme `/settings` exige d'être connecté (`EmailConfirmationGuard`), ce
   bouton ramène de facto l'utilisateur dans l'application, avec une
   justification de service irréprochable. Un bouton « Se connecter à
   ProfAssist » nu ferait basculer le message dans la prospection ; celui-ci
   produit le même effet sans franchir la ligne. C'est l'unique bouton du
   message, et il doit le rester.
6. **Signature humaine + « Bonne rentrée »** — un expéditeur identifié, un
   moment partagé. Gratuit, légitime, efficace.

## Garde-fous — ce que ce message ne doit jamais devenir

- Pas d'appel à revenir (« redécouvrez », « revenez essayer », « profitez-en »),
  pas de bouton « Se connecter » ni de bouton vers un outil de génération, pas
  de mention des crédits ou des packs. L'unique bouton autorisé est « Gérer mes
  préférences e-mail ».
- La section « Et aussi » ne grossit pas : une phrase, un lien. Si l'envie de
  lister les nouveautés vient, c'est la newsletter des 120 opt-in qui les reçoit.
- Ne pas transformer le paragraphe préférences en sollicitation appuyée
  (« abonnez-vous ! ») : une sollicitation de consentement par e-mail est
  elle-même de la prospection (doctrine CNIL).

## Points à trancher avant envoi

- **A. Sort des documents du chatbot** — retenu par défaut : « répondez à cet
  e-mail » (copie ou suppression à la demande). Zéro développement, conforme
  RGPD, proportionné (3 utilisateurs externes depuis le lancement d'après
  `features.ts`). Alternative si vous préférez purger : annoncer une
  suppression à date, au moins 30 jours après l'envoi.
- **B. Date d'envoi** — recommandé : première quinzaine de septembre, une fois
  la rentrée posée (les boîtes académiques débordent la semaine du 1er).
- **C. Objet** — A ou B ci-dessus.

## Envoi retenu : directement via Resend (décision du 27/08/2026)

Ne pas passer par `send-newsletter` : son mode réel filtre en dur sur
`newsletter_subscription = true` et ajoute un pied de page (« vous avez accepté
de recevoir des informations ») qui serait faux ici. Le HTML embarque déjà le
bon pied de page. Points opérationnels de l'envoi manuel :

- **Destinataires** : export depuis l'éditeur SQL du dashboard Supabase —
  `select email from auth.users order by created_at;` — fichier à supprimer
  après l'envoi (données personnelles).
- **Mode d'envoi : transactionnel (API `/emails`, éventuellement par lots),
  jamais un Broadcast/Audience Resend.** Les Broadcasts imposent leur propre
  lien de désinscription et alimentent une liste de suppression : un
  utilisateur qui s'y désinscrirait ne recevrait plus l'annonce obligatoire de
  janvier 2027 (trajectoire, arrêt des ventes). Une information de service ne
  se désinscrit pas ; la seule désinscription proposée reste celle de la
  newsletter, dans les Paramètres.
- **Palier gratuit Resend : ~100 e-mails/jour (3 000/mois), sauf évolution de
  leur grille.** Pour ~670 destinataires : étaler sur environ 7 jours (l'ordre
  `created_at` rend les lots reproductibles), ou payer un seul mois de palier
  supérieur — pas d'abonnement qui traîne.
- **Cadence** : rester sous ~2 requêtes/seconde (la limite que respecte déjà
  `send-newsletter` avec ses 550 ms entre envois).
- **Expéditeur** : `ProfAssist <contact-profassist@teachtech.fr>` (domaine déjà
  vérifié dans Resend). Surveiller la boîte de réception : le message invite à
  répondre (documents du chatbot, questions sur les données).

## Checklist avant envoi

1. Valider les points A/B/C et relire le HTML (`docs/email-maj-cgu-aout-2026.html`).
2. Envoi test à soi-même via Resend, vérification des liens (`/legal/cgu`,
   `/legal/cgv`, `/legal/politique`, `/settings`) et du rendu clair/sombre dans
   un vrai client mail.
3. Envoi réel par lots (voir ci-dessus), puis surveiller les réponses
   (demandes liées aux documents du chatbot) et le taux de plaintes dans
   Resend.
