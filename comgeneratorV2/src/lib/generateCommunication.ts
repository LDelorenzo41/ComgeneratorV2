// src/lib/generateCommunication.ts - Version sécurisée utilisant Edge Functions
import { secureApi } from './secureApi';
import { supabase } from './supabase';
import { countTokens } from './countTokens';
import { tokenUpdateEvent, TOKEN_UPDATED } from '../components/layout/Header';

// Interface maintenue pour compatibilité avec l'ancien code
interface Params {
  destinataire: string;
  ton: string;
  contenu: string;
  signature?: string | null;
}

export async function generateCommunication({
  destinataire,
  ton,
  contenu,
  signature
}: Params): Promise<string> {
  try {
    // Appel sécurisé via Edge Function avec les paramètres corrects
    const result = await secureApi.generateCommunication({
      destinataire,
      ton,
      contenu,
      signature
    });

    // ✅ LOT 1 : remainingTokens présent = le débit a été fait côté serveur
    // (Edge Function à jour). On notifie seulement l'interface, qui relit le
    // solde. Le bloc ci-dessous n'est conservé qu'en repli, pour rester
    // compatible avec une Edge Function pas encore redéployée.
    if (typeof result.remainingTokens === 'number') {
      tokenUpdateEvent.dispatchEvent(new Event(TOKEN_UPDATED));
      return result.content;
    }

    // --- Repli : débit client historique ---
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("Utilisateur non trouvé");
      return result.content;
    }

    // Calculer les tokens utilisés à partir de la réponse
    const tokensUsed = result.usage?.total_tokens || countTokens(contenu + result.content);

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
    // Clamp à 0 : le solde ne doit jamais devenir négatif
    const newTokens = Math.max(0, currentTokens - tokensUsed);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ tokens: newTokens })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Erreur mise à jour des tokens :', updateError);
    } else {
      // tokenUpdateEvent est le bus écouté par useTokenBalance (un dispatch
      // sur window n'était capté par personne)
      tokenUpdateEvent.dispatchEvent(new Event(TOKEN_UPDATED));
    }

    return result.content;

  } catch (error: any) {
    console.error('Erreur lors de la génération de communication:', error);
    
    if (error.message.includes('Session expirée')) {
      throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
    }
    
    if (error.message.includes('Utilisateur non authentifié')) {
      throw new Error('Vous devez être connecté pour générer des communications.');
    }
    
    throw error;
  }
}



