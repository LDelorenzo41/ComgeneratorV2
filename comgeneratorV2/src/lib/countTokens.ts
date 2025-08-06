// src/lib/countTokens.ts
import { encoding_for_model } from '@dqbd/tiktoken';

/**
 * Compte les tokens d'un texte en utilisant l'encodage d'un modèle compatible tiktoken.
 * Utilise 'gpt‑4‑1106‑preview' pour une compatibilité maximale.
 * Le coût réel sera toujours lié au modèle utilisé pour l'API (ex. gpt‑4.1‑mini).
 */
export function countTokens(text: string): number {
  const encoder = encoding_for_model('gpt-4-1106-preview');
  const tokens = encoder.encode(text);
  encoder.free();
  return tokens.length;
}



