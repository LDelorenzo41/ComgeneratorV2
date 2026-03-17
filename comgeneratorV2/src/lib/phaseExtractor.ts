// src/lib/phaseExtractor.ts
// Utilitaire pour détecter et extraire le contenu des phases pédagogiques

import React from 'react';

// Pattern pour détecter les h3 de phase (EPS + non-EPS)
export const PHASE_HEADING_PATTERN = /Phase\s+\d|Échauffement|Apprentissage moteur|Situation complexe|Retour au calme/i;

/**
 * Extrait récursivement le texte d'un ReactNode (children de ReactMarkdown)
 */
export function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (!children) return '';

  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('');
  }

  if (React.isValidElement(children)) {
    const props = children.props as { children?: React.ReactNode };
    return extractTextFromChildren(props.children);
  }

  return '';
}

/**
 * Extrait le contenu markdown d'une phase spécifique à partir du markdown complet
 */
export function extractPhaseContent(fullMarkdown: string, phaseHeading: string): string {
  if (!fullMarkdown || !phaseHeading) return '';

  const lines = fullMarkdown.split('\n');
  let startIndex = -1;
  let endIndex = lines.length;

  // Normaliser le heading pour la comparaison
  const normalizedHeading = phaseHeading
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('### ')) continue;

    const lineText = line
      .replace(/^###\s*/, '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (startIndex === -1) {
      // Chercher la correspondance (contient le heading recherché)
      if (lineText.includes(normalizedHeading) || normalizedHeading.includes(lineText)) {
        startIndex = i;
      }
    } else {
      // On a trouvé le début, chercher la fin (prochain h3)
      endIndex = i;
      break;
    }
  }

  if (startIndex === -1) return '';

  return lines.slice(startIndex, endIndex).join('\n').trim();
}
