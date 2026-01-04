// src/lib/promoApi.ts
// API pour la gestion des campagnes promotionnelles et codes promo

import { supabase } from './supabase';
import { Tables, TablesInsert, TablesUpdate } from './database.types';

// Types
export type PromoCampaign = Tables<'promo_campaigns'>;
export type PromoCampaignInsert = TablesInsert<'promo_campaigns'>;
export type PromoCampaignUpdate = TablesUpdate<'promo_campaigns'>;
export type PromoRedemption = Tables<'promo_redemptions'>;

export interface RedeemResult {
  success: boolean;
  tokens_added?: number;
  campaign_description?: string;
  error?: string;
}

export interface CampaignWithStats extends PromoCampaign {
  redemptions_count?: number;
}

// ============================================
// FONCTIONS ADMIN - Gestion des campagnes
// ============================================

/**
 * Récupère toutes les campagnes (admin uniquement)
 */
export async function getAllCampaigns(): Promise<CampaignWithStats[]> {
  const { data, error } = await supabase
    .from('promo_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erreur lors de la récupération des campagnes:', error);
    throw new Error('Impossible de charger les campagnes');
  }

  return data || [];
}

/**
 * Crée une nouvelle campagne (admin uniquement)
 */
export async function createCampaign(campaign: {
  code: string;
  description: string;
  tokens_amount: number;
  max_redemptions: number | null;
  expires_at: string;
}): Promise<PromoCampaign> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Utilisateur non authentifié');
  }

  const { data, error } = await supabase
    .from('promo_campaigns')
    .insert({
      code: campaign.code,
      description: campaign.description,
      tokens_amount: campaign.tokens_amount,
      max_redemptions: campaign.max_redemptions,
      expires_at: campaign.expires_at,
      is_active: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ce code promo existe déjà');
    }
    console.error('Erreur lors de la création de la campagne:', error);
    throw new Error('Impossible de créer la campagne');
  }

  return data;
}

/**
 * Met à jour une campagne existante (admin uniquement)
 */
export async function updateCampaign(
  id: string,
  updates: {
    code?: string;
    description?: string;
    tokens_amount?: number;
    max_redemptions?: number | null;
    expires_at?: string;
    is_active?: boolean;
  }
): Promise<PromoCampaign> {
  const { data, error } = await supabase
    .from('promo_campaigns')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ce code promo existe déjà');
    }
    console.error('Erreur lors de la mise à jour de la campagne:', error);
    throw new Error('Impossible de mettre à jour la campagne');
  }

  return data;
}

/**
 * Supprime une campagne (admin uniquement)
 */
export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('promo_campaigns')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erreur lors de la suppression de la campagne:', error);
    throw new Error('Impossible de supprimer la campagne');
  }
}

/**
 * Active ou désactive une campagne (admin uniquement)
 */
export async function toggleCampaignStatus(id: string, isActive: boolean): Promise<PromoCampaign> {
  return updateCampaign(id, { is_active: isActive });
}

/**
 * Récupère les statistiques d'une campagne (nombre d'utilisations)
 */
export async function getCampaignRedemptions(campaignId: string): Promise<PromoRedemption[]> {
  const { data, error } = await supabase
    .from('promo_redemptions')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('redeemed_at', { ascending: false });

  if (error) {
    console.error('Erreur lors de la récupération des utilisations:', error);
    throw new Error('Impossible de charger les utilisations');
  }

  return data || [];
}

// ============================================
// FONCTIONS UTILISATEUR - Utilisation des codes
// ============================================

/**
 * Utilise un code promo (utilisateur)
 * Appelle la fonction RPC Supabase qui gère tout de manière atomique
 */
export async function redeemPromoCode(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_promo_code', {
    p_code: code,
  });

  if (error) {
    console.error('Erreur lors de l\'utilisation du code promo:', error);
    return {
      success: false,
      error: 'Une erreur est survenue. Veuillez réessayer.',
    };
  }

  // La fonction RPC retourne un objet JSON
  const result = data as {
    success: boolean;
    tokens_added?: number;
    campaign_description?: string;
    error?: string;
  };

  if (result.success) {
    return {
      success: true,
      tokens_added: result.tokens_added,
      campaign_description: result.campaign_description,
    };
  } else {
    return {
      success: false,
      error: result.error || 'Code promo invalide',
    };
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Vérifie si une campagne est expirée
 */
export function isCampaignExpired(campaign: PromoCampaign): boolean {
  return new Date(campaign.expires_at) < new Date();
}

/**
 * Vérifie si une campagne a atteint son quota max
 */
export function isCampaignMaxedOut(campaign: PromoCampaign): boolean {
  if (campaign.max_redemptions === null) return false;
  return campaign.current_redemptions >= campaign.max_redemptions;
}

/**
 * Retourne le statut d'une campagne
 */
export function getCampaignStatus(campaign: PromoCampaign): 'active' | 'expired' | 'maxed' | 'inactive' {
  if (!campaign.is_active) return 'inactive';
  if (isCampaignExpired(campaign)) return 'expired';
  if (isCampaignMaxedOut(campaign)) return 'maxed';
  return 'active';
}

/**
 * Formate une date pour l'affichage
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
