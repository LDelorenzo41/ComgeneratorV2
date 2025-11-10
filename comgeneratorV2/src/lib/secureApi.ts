// src/lib/secureApi.ts
import { supabase } from './supabase';

// Types pour les paramètres des différentes fonctions
export interface GenerateAppreciationParams {
  subject: string;
  studentName: string;
  criteria: Array<{
    id: string;
    name: string;
    value: number;
    importance: number;
  }>;
  personalNotes: string;
  minLength: number;
  maxLength: number;
  tone: 'bienveillant' | 'normal' | 'severe';
  addressMode: 'tutoiement' | 'vouvoiement' | 'impersonnel';  // ✅ AJOUT
}

export interface CommunicationParams {
  destinataire: string;
  ton: string;
  contenu: string;
  signature?: string | null;
}

export interface ReplyParams {
  message: string;
  ton: string;
  objectifs: string;
  signature?: string | null;
}

export interface LessonParams {
  subject: string;
  topic: string;
  level: string;
  pedagogy_type: string;  // ← Correspond à l'Edge Function
  duration: string;       // ← En string, pas number
}

// ✅ INTERFACE MISE À JOUR pour SynthesisParams
export interface SynthesisParams {
  extractedText: string;
  maxChars: number;
  tone?: 'neutre' | 'encourageant' | 'analytique';
  outputType?: 'complet' | 'essentiel';
}

// Classe pour gérer les appels sécurisés aux Edge Functions
class SecureApiService {
  private readonly baseUrl: string;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL manquante');
    }
    this.baseUrl = `${supabaseUrl}/functions/v1`;
  }

  private async makeRequest<T>(functionName: string, params: any): Promise<T> {
    try {
      // Récupérer le token d'authentification de l'utilisateur connecté
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Utilisateur non authentifié');
      }

      const response = await fetch(`${this.baseUrl}/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erreur ${functionName}:`, errorText);
        
        if (response.status === 401) {
          throw new Error('Session expirée. Veuillez vous reconnecter.');
        }
        
        if (response.status === 429) {
          throw new Error('Trop de requêtes. Veuillez réessayer dans quelques minutes.');
        }
        
        throw new Error(`Erreur lors de l'appel à ${functionName}: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data as T;
    } catch (error: any) {
      console.error(`Erreur dans makeRequest pour ${functionName}:`, error);
      throw error;
    }
  }

  // Génération d'appréciations (remplace src/lib/api.ts)
  async generateAppreciation(params: GenerateAppreciationParams) {
    return this.makeRequest<{
      detailed: string;
      summary: string;
      usedTokens: number;
    }>('generate', params);
  }

  // Génération de communications (remplace src/lib/generateCommunication.ts)
  async generateCommunication(params: CommunicationParams) {
    return this.makeRequest<{
      content: string;
      usage: any;
    }>('communication', params);
  }

  // Génération de réponses (remplace src/lib/generateReply.ts)
  async generateReply(params: ReplyParams) {
  return this.makeRequest<{
    content: string;
    usage: any;  // ← Correct, comme l'Edge Function le retourne
  }>('reply', params);
}

  // Génération de séances (remplace LessonGeneratorPage.tsx)
  async generateLesson(params: LessonParams) {
  return this.makeRequest<{
    content: string;
    usage: any;  // ← L'Edge Function retourne "usage", pas "usedTokens"
  }>('lessons', params);
}

  // Génération de synthèses (remplace SynthesePage.tsx)
  async generateSynthesis(params: SynthesisParams) {
  return this.makeRequest<{
    content: string;  // au lieu de synthesis
    usage: any;       // au lieu de usedTokens
  }>('synthesis', params);
}
}

// Instance singleton
export const secureApi = new SecureApiService();