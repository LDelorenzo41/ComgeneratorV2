// src/lib/api/consent.ts
/**
 * API pour la gestion RGPD des consentements cookies
 * Conforme à l'article 7.1 du RGPD (auditabilité)
 */

import { supabase } from '../supabase';

interface ConsentData {
  necessary: boolean;
  functional: boolean;
}

interface ConsentLogData {
  userId?: string | null;
  sessionId: string;
  consentData: ConsentData;
  consentVersion: string;
  action: 'grant' | 'update' | 'withdraw' | 'expire';
  previousConsentId?: string | null;
  pageUrl?: string;
}

interface ConsentLogResponse {
  success: boolean;
  data?: any;
  error?: any;
}

/**
 * Génère un ID de session unique et persistant
 * Utilisé pour tracer les utilisateurs non-authentifiés
 */
export function getOrCreateSessionId(): string {
  const SESSION_KEY = 'profassist_session_id';
  
  let sessionId: string | null = null;
  
  try {
    sessionId = localStorage.getItem(SESSION_KEY);
  } catch (e) {
    console.warn('localStorage non disponible pour session ID');
  }
  
  if (!sessionId) {
    // Génération ID unique : sess_timestamp_random
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      localStorage.setItem(SESSION_KEY, sessionId);
    } catch (e) {
      console.warn('Impossible de stocker le session ID');
      // Pas grave, on utilisera cet ID en mémoire pour cette session
    }
  }
  
  return sessionId;
}

/**
 * Enregistre un consentement de manière conforme RGPD
 * @returns Promise avec le résultat de l'opération
 */
export async function logConsent(data: ConsentLogData): Promise<ConsentLogResponse> {
  try {
    // Récupération des métadonnées
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const pageUrl = data.pageUrl || (typeof window !== 'undefined' ? window.location.href : 'unknown');

    console.log('📝 Enregistrement du consentement:', {
      action: data.action,
      userId: data.userId || 'anonyme',
      sessionId: data.sessionId,
    });

    // CORRECTION : .insert() attend un TABLEAU d'objets
    const { data: logEntry, error } = await supabase
      .from('consent_logs')
      .insert([
        {
          user_id: data.userId || null,
          session_id: data.sessionId,
          consent_data: data.consentData as any, // Cast en 'any' pour le type Json de Supabase
          consent_version: data.consentVersion,
          action: data.action,
          previous_consent_id: data.previousConsentId || null,
          user_agent: userAgent,
          page_url: pageUrl,
          // Note: ip_address sera capturée côté serveur via une future Edge Function si nécessaire
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur lors du logging du consentement:', error);
      // IMPORTANT : Ne pas bloquer l'utilisateur si le log échoue
      // C'est une opération d'audit, pas critique pour l'UX
      return { success: false, error };
    }

    if (!logEntry) {
      console.error('❌ Aucune donnée retournée après insertion');
      return { success: false, error: 'No data returned' };
    }

    console.log('✅ Consentement enregistré avec succès:', logEntry.id);
    return { success: true, data: logEntry };

  } catch (error) {
    console.error('❌ Exception lors du logging:', error);
    return { success: false, error };
  }
}

/**
 * Récupère l'historique des consentements pour l'utilisateur connecté
 * Utilisé pour la page /legal/consent-history
 */
export async function getUserConsentHistory(
  userId: string,
  limit: number = 50
): Promise<ConsentLogResponse> {
  try {
    const { data, error } = await supabase
      .from('consent_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Erreur récupération historique:', error);
      return { success: false, error };
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ Exception lors de la récupération:', error);
    return { success: false, error };
  }
}

/**
 * Récupère l'historique par session ID (pour utilisateurs non-auth)
 */
export async function getSessionConsentHistory(
  sessionId: string,
  limit: number = 10
): Promise<ConsentLogResponse> {
  try {
    const { data, error } = await supabase
      .from('consent_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Erreur récupération historique session:', error);
      return { success: false, error };
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ Exception lors de la récupération session:', error);
    return { success: false, error };
  }
}

/**
 * Récupère le dernier consentement d'un utilisateur
 * Utile pour vérifier l'état actuel
 */
export async function getLatestConsent(
  userId?: string,
  sessionId?: string
): Promise<ConsentLogResponse> {
  try {
    let query = supabase
      .from('consent_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else {
      return { success: false, error: 'userId ou sessionId requis' };
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('❌ Erreur récupération dernier consentement:', error);
      return { success: false, error };
    }

    return { 
      success: true, 
      data: data
    };

  } catch (error) {
    console.error('❌ Exception lors de la récupération:', error);
    return { success: false, error };
  }
}

/**
 * Enregistre un retrait de consentement
 */
export async function withdrawConsent(
  userId: string,
  sessionId: string,
  consentVersion: string
): Promise<ConsentLogResponse> {
  const withdrawData: ConsentData = {
    necessary: true,
    functional: false,
  };

  return logConsent({
    userId,
    sessionId,
    consentData: withdrawData,
    consentVersion,
    action: 'withdraw',
  });
}

/**
 * Enregistre une expiration automatique de consentement
 */
export async function expireConsent(
  userId: string | null,
  sessionId: string,
  previousConsentData: ConsentData,
  consentVersion: string
): Promise<ConsentLogResponse> {
  return logConsent({
    userId,
    sessionId,
    consentData: previousConsentData,
    consentVersion,
    action: 'expire',
  });
}