// src/lib/pdfExtractor.ts
// Extraction de texte PDF côté client avec pdf.js (compatible Vite)
// Version améliorée : gestion tableaux + OCR automatique pour PDFs scannés

import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { createWorker } from 'tesseract.js';

// Configuration du worker pour Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Seuil : si moins de 100 caractères utiles par page, c'est probablement un scan
const MIN_CHARS_PER_PAGE = 100;
// Résolution pour le rendu canvas (DPI)
const OCR_RENDER_SCALE = 2;

interface PositionedText {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PdfConversionResult = {
  file: File;
  wasOCR: boolean;
};

/**
 * Extrait le texte d'un fichier PDF avec meilleure gestion des tableaux
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  console.log(`Extracting text from PDF: ${file.name} (${file.size} bytes)`);

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Extraire le texte avec positions
    const positionedItems: PositionedText[] = [];

    for (const item of textContent.items) {
      if (!('str' in item) || !(item as TextItem).str.trim()) continue;

      const textItem = item as TextItem;
      // transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const x = textItem.transform[4];
      const y = textItem.transform[5];
      const width = textItem.width || 0;
      const height = textItem.height || Math.abs(textItem.transform[3]);

      positionedItems.push({
        str: textItem.str,
        x,
        y,
        width,
        height,
      });
    }

    // Reconstruire le texte en respectant la disposition spatiale
    const pageText = reconstructTextWithLayout(positionedItems);
    textParts.push(pageText);
  }

  const fullText = textParts.join('\n\n--- Page suivante ---\n\n');
  console.log(`Extracted ${fullText.length} characters from ${pdf.numPages} pages`);

  return fullText;
}

/**
 * Reconstruit le texte en utilisant les positions pour préserver la structure
 */
function reconstructTextWithLayout(items: PositionedText[]): string {
  if (items.length === 0) return '';

  // Trier par Y décroissant (haut vers bas) puis par X croissant (gauche à droite)
  const sorted = [...items].sort((a, b) => {
    // Regrouper par ligne (tolérance de 5 points)
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 5) return yDiff;
    return a.x - b.x;
  });

  const lines: string[][] = [];
  let currentLine: PositionedText[] = [];
  let lastY = sorted[0]?.y ?? 0;

  for (const item of sorted) {
    // Nouvelle ligne si Y change significativement (> 5 points)
    if (Math.abs(item.y - lastY) > 5) {
      if (currentLine.length > 0) {
        lines.push(processLine(currentLine));
      }
      currentLine = [];
      lastY = item.y;
    }
    currentLine.push(item);
  }

  // Dernière ligne
  if (currentLine.length > 0) {
    lines.push(processLine(currentLine));
  }

  // Joindre les lignes
  return lines.map(line => line.join(' ')).join('\n');
}

/**
 * Traite une ligne en ajoutant des séparateurs pour les colonnes de tableaux
 */
function processLine(items: PositionedText[]): string[] {
  if (items.length <= 1) {
    return items.map(i => i.str);
  }

  // Trier par X
  const sorted = [...items].sort((a, b) => a.x - b.x);

  const result: string[] = [];
  let lastEndX = sorted[0].x;

  for (const item of sorted) {
    // Si grand espace (> 30 points), probablement une nouvelle colonne de tableau
    const gap = item.x - lastEndX;

    if (gap > 30 && result.length > 0) {
      // Ajouter un séparateur de colonne
      result.push(' | ');
    } else if (gap > 10 && result.length > 0) {
      // Petit espace entre mots
      result.push(' ');
    }

    result.push(item.str);
    lastEndX = item.x + item.width;
  }

  return result;
}

/**
 * Détecte si un PDF est un scan (images) en vérifiant le ratio texte/pages
 */
function isScannedPDF(text: string, numPages: number): boolean {
  // Retirer les séparateurs de pages pour compter le texte utile
  const usefulText = text.replace(/\n*--- Page suivante ---\n*/g, '').trim();
  const charsPerPage = usefulText.length / Math.max(numPages, 1);
  console.log(`[PDF] Chars per page: ${charsPerPage.toFixed(0)} (threshold: ${MIN_CHARS_PER_PAGE})`);
  return charsPerPage < MIN_CHARS_PER_PAGE;
}

/**
 * Extrait le texte d'un PDF scanné via OCR (Tesseract.js)
 */
async function extractTextWithOCR(
  file: File,
  onProgress?: (status: string, progress: number) => void
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  console.log(`[OCR] Starting OCR on ${numPages} pages...`);
  onProgress?.(`OCR : initialisation...`, 0);

  const worker = await createWorker('fra');
  await worker.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?\'"()[]{}/-+=@#&*%€$£_ àâäéèêëïîôöùûüÿçœæÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇŒÆ\n\r\t',
  });

  const textParts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    onProgress?.(`OCR : page ${i}/${numPages}...`, (i - 1) / numPages);
    console.log(`[OCR] Processing page ${i}/${numPages}`);

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });

    // Rendre la page sur un canvas offscreen
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    // OCR sur l'image du canvas
    const { data: { text } } = await worker.recognize(canvas);
    textParts.push(text.trim());

    // Nettoyer le canvas
    canvas.width = 0;
    canvas.height = 0;
  }

  await worker.terminate();

  const fullText = textParts.join('\n\n--- Page suivante ---\n\n');
  console.log(`[OCR] Extracted ${fullText.length} characters from ${numPages} pages`);
  onProgress?.(`OCR terminé`, 1);

  return fullText;
}

/**
 * Convertit un fichier PDF en fichier TXT
 * Détecte automatiquement les PDFs scannés et utilise l'OCR si nécessaire
 */
export async function convertPDFToTextFile(
  pdfFile: File,
  onProgress?: (status: string, progress: number) => void
): Promise<PdfConversionResult> {
  // 1. Tentative d'extraction texte classique
  onProgress?.('Extraction du texte...', 0);
  const text = await extractTextFromPDF(pdfFile);

  // 2. Compter les pages pour détecter un scan
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  // 3. Si c'est un scan, fallback OCR
  if (isScannedPDF(text, numPages)) {
    console.log(`[PDF] Detected scanned PDF (${numPages} pages), switching to OCR...`);
    onProgress?.('PDF scanné détecté, lancement OCR...', 0.1);

    const ocrText = await extractTextWithOCR(pdfFile, onProgress);

    const newName = pdfFile.name.replace(/\.pdf$/i, '.txt');
    const blob = new Blob([ocrText], { type: 'text/plain' });
    return {
      file: new File([blob], newName, { type: 'text/plain' }),
      wasOCR: true,
    };
  }

  // 4. PDF texte natif
  const newName = pdfFile.name.replace(/\.pdf$/i, '.txt');
  const blob = new Blob([text], { type: 'text/plain' });
  return {
    file: new File([blob], newName, { type: 'text/plain' }),
    wasOCR: false,
  };
}

/**
 * Vérifie si le fichier est un PDF
 */
export function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
