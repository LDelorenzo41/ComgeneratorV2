import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configuration du worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  try {
    // Fichiers texte
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      return await file.text();
    }

    // Fichiers Word (.docx)
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }

    // Fichiers PDF
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }
      return fullText.trim();
    }

    // Fichiers Word anciens (.doc) - non supporté directement
    if (fileName.endsWith('.doc')) {
      throw new Error('Les fichiers .doc ne sont pas supportés. Veuillez convertir en .docx');
    }

    throw new Error(`Type de fichier non supporté: ${fileType}`);
  } catch (error) {
    console.error('Erreur extraction document:', error);
    throw error;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
