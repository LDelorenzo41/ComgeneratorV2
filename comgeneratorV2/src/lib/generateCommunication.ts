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

export interface GeneratedCommunication {
  /** Corps du message (sans la ligne Objet) */
  content: string;
  /** Objet extrait de la première ligne « Objet : … » du texte, sinon null */
  objet: string | null;
}

// Sépare la ligne « Objet : … » du corps. Extraction côté client : elle
// fonctionne que l'Edge Function déployée impose ou non la ligne Objet
// (aucun couplage d'ordre de déploiement). Les documents (rapport,
// commission) ne commencent pas par « Objet : » → objet null, texte intact.
// Exportée : réutilisée après une retouche (le texte retouché peut inclure
// une ligne Objet ajustée).
export function splitObjet(raw: string): GeneratedCommunication {
  const match = raw.match(/^\s*objet\s*:\s*(.+)\r?\n+([\s\S]*)$/i);
  if (match && match[2].trim()) {
    return { objet: match[1].trim(), content: match[2].trim() };
  }
  return { objet: null, content: raw };
}

export async function generateCommunication({
  destinataire,
  ton,
  contenu,
  signature
}: Params): Promise<GeneratedCommunication> {
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
      return splitObjet(result.content);
    }

    // --- Repli : débit client historique ---
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("Utilisateur non trouvé");
      return splitObjet(result.content);
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
      return splitObjet(result.content);
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

    return splitObjet(result.content);

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



