// src/lib/reviseCommunication.ts
// Retouche en un clic d'un message généré via l'Edge Function
// communication-revise. Le type de retouche est une clé fermée, validée
// côté serveur. Débit du coût réel côté serveur.

import { secureApi, type ReviseParams } from './secureApi';
import { tokenUpdateEvent, TOKEN_UPDATED } from '../components/layout/Header';

export type RevisionKind = ReviseParams['kind'];

export const REVISION_LABELS: Record<RevisionKind, string> = {
  shorter: 'Plus court',
  warmer: 'Plus chaleureux',
  firmer: 'Plus ferme',
};

export async function reviseCommunication(texte: string, kind: RevisionKind): Promise<string> {
  const result = await secureApi.reviseCommunication({ texte, kind });

  // Le débit a eu lieu côté serveur : on rafraîchit le solde affiché
  if (typeof result.remainingTokens === 'number') {
    tokenUpdateEvent.dispatchEvent(new Event(TOKEN_UPDATED));
  }

  return result.content;
}
