// src/lib/generateReply.ts - Version sécurisée utilisant Edge Functions
import { secureApi, type ReplyParams } from './secureApi';
import { supabase } from './supabase';
import { countTokens } from './countTokens';
import { TOKEN_UPDATED } from '../components/layout/Header';

// Interface maintenue pour compatibilité
interface Params {
  message: string;
  ton: string;
  objectifs: string;
  signature?: string | null;
}

export async function generateReply({ 
  message, 
  ton, 
  objectifs, 
  signature
}: Params): Promise<string> {
  
  try {
    // Appel sécurisé via Edge Function
    const result = await secureApi.generateReply({
      message,
      ton,
      objectifs,
      signature
    });

    // Conservation de la logique de gestion des tokens
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("Utilisateur non trouvé");
      return result.content;
    }

    // Calculer les tokens utilisés à partir de la réponse
    const tokensUsed = result.usage?.total_tokens || countTokens(message + objectifs + result.content);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Erreur récupération profil :', profileError);
      return result.content;
    }

    const currentTokens = profile.tokens ?? 0;
    const newTokens = currentTokens - tokensUsed;

    console.log("Token actuels :", currentTokens);
    console.log("Tokens utilisés :", tokensUsed);
    console.log("Tokens restants :", newTokens);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ tokens: newTokens })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Erreur mise à jour des tokens :', updateError);
    } else {
      window.dispatchEvent(new Event(TOKEN_UPDATED));
    }

    return result.content;

  } catch (error: any) {
    console.error('Erreur lors de la génération de réponse:', error);
    
    if (error.message.includes('Session expirée')) {
      throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
    }
    
    if (error.message.includes('Utilisateur non authentifié')) {
      throw new Error('Vous devez être connecté pour générer des réponses.');
    }
    
    throw error;
  }
}



