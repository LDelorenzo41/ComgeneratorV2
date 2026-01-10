// src/lib/secureApi.ts
import { supabase } from './supabase';
import { getAIModelChoice, AIModelChoice } from './aiModelConfig';

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
  addressMode: 'tutoiement' | 'vouvoiement' | 'impersonnel';
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
  pedagogy_type: string;
  duration: string;
  documentContext?: string;
}

export interface SynthesisParams {
  extractedText: string;
  maxChars: number;
  tone?: 'neutre' | 'encourageant' | 'analytique';
  outputType?: 'complet' | 'essentiel';
}

// ✅ NOUVELLE INTERFACE - Scénario pédagogique
export interface ScenarioParams {
  matiere: string;
  niveau: string;
  theme: string;
  pointDepart?: string;
  attendus: string;
  nombreSeances: number;
  dureeSeance: number;
  useRag: boolean;
  documentsContent?: string;
  documentNames?: string[];
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

      // ✅ AJOUT : Récupérer le choix de modèle IA et l'ajouter aux paramètres
      const aiModel: AIModelChoice = getAIModelChoice();
      const enrichedParams = {
        ...params,
        // N'ajouter aiModel que si ce n'est pas "default" (pour ne pas polluer les requêtes)
        ...(aiModel !== 'default' && { aiModel }),
      };

      const response = await fetch(`${this.baseUrl}/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(enrichedParams),
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

  // Génération d'appréciations
  async generateAppreciation(params: GenerateAppreciationParams) {
    return this.makeRequest<{
      detailed: string;
      summary: string;
      usedTokens: number;
    }>('generate', params);
  }

  // Génération de communications
  async generateCommunication(params: CommunicationParams) {
    return this.makeRequest<{
      content: string;
      usage: any;
    }>('communication', params);
  }

  // Génération de réponses
  async generateReply(params: ReplyParams) {
    return this.makeRequest<{
      content: string;
      usage: any;
    }>('reply', params);
  }

  // Génération de séances
  async generateLesson(params: LessonParams) {
    return this.makeRequest<{
      content: string;
      usage: any;
    }>('lessons', params);
  }

  // Génération de synthèses
  async generateSynthesis(params: SynthesisParams) {
    return this.makeRequest<{
      content: string;
      usage: any;
    }>('synthesis', params);
  }

  // ✅ NOUVELLE MÉTHODE - Génération de scénarios pédagogiques
  async generateScenario(params: ScenarioParams) {
    return this.makeRequest<{
      content: string;
      usage: any;
      sources?: Array<{
        document_name: string;
        chunk_content: string;
        similarity: number;
      }>;
    }>('scenario', params);
  }
}

// Instance singleton
export const secureApi = new SecureApiService();

