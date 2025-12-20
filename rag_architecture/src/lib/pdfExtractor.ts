// src/lib/pdfExtractor.ts
// Extraction de texte PDF côté client avec pdf.js

import * as pdfjsLib from 'pdfjs-dist';

// Configuration du worker pdf.js (CDN)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extrait le texte d'un fichier PDF
 * @param file - Le fichier PDF à traiter
 * @returns Le texte extrait du PDF
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: { str?: string }) => item.str || '')
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n\n');
}

/**
 * Convertit un fichier PDF en fichier TXT
 * @param pdfFile - Le fichier PDF source
 * @returns Un nouveau fichier File au format .txt
 */
export async function convertPDFToTextFile(pdfFile: File): Promise<File> {
  const text = await extractTextFromPDF(pdfFile);

  // Créer un nouveau nom de fichier avec extension .txt
  const newName = pdfFile.name.replace(/\.pdf$/i, '.txt');

  // Créer le nouveau fichier
  const blob = new Blob([text], { type: 'text/plain' });
  return new File([blob], newName, { type: 'text/plain' });
}

/**
 * Vérifie si le fichier est un PDF
 */
export function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
