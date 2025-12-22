// src/lib/pdfExtractor.ts
// Extraction de texte PDF côté client avec pdf.js (compatible Vite)

import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Configuration du worker pour Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Extrait le texte d'un fichier PDF
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  console.log(`Extracting text from PDF: ${file.name} (${file.size} bytes)`);
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item): item is TextItem => 'str' in item)
      .map((item) => item.str)
      .join(' ');
    textParts.push(pageText);
  }

  const fullText = textParts.join('\n\n');
  console.log(`Extracted ${fullText.length} characters from ${pdf.numPages} pages`);
  
  return fullText;
}

/**
 * Convertit un fichier PDF en fichier TXT
 */
export async function convertPDFToTextFile(pdfFile: File): Promise<File> {
  const text = await extractTextFromPDF(pdfFile);

  const newName = pdfFile.name.replace(/\.pdf$/i, '.txt');
  const blob = new Blob([text], { type: 'text/plain' });
  return new File([blob], newName, { type: 'text/plain' });
}

/**
 * Vérifie si le fichier est un PDF
 */
export function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}


