// src/lib/documentPdfExport.ts
// Export PDF des documents structurés de la page Communication
// (rapport d'incident, bilan pour commission disciplinaire).
// Rendu texte sobre : titres hiérarchisés, puces, pagination — le document
// est destiné à être imprimé ou versé au dossier administratif.

import jsPDF from 'jspdf';

/** Retire les marqueurs markdown en ligne (gras, italique, code) */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}/g, '')
    .trim();
}

export function exportDocumentToPdf(
  title: string,
  content: string,
  filenameBase: string
): void {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const maxWidth = pageWidth - 2 * margin;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const writeWrapped = (
    text: string,
    fontSize: number,
    style: 'normal' | 'bold',
    indent = 0,
    lineGap = 1.5
  ) => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(fontSize);
    const lines: string[] = pdf.splitTextToSize(text, maxWidth - indent);
    const lineHeight = fontSize * 0.4 + lineGap;
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, margin + indent, y);
      y += lineHeight;
    }
  };

  // En-tête : titre + date de génération
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  writeWrapped(title, 16, 'bold');
  y += 1;
  pdf.setTextColor(110);
  writeWrapped(
    `Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} avec ProfAssist — à relire et compléter avant usage`,
    9,
    'normal'
  );
  pdf.setTextColor(0);
  y += 2;
  pdf.setDrawColor(180);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Corps : parsing ligne à ligne du markdown
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      y += 2.5;
      continue;
    }

    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);

    if (h3) {
      y += 2;
      writeWrapped(stripInlineMarkdown(h3[1]), 11.5, 'bold');
      y += 0.5;
    } else if (h2) {
      y += 3;
      writeWrapped(stripInlineMarkdown(h2[1]), 12.5, 'bold');
      y += 0.5;
    } else if (h1) {
      y += 4;
      writeWrapped(stripInlineMarkdown(h1[1]), 13.5, 'bold');
      y += 1;
    } else if (bullet) {
      writeWrapped(`•  ${stripInlineMarkdown(bullet[1])}`, 11, 'normal', 3);
    } else if (/^\*\*(.+)\*\*\s*:?\s*$/.test(line)) {
      // Ligne entièrement en gras (sous-rubrique du prompt commission)
      y += 2;
      writeWrapped(stripInlineMarkdown(line), 11, 'bold');
    } else {
      writeWrapped(stripInlineMarkdown(line), 11, 'normal');
    }
  }

  // Pieds de page : numérotation
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text(`${i} / ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }
  pdf.setTextColor(0);

  const dateSlug = new Date().toISOString().slice(0, 10);
  pdf.save(`${filenameBase}-${dateSlug}.pdf`);
}
