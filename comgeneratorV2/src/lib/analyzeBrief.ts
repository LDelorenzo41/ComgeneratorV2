// src/lib/analyzeBrief.ts
// Analyse d'un brouillon de communication via l'Edge Function
// communication-brief : retourne les champs du formulaire pré-remplis.
// Le débit des crédits (coût réel de l'analyse) est effectué côté serveur.

import { secureApi } from './secureApi';
import { tokenUpdateEvent, TOKEN_UPDATED } from '../components/layout/Header';

export interface BriefAnalysis {
  destinataire: string;
  ton: string;
  pointDeVue: 'premiere' | 'troisieme' | null;
  contenu: string;
  /** Informations utiles absentes du brouillon (0 à 4 suggestions) */
  manques: string[];
}

export async function analyzeCommunicationBrief(brouillon: string): Promise<BriefAnalysis> {
  const result = await secureApi.analyzeCommunicationBrief({ brouillon });

  // Le débit a eu lieu côté serveur : on rafraîchit le solde affiché
  if (typeof result.remainingTokens === 'number') {
    tokenUpdateEvent.dispatchEvent(new Event(TOKEN_UPDATED));
  }

  return {
    destinataire: result.destinataire ?? "Parents d'élèves",
    ton: result.ton,
    pointDeVue: result.pointDeVue ?? null,
    contenu: result.contenu,
    manques: Array.isArray(result.manques) ? result.manques : [],
  };
}

export interface ReplyBriefAnalysis {
  ton: string;
  contenu: string;
  /** Points du message reçu non couverts + informations pratiques absentes */
  manques: string[];
}

/**
 * Mode « réponse » : analyse croisée du message reçu et des objectifs de
 * l'enseignant — ton suggéré, objectifs restructurés, et surtout les points
 * du message restés sans réponse.
 */
export async function analyzeReplyBrief(
  messageRecu: string,
  objectifs: string
): Promise<ReplyBriefAnalysis> {
  const result = await secureApi.analyzeCommunicationBrief({
    brouillon: objectifs,
    messageRecu,
  });

  if (typeof result.remainingTokens === 'number') {
    tokenUpdateEvent.dispatchEvent(new Event(TOKEN_UPDATED));
  }

  return {
    ton: result.ton,
    contenu: result.contenu,
    manques: Array.isArray(result.manques) ? result.manques : [],
  };
}
