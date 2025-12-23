// src/lib/pdfExtractor.ts
// Extraction de texte PDF côté client avec pdf.js (compatible Vite)
// Version améliorée pour meilleure gestion des tableaux

import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Configuration du worker pour Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PositionedText {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

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



