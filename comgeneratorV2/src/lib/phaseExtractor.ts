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
 * Normalise un texte pour la comparaison : supprime emojis, markdown bold, espaces multiples
 */
function normalizeText(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Extrait un identifiant unique de phase (ex: "phase 1", "échauffement")
 */
function extractPhaseId(text: string): string | null {
  const normalized = normalizeText(text);
  // Match "phase X" where X is a digit
  const phaseMatch = normalized.match(/phase\s+(\d+)/);
  if (phaseMatch) return `phase ${phaseMatch[1]}`;
  // Match EPS-specific keywords
  if (normalized.includes('échauffement')) return 'échauffement';
  if (normalized.includes('apprentissage moteur')) return 'apprentissage moteur';
  if (normalized.includes('situation complexe')) return 'situation complexe';
  if (normalized.includes('retour au calme')) return 'retour au calme';
  return null;
}

/**
 * Extrait le contenu markdown d'une phase spécifique à partir du markdown complet.
 * Utilise le numéro de phase (ou mot-clé EPS) comme identifiant unique.
 */
export function extractPhaseContent(fullMarkdown: string, phaseHeading: string): string {
  if (!fullMarkdown || !phaseHeading) return '';

  const targetPhaseId = extractPhaseId(phaseHeading);
  if (!targetPhaseId) return '';

  const lines = fullMarkdown.split('\n');
  let startIndex = -1;
  let endIndex = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('### ')) continue;

    const linePhaseId = extractPhaseId(line);
    if (!linePhaseId) continue;

    if (startIndex === -1) {
      if (linePhaseId === targetPhaseId) {
        startIndex = i;
      }
    } else {
      // On a trouvé le début, le prochain h3 de phase marque la fin
      endIndex = i;
      break;
    }
  }

  if (startIndex === -1) return '';

  return lines.slice(startIndex, endIndex).join('\n').trim();
}

/**
 * Normalise les délimiteurs LaTeX pour compatibilité avec rehype-katex.
 * Convertit tous les formats LaTeX en HTML avec classes math que rehype-katex traite directement.
 * Cela évite d'utiliser remark-math (qui a un bug mathFlowInside).
 */
export function normalizeLatexDelimiters(text: string): string {
  return text
    // Display math: \[...\] → <div class="math math-display">...</div>
    .replace(/\\\[(.+?)\\\]/gs, (_match, expr) => `<div class="math math-display">${expr.trim()}</div>`)
    // Display math: $$...$$ (multiline) → <div class="math math-display">...</div>
    .replace(/\$\$(.+?)\$\$/gs, (_match, expr) => `<div class="math math-display">${expr.trim()}</div>`)
    // Inline math: \(...\) → <span class="math math-inline">...</span>
    .replace(/\\\((.+?)\\\)/g, (_match, expr) => `<span class="math math-inline">${expr.trim()}</span>`)
    // Inline math: $...$ (single line, not $$) → <span class="math math-inline">...</span>
    .replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_match, expr) => `<span class="math math-inline">${expr.trim()}</span>`);
}

/**
 * Convertit le markdown inline (bold, italic, code) en HTML
 */
function convertInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

/**
 * Convertit les tableaux markdown en HTML pour un meilleur rendu avec ReactMarkdown + rehypeRaw
 */
export function convertMarkdownTablesToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inTable = false;
  let tableLines: string[] = [];

  const processTable = (tLines: string[]): string => {
    if (tLines.length < 2) return tLines.join('\n');

    const headerLine = tLines[0];
    const dataLines = tLines.slice(2); // Skip separator line

    const parseRow = (line: string): string[] => {
      return line.slice(1, -1).split('|').map(cell => cell.trim());
    };

    const headers = parseRow(headerLine);

    let html = '<table class="markdown-table"><thead><tr>';
    headers.forEach(h => { html += `<th>${convertInlineMarkdown(h)}</th>`; });
    html += '</tr></thead><tbody>';

    dataLines.forEach(line => {
      if (line.trim()) {
        const cells = parseRow(line);
        html += '<tr>';
        cells.forEach(c => { html += `<td>${convertInlineMarkdown(c)}</td>`; });
        html += '</tr>';
      }
    });

    html += '</tbody></table>';
    return html;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableLines = [];
      }
      tableLines.push(trimmed);
    } else {
      if (inTable) {
        result.push(processTable(tableLines));
        inTable = false;
        tableLines = [];
      }
      result.push(line);
    }
  });

  if (inTable && tableLines.length > 0) {
    result.push(processTable(tableLines));
  }

  return result.join('\n');
}
