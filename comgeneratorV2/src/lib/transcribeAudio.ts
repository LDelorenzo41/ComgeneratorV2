// src/lib/transcribeAudio.ts
// Appel de l'Edge Function transcribe (dictée vocale via Mistral Voxtral).
// Envoi en multipart (hors secureApi, qui ne gère que le JSON), avec la même
// convention d'erreurs : réponses JSON { error } remontées telles quelles.

import { supabase } from './supabase';
import { tokenUpdateEvent, TOKEN_UPDATED } from '../components/layout/Header';

/** Extension de fichier attendue par Mistral selon le type MIME enregistré */
function fileExtensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

/**
 * Transcrit un enregistrement audio et retourne le texte.
 * Le débit des crédits est effectué côté serveur (1 000 crédits par minute
 * entamée) ; le solde affiché est rafraîchi via tokenUpdateEvent.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  durationSeconds: number,
  mimeType: string
): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Configuration manquante (VITE_SUPABASE_URL).');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Vous devez être connecté pour utiliser la dictée.');
  }

  const form = new FormData();
  form.append('file', audioBlob, `dictee.${fileExtensionFor(mimeType)}`);
  form.append('durationSeconds', String(Math.max(1, Math.round(durationSeconds))));
  form.append('language', 'fr');

  const response = await fetch(`${supabaseUrl}/functions/v1/transcribe`, {
    method: 'POST',
    // Pas de Content-Type manuel : le navigateur pose le boundary multipart
    headers: { 'Authorization': `Bearer ${session.access_token}` },
    body: form,
  });

  const raw = await response.text();
  let data: { text?: string; error?: string; remainingTokens?: number } | null = null;
  try {
    data = JSON.parse(raw);
  } catch {
    // Réponse non JSON : message générique ci-dessous
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }
    throw new Error(data?.error || `Erreur du service de transcription (${response.status}).`);
  }

  if (!data?.text) {
    throw new Error('Transcription vide. Veuillez réessayer.');
  }

  // Le débit a eu lieu côté serveur : on rafraîchit le solde affiché
  if (typeof data.remainingTokens === 'number') {
    tokenUpdateEvent.dispatchEvent(new Event(TOKEN_UPDATED));
  }

  return data.text;
}
