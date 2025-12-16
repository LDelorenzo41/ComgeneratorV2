# Architecture RAG pour ProfAssist

Ce dossier contient l'architecture complète du module RAG (Retrieval-Augmented Generation) pour ProfAssist.

## Vue d'ensemble

Le module RAG permet aux utilisateurs de :
1. **Uploader des documents** (PDF, DOCX, TXT)
2. **Indexer automatiquement** leur contenu (extraction texte, chunking, embeddings)
3. **Interroger leurs documents** via un chatbot intelligent

### Deux modes de chat disponibles :

| Mode | Description |
|------|-------------|
| **Corpus uniquement** | Réponses strictement basées sur les documents. Si l'info n'est pas trouvée → "Je n'ai pas trouvé cette information dans vos documents" |
| **Corpus + IA** | Priorité aux documents, avec compléments IA clairement signalés |

## Structure du dossier

```
rag_architecture/
├── README.md                       # Ce fichier
├── CHECKLIST_INTEGRATION.md        # Guide d'intégration pas à pas
│
├── supabase_sql/                   # Migrations SQL
│   ├── 000_rag_init.sql           # Tables, index, RLS, fonctions
│   └── 001_rag_storage_policies.sql # Policies pour Storage
│
├── supabase/                       # Edge Functions Supabase
│   └── functions/
│       ├── rag-upload-sign/       # Génère URL d'upload signée
│       ├── rag-ingest/            # Pipeline d'ingestion (extraction, chunking, embeddings)
│       └── rag-chat/              # Chat RAG avec double mode
│
└── src/                           # Fichiers frontend React
    ├── lib/
    │   ├── rag.types.ts           # Types TypeScript
    │   └── ragApi.ts              # Service API
    ├── components/
    │   └── chatbot/               # Composants UI
    └── pages/
        └── ChatbotPage.tsx        # Page principale
```

## Architecture technique

### Base de données (Supabase PostgreSQL + pgvector)

```
┌─────────────────────┐     ┌────────────────────┐
│   rag_documents     │────▶│    rag_chunks      │
├─────────────────────┤     ├────────────────────┤
│ id (PK)             │     │ id (PK)            │
│ user_id (FK)        │     │ document_id (FK)   │
│ title               │     │ user_id (FK)       │
│ storage_path        │     │ chunk_index        │
│ mime_type           │     │ content            │
│ status              │     │ content_hash       │
│ chunk_count         │     │ embedding (vector) │
└─────────────────────┘     └────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
┌───────────────────────┐                           ┌───────────────────────┐
│  rag_conversations    │                           │    rag_messages       │
├───────────────────────┤                           ├───────────────────────┤
│ id (PK)               │◀──────────────────────────│ id (PK)               │
│ user_id (FK)          │                           │ conversation_id (FK)  │
│ title                 │                           │ user_id (FK)          │
│ mode                  │                           │ role                  │
│ document_filter_id    │                           │ content               │
└───────────────────────┘                           │ sources (JSONB)       │
                                                    └───────────────────────┘
```

### Pipeline d'ingestion

```
┌──────────┐    ┌───────────────────┐    ┌─────────────────┐
│  Upload  │───▶│  rag-upload-sign  │───▶│ Supabase Storage│
│  (file)  │    │  (signed URL)     │    │ rag-documents   │
└──────────┘    └───────────────────┘    └────────┬────────┘
                                                  │
                                                  ▼
                                         ┌────────────────┐
                                         │  rag-ingest    │
                                         ├────────────────┤
                                         │ 1. Download    │
                                         │ 2. Extract text│
                                         │ 3. Chunk       │
                                         │ 4. Embed (OpenAI)│
                                         │ 5. Store       │
                                         └────────────────┘
```

### Pipeline de chat

```
┌──────────────┐     ┌─────────────────────────────────────────────────┐
│   Question   │────▶│                  rag-chat                       │
│  (message)   │     ├─────────────────────────────────────────────────┤
└──────────────┘     │ 1. Embed question (OpenAI)                      │
                     │ 2. Search chunks (pgvector similarity)          │
                     │ 3. Build prompt (mode-dependent)                │
                     │ 4. Generate answer (OpenAI GPT)                 │
                     │ 5. Return answer + sources                      │
                     └──────────────────────────────┬──────────────────┘
                                                    │
                                                    ▼
                                           ┌────────────────┐
                                           │    Response    │
                                           ├────────────────┤
                                           │ answer         │
                                           │ sources[]      │
                                           │ conversationId │
                                           │ tokensUsed     │
                                           └────────────────┘
```

## Sécurité

### Row Level Security (RLS)

Chaque table a des policies RLS strictes :
- Un utilisateur ne peut voir/modifier que ses propres données
- Isolation complète entre utilisateurs
- Aucune donnée ne peut fuiter

### Storage

- Bucket `rag-documents` privé
- Chemin structuré: `{user_id}/{document_id}/{filename}`
- Policies interdisant l'accès aux fichiers d'autres utilisateurs

### Edge Functions

- Authentification requise (Bearer token)
- Service Role Key utilisé uniquement côté serveur
- Aucune exposition de clés sensibles au client

## Variables d'environnement

### Edge Functions (Supabase Secrets)

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Clé API OpenAI |
| `SUPABASE_URL` | URL du projet (auto) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (auto) |

### Frontend (.env)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL du projet |
| `VITE_SUPABASE_ANON_KEY` | Clé anonyme |

## Modèles OpenAI utilisés

| Usage | Modèle | Dimensions/Max tokens |
|-------|--------|----------------------|
| Embeddings | `text-embedding-3-small` | 1536 dimensions |
| Chat | `gpt-4.1-mini` | 2000 tokens réponse |

## Limites et quotas

| Limite | Valeur |
|--------|--------|
| Taille max fichier | 10 MB |
| Taille chunk cible | ~1000 caractères |
| Overlap chunks | ~150 caractères |
| Top K résultats | 5 (max 10) |
| Seuil similarité | 0.5 |

## Installation

Suivez le fichier `CHECKLIST_INTEGRATION.md` pour l'intégration complète.

## Évolutions possibles

- OCR pour PDF scannés
- Support XLSX, PPTX
- Streaming des réponses
- Partage de conversations
- Quotas par utilisateur
- Analytics d'utilisation
