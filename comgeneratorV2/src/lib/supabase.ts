import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === 'your_supabase_url_here') {
  throw new Error('Missing or invalid VITE_SUPABASE_URL environment variable. Please set it in your .env file.');
}

if (!supabaseAnonKey || supabaseAnonKey === 'your_supabase_anon_key_here') {
  throw new Error('Missing or invalid VITE_SUPABASE_ANON_KEY environment variable. Please set it in your .env file.');
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(10000), // 10 second timeout
        }).catch((error) => {
          console.error('Fetch error:', error);
          // Re-throw with more specific error message
          if (error.name === 'AbortError') {
            throw new Error('La requête a expiré. Veuillez vérifier votre connexion internet.');
          }
          if (error.message === 'Failed to fetch') {
            throw new Error('Impossible de se connecter au serveur. Veuillez vérifier votre connexion internet et que votre projet Supabase est actif.');
          }
          throw error;
        });
      },
    },
  }
);

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Helper function to test the connection with better error handling
export const testSupabaseConnection = async () => {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase n\'est pas configuré correctement. Vérifiez vos variables d\'environnement.');
    }

    // Test with a simple query that doesn't require authentication
    const { data, error } = await supabase
      .from('subjects')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      
      if (error.message.includes('JWT expired')) {
        throw new Error('La session a expiré. Veuillez vous reconnecter.');
      }
      
      if (error.message.includes('connection refused') || error.code === 'ECONNREFUSED') {
        throw new Error('Impossible de se connecter à Supabase. Le service est peut-être en pause ou indisponible.');
      }
      
      if (error.message.includes('Invalid API key')) {
        throw new Error('Clé API Supabase invalide. Vérifiez votre configuration.');
      }
      
      if (error.message.includes('Project not found')) {
        throw new Error('Projet Supabase introuvable. Vérifiez votre URL Supabase.');
      }
      
      throw error;
    }
    
    console.log('Supabase connection successful');
    return true;
  } catch (error: any) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
};

// Helper function to check if the project is paused
export const checkProjectStatus = async () => {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey || '',
      },
    });
    
    if (response.status === 503) {
      throw new Error('Votre projet Supabase est en pause. Veuillez le réactiver depuis votre tableau de bord Supabase.');
    }
    
    return response.ok;
  } catch (error: any) {
    if (error.message.includes('en pause')) {
      throw error;
    }
    throw new Error('Impossible de vérifier le statut du projet Supabase.');
  }
};