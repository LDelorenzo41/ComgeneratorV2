# Checklist d'intégration RAG - ProfAssist

Cette checklist détaille toutes les étapes pour intégrer le module RAG dans ProfAssist.
**Ne faites rien automatiquement : copiez et exécutez chaque étape manuellement.**

---

## Prérequis

- [ ] Accès au Dashboard Supabase du projet
- [ ] Supabase CLI installé (`npm install -g supabase`)
- [ ] Clé API OpenAI active avec accès aux modèles embeddings
- [ ] Variables d'environnement configurées

---

## 1. Configuration des Variables d'Environnement

### Variables requises pour les Edge Functions (Supabase Dashboard > Edge Functions > Secrets)

```env
OPENAI_API_KEY=sk-xxxx...         # Votre clé API OpenAI
SUPABASE_URL=https://xxxx.supabase.co  # URL de votre projet (déjà présent)
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Service role key (déjà présent)
```

### Variables frontend (fichier .env ou .env.local)

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 2. Migration SQL (Base de données)

### Étape 2.1 : Exécuter la migration principale

1. Ouvrez le Dashboard Supabase
2. Allez dans **SQL Editor**
3. Créez une nouvelle requête
4. Copiez le contenu du fichier `supabase_sql/000_rag_init.sql`
5. Exécutez la requête
6. Vérifiez les messages de succès dans la console

**Points de vérification :**
- [ ] Extension `vector` activée
- [ ] Table `rag_documents` créée
- [ ] Table `rag_chunks` créée
- [ ] Table `rag_conversations` créée
- [ ] Table `rag_messages` créée
- [ ] Index HNSW créé sur `rag_chunks.embedding`
- [ ] RLS activé sur toutes les tables
- [ ] Fonction `match_rag_chunks` disponible

### Étape 2.2 : Créer le bucket Storage

1. Dans le Dashboard Supabase, allez dans **Storage**
2. Cliquez sur **New bucket**
3. Configurez :
   - Name: `rag-documents`
   - Public bucket: **NON** (décoché)
   - Allowed MIME types: (laisser vide pour tous)
   - File size limit: `10485760` (10 MB)
4. Cliquez **Create bucket**

### Étape 2.3 : Appliquer les policies Storage

1. Retournez dans **SQL Editor**
2. Copiez le contenu du fichier `supabase_sql/001_rag_storage_policies.sql`
3. Exécutez la requête

**Points de vérification :**
- [ ] Bucket `rag-documents` créé
- [ ] Policies Storage appliquées

---

## 3. Déploiement des Edge Functions

### Méthode A : Via Supabase CLI (recommandé)

```bash
# Se connecter au projet
supabase login
supabase link --project-ref <votre-project-ref>

# Déployer les fonctions une par une
supabase functions deploy rag-upload-sign --no-verify-jwt
supabase functions deploy rag-ingest --no-verify-jwt
supabase functions deploy rag-chat --no-verify-jwt
```

### Méthode B : Via le Dashboard

1. Dans le Dashboard Supabase, allez dans **Edge Functions**
2. Pour chaque fonction (`rag-upload-sign`, `rag-ingest`, `rag-chat`) :
   - Cliquez **New function**
   - Nommez la fonction exactement comme indiqué
   - Copiez le contenu du fichier `index.ts` correspondant
   - Déployez

### Configuration des secrets Edge Functions

1. Allez dans **Edge Functions > Secrets**
2. Ajoutez les variables d'environnement :
   - `OPENAI_API_KEY` : votre clé API OpenAI

**Points de vérification :**
- [ ] Function `rag-upload-sign` déployée
- [ ] Function `rag-ingest` déployée
- [ ] Function `rag-chat` déployée
- [ ] Secret `OPENAI_API_KEY` configuré

---

## 4. Intégration Frontend

### Étape 4.1 : Copier les types et services

```bash
# Depuis le dossier rag_architecture, copier vers src/
cp src/lib/rag.types.ts ../comgeneratorV2/src/lib/
cp src/lib/ragApi.ts ../comgeneratorV2/src/lib/
```

### Étape 4.2 : Copier les composants

```bash
# Créer le dossier chatbot
mkdir -p ../comgeneratorV2/src/components/chatbot

# Copier les composants
cp src/components/chatbot/*.tsx ../comgeneratorV2/src/components/chatbot/
cp src/components/chatbot/index.ts ../comgeneratorV2/src/components/chatbot/
```

### Étape 4.3 : Copier la page

```bash
cp src/pages/ChatbotPage.tsx ../comgeneratorV2/src/pages/
```

### Étape 4.4 : Ajouter la route dans App.tsx

Ouvrez `comgeneratorV2/src/App.tsx` et ajoutez :

```tsx
// Import en haut du fichier
import ChatbotPage from './pages/ChatbotPage';

// Dans les routes (à côté des autres routes protégées)
<Route path="/chatbot" element={
  <EmailConfirmationGuard>
    <ChatbotPage />
  </EmailConfirmationGuard>
} />
```

### Étape 4.5 : Ajouter un lien dans la navigation (optionnel)

Dans `Header.tsx`, ajoutez un lien vers `/chatbot` dans le menu :

```tsx
<Link
  to="/chatbot"
  className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
>
  <Bot className="w-5 h-5" />
  Mon Chatbot
</Link>
```

**Points de vérification :**
- [ ] Fichiers types copiés dans `src/lib/`
- [ ] Composants copiés dans `src/components/chatbot/`
- [ ] Page `ChatbotPage.tsx` copiée
- [ ] Route `/chatbot` ajoutée dans `App.tsx`
- [ ] Import de la page ajouté
- [ ] Lien de navigation ajouté (optionnel)

---

## 5. Vérification des dépendances

Assurez-vous que les dépendances suivantes sont présentes dans `package.json` :

```json
{
  "dependencies": {
    "react-markdown": "^8.0.7",
    "lucide-react": "^0.539.0",
    "@supabase/supabase-js": "^2.39.7"
  }
}
```

Si `react-markdown` n'est pas installé :

```bash
npm install react-markdown
```

---

## 6. Tests de validation

### Test 1 : Upload d'un document

1. Accédez à `/chatbot`
2. Allez dans l'onglet "Documents"
3. Uploadez un fichier PDF, DOCX ou TXT
4. Vérifiez que le statut passe à "Prêt"
5. Vérifiez dans Supabase :
   - Table `rag_documents` : entrée créée
   - Table `rag_chunks` : chunks créés
   - Storage `rag-documents` : fichier présent

### Test 2 : Chat en mode "Corpus uniquement"

1. Posez une question sur le contenu du document
2. Vérifiez que la réponse cite le document
3. Posez une question hors sujet
4. Vérifiez la réponse : "Je n'ai pas trouvé cette information..."

### Test 3 : Chat en mode "Corpus + IA"

1. Basculez en mode "Corpus + IA"
2. Posez une question
3. Vérifiez que les compléments IA sont signalés

### Test 4 : Vérification RLS

1. Créez un deuxième compte utilisateur
2. Connectez-vous avec ce compte
3. Vérifiez qu'il ne voit PAS les documents du premier utilisateur

**Points de vérification :**
- [ ] Upload fonctionne
- [ ] Extraction de texte fonctionne
- [ ] Embeddings générés
- [ ] Chat fonctionne en mode corpus_only
- [ ] Chat fonctionne en mode corpus_plus_ai
- [ ] Sources affichées correctement
- [ ] RLS respecté (isolation utilisateurs)

---

## 7. Troubleshooting

### Erreur : "Extension vector not found"

Exécutez dans SQL Editor :
```sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

### Erreur : "Bucket rag-documents not found"

Créez le bucket manuellement dans Storage comme indiqué à l'étape 2.2.

### Erreur : "OPENAI_API_KEY not configured"

1. Allez dans Edge Functions > Secrets
2. Ajoutez `OPENAI_API_KEY` avec votre clé

### Erreur : "401 Unauthorized" sur les Edge Functions

Vérifiez que :
- L'utilisateur est connecté
- Le token JWT est envoyé dans le header Authorization

### Extraction PDF vide

Le PDF peut contenir des images (scan). Options :
1. Convertir le PDF en format texte éditable
2. Utiliser un service OCR externe (Tesseract.js est disponible côté client)

### Documents bloqués en "processing"

1. Vérifiez les logs Edge Functions dans le Dashboard
2. Relancez l'ingestion via le bouton "Retraiter"

---

## 8. Structure des fichiers créés

```
rag_architecture/
├── supabase_sql/
│   ├── 000_rag_init.sql           # Migration principale
│   └── 001_rag_storage_policies.sql # Policies Storage
│
├── supabase/
│   └── functions/
│       ├── rag-upload-sign/
│       │   └── index.ts            # Signature d'upload
│       ├── rag-ingest/
│       │   └── index.ts            # Extraction et embeddings
│       └── rag-chat/
│           └── index.ts            # Chat RAG
│
├── src/
│   ├── lib/
│   │   ├── rag.types.ts           # Types TypeScript
│   │   └── ragApi.ts              # Service API
│   ├── components/
│   │   └── chatbot/
│   │       ├── index.ts           # Exports
│   │       ├── DocumentUploader.tsx
│   │       ├── DocumentList.tsx
│   │       ├── ChatMessage.tsx
│   │       └── ChatInterface.tsx
│   └── pages/
│       └── ChatbotPage.tsx        # Page principale
│
└── CHECKLIST_INTEGRATION.md       # Ce fichier
```

---

## 9. Améliorations futures suggérées

- [ ] Ajout d'OCR pour les PDF scannés
- [ ] Support de formats supplémentaires (XLSX, PPTX)
- [ ] Export des conversations
- [ ] Partage de conversations
- [ ] Quotas d'utilisation
- [ ] Historique des conversations persistant
- [ ] Mode "streaming" pour les réponses
- [ ] Prévisualisation des documents

---

## Contact & Support

En cas de problème, vérifiez :
1. Les logs des Edge Functions (Dashboard > Edge Functions > Logs)
2. Les logs de la base de données (Dashboard > Logs)
3. La console du navigateur pour les erreurs frontend

---

**Bon déploiement !** 🚀
