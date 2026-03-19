// src/components/modals/ExerciseGeneratorModal.tsx
// Modal pour générer des supports pédagogiques (exercices, fiches, QCM...) à partir d'une phase

import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import jsPDF from 'jspdf';
import {
  X,
  Loader2,
  Sparkles,
  Copy,
  FileDown,
  FileText,
  RotateCcw,
  CheckCircle,
  GripHorizontal,
  Minimize2,
  Info,
} from 'lucide-react';
import { secureApi } from '../../lib/secureApi';
import copyToClipboard from '../../lib/copyToClipboard';
import { convertMarkdownTablesToHtml } from '../../lib/phaseExtractor';
import { TOKEN_UPDATED, tokenUpdateEvent } from '../layout/Header';

interface ExerciseGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  phaseHeading: string;
  phaseContent: string;
  fullLessonContent: string;
  subject: string;
  level: string;
}

const SUPPORT_TYPES = [
  { key: 'auto', label: 'Laisser l\'IA choisir (recommandé)' },
  { key: 'contexte', label: 'Générer un contexte (scénario, texte, situation...)' },
  { key: 'texte_a_trous', label: 'Texte à trous' },
  { key: 'vocabulaire', label: 'Liste de vocabulaire / mots-clés' },
  { key: 'qcm', label: 'QCM / Vrai-Faux' },
  { key: 'exercices', label: 'Exercices d\'application' },
  { key: 'dictee', label: 'Dictée préparée' },
  { key: 'grille', label: 'Grille d\'évaluation / observation' },
  { key: 'fiche_eleve', label: 'Fiche élève (synthèse)' },
];

export function ExerciseGeneratorModal({
  isOpen,
  onClose,
  phaseHeading,
  phaseContent,
  fullLessonContent,
  subject,
  level,
}: ExerciseGeneratorModalProps) {
  const [supportType, setSupportType] = useState('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Drag state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from header area, ignore buttons
    if ((e.target as HTMLElement).closest('button')) return;
    isDragging.current = true;
    const rect = modalRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const handleMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Reset position when modal opens
  useEffect(() => {
    if (isOpen) {
      setPosition(null);
      setIsMinimized(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedContent(null);

    try {
      const result = await secureApi.generateExercise({
        phaseContent,
        supportType,
        subject,
        level,
        fullLessonContext: fullLessonContent,
      });

      setGeneratedContent(result.content);

      // Rafraîchir le solde de tokens
      tokenUpdateEvent.dispatchEvent(new CustomEvent(TOKEN_UPDATED));
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de la génération.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedContent) return;
    await copyToClipboard(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setGeneratedContent(null);
    setError(null);
    setSupportType('auto');
  };

  const handleClose = () => {
    // Persistant : on ne reset PAS le contenu généré à la fermeture
    setCopied(false);
    onClose();
  };

  // =====================================================
  // Export PDF
  // =====================================================
  const handleExportPDF = () => {
    if (!generatedContent) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    const cleanText = (text: string): string => {
      return text
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/…/g, '...')
        .replace(/[–—]/g, '-')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .trim();
    };

    const checkNewPage = (neededHeight: number = 25) => {
      if (yPosition > pageHeight - neededHeight) {
        pdf.addPage();
        yPosition = margin;
      }
    };

    const addSimpleText = (text: string, fontSize: number, isBold: boolean = false, indent: number = 0) => {
      const cleaned = cleanText(text).replace(/\*\*/g, '');
      if (!cleaned) return;
      checkNewPage();
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      pdf.setFontSize(fontSize);
      const availableWidth = maxWidth - indent;
      const lines = pdf.splitTextToSize(cleaned, availableWidth);
      const lineHeight = fontSize * 0.45;
      lines.forEach((line: string) => {
        checkNewPage();
        pdf.text(line, margin + indent, yPosition);
        yPosition += lineHeight;
      });
      yPosition += 1;
    };

    const renderTablePDF = (headers: string[], rows: string[][]) => {
      if (headers.length === 0 && rows.length === 0) return;
      const colCount = headers.length || (rows[0]?.length || 0);
      const tableWidth = maxWidth;
      const colWidth = tableWidth / colCount;
      const cellPadding = 2;
      const fontSize = 8;
      const lineHeight = fontSize * 0.4;
      pdf.setFontSize(fontSize);

      const calculateRowHeight = (cells: string[]): number => {
        let maxLines = 1;
        cells.forEach((cell) => {
          const cleaned = cleanText(cell).replace(/\*\*/g, '');
          pdf.setFont('helvetica', 'normal');
          const lines = pdf.splitTextToSize(cleaned, colWidth - cellPadding * 2);
          maxLines = Math.max(maxLines, lines.length);
        });
        return maxLines * (lineHeight + 2) + cellPadding * 2;
      };

      const drawRow = (cells: string[], rowY: number, rowHeight: number, isHeader: boolean = false) => {
        cells.forEach((cell, colIndex) => {
          const cellX = margin + colIndex * colWidth;
          const cleaned = cleanText(cell).replace(/\*\*/g, '');
          if (isHeader) {
            pdf.setFillColor(230, 240, 255);
            pdf.rect(cellX, rowY, colWidth, rowHeight, 'F');
          }
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.2);
          pdf.rect(cellX, rowY, colWidth, rowHeight, 'S');
          pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
          pdf.setTextColor(0, 0, 0);
          const lines = pdf.splitTextToSize(cleaned, colWidth - cellPadding * 2);
          let textY = rowY + cellPadding + fontSize * 0.35;
          lines.forEach((line: string) => {
            if (textY < rowY + rowHeight - cellPadding) {
              pdf.text(line, cellX + cellPadding, textY);
              textY += lineHeight + 2;
            }
          });
        });
      };

      if (headers.length > 0) {
        const headerHeight = calculateRowHeight(headers);
        checkNewPage(headerHeight + 20);
        drawRow(headers, yPosition, headerHeight, true);
        yPosition += headerHeight;
      }
      rows.forEach((row) => {
        const rowHeight = calculateRowHeight(row);
        checkNewPage(rowHeight + 10);
        drawRow(row, yPosition, rowHeight, false);
        yPosition += rowHeight;
      });
      yPosition += 6;
    };

    // Parse markdown to PDF
    const lines = generatedContent.split('\n');
    let inTable = false;
    let tableRows: string[][] = [];
    let tableHeaders: string[] = [];

    const flushTable = () => {
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        renderTablePDF(tableHeaders, tableRows);
        tableHeaders = [];
        tableRows = [];
      }
      inTable = false;
    };

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
        if (trimmedLine.match(/^\|[\s\-:|]+\|$/)) {
          inTable = true;
          return;
        }
        const cells = trimmedLine.slice(1, -1).split('|').map(c => c.trim());
        if (!inTable) {
          tableHeaders = cells;
          inTable = true;
        } else {
          tableRows.push(cells);
        }
        return;
      }

      if (inTable && !trimmedLine.startsWith('|')) {
        flushTable();
      }

      if (trimmedLine === '' || trimmedLine === '---') {
        yPosition += 3;
        return;
      }

      if (trimmedLine.startsWith('# ')) {
        yPosition += 4;
        addSimpleText(trimmedLine.substring(2), 16, true);
        yPosition += 2;
      } else if (trimmedLine.startsWith('## ')) {
        yPosition += 3;
        addSimpleText(trimmedLine.substring(3), 13, true);
        yPosition += 1;
      } else if (trimmedLine.startsWith('### ')) {
        yPosition += 2;
        addSimpleText(trimmedLine.substring(4), 11, true);
      } else if (trimmedLine.startsWith('#### ')) {
        yPosition += 2;
        addSimpleText(trimmedLine.substring(5), 10, true);
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        const content = trimmedLine.replace(/^[-*]\s*/, '');
        checkNewPage();
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text('\u2022', margin + 3, yPosition);
        const cleaned = cleanText(content).replace(/\*\*/g, '');
        const textLines = pdf.splitTextToSize(cleaned, maxWidth - 7);
        textLines.forEach((l: string, idx: number) => {
          if (idx > 0) checkNewPage();
          pdf.text(l, margin + 7, yPosition);
          yPosition += 9 * 0.45;
        });
        yPosition += 1;
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        const match = trimmedLine.match(/^(\d+\.)\s*(.*)/);
        if (match) {
          checkNewPage();
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(match[1], margin + 3, yPosition);
          pdf.setFont('helvetica', 'normal');
          const cleaned = cleanText(match[2]).replace(/\*\*/g, '');
          const textLines = pdf.splitTextToSize(cleaned, maxWidth - 12);
          textLines.forEach((l: string, idx: number) => {
            if (idx > 0) checkNewPage();
            pdf.text(l, margin + 12, yPosition);
            yPosition += 9 * 0.45;
          });
          yPosition += 1;
        }
      } else if (trimmedLine.startsWith('>')) {
        const content = trimmedLine.replace(/^>\s*/, '');
        addSimpleText(content, 9, false, 5);
      } else {
        addSimpleText(trimmedLine, 9);
      }
    });

    // Flush remaining table
    if (inTable) flushTable();

    pdf.save(`support-pedagogique-${Date.now()}.pdf`);
  };

  // =====================================================
  // Export DOCX (HTML-to-Blob)
  // =====================================================
  const handleExportDOCX = () => {
    if (!generatedContent) return;

    const htmlContent = markdownToSimpleHtml(generatedContent);

    const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Support pédagogique</title>
<style>
  body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.5; }
  h1 { font-size: 16pt; color: #333; margin-top: 12pt; }
  h2 { font-size: 14pt; color: #333; margin-top: 10pt; }
  h3 { font-size: 12pt; color: #333; margin-top: 8pt; }
  h4 { font-size: 11pt; color: #333; font-weight: bold; margin-top: 6pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 1px solid #999; padding: 4pt 6pt; }
  th { background-color: #f0f0f0; font-weight: bold; }
  ul, ol { margin: 4pt 0; padding-left: 20pt; }
  li { margin-bottom: 2pt; }
  blockquote { border-left: 3px solid #ccc; padding-left: 10pt; color: #555; margin: 6pt 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 8pt 0; }
</style></head>
<body>${htmlContent}</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `support-pedagogique-${Date.now()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modalStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'none',
      }
    : {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };

  return (
    <>
      {/* Overlay transparent - ne bloque pas l'interaction avec la page */}
      <div className="fixed inset-0 bg-black/30 z-40 pointer-events-none" />

      {/* Modal déplaçable */}
      <div
        ref={modalRef}
        style={modalStyle}
        className={`z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl ${
          isMinimized ? '' : 'max-h-[90vh]'
        } overflow-hidden flex flex-col`}
      >

        {/* Header — zone de drag */}
        <div
          className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white shrink-0 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Générer un support</h3>
                <p className="text-purple-100 text-sm truncate max-w-sm">
                  {phaseHeading}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GripHorizontal className="w-5 h-5 text-white/40" />
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white/80 hover:text-white transition-colors"
                title={isMinimized ? 'Agrandir' : 'Réduire'}
              >
                <Minimize2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleClose}
                className="text-white/80 hover:text-white transition-colors"
                title="Fermer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Bandeau info coût */}
        {!isMinimized && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-5 py-2.5 flex items-center gap-2 shrink-0">
            <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Chaque génération consomme <strong>1 000 tokens</strong> de votre solde.
            </p>
          </div>
        )}

        {/* Body + Footer — masqués si minimisé */}
        {!isMinimized && (
        <>
        <div className="overflow-y-auto flex-1 p-6">

          {/* Error state */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              <button
                onClick={handleGenerate}
                className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Form view (before generation) */}
          {!generatedContent && !isGenerating && (
            <>
              {/* Phase context */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Contenu de la phase :</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4">
                  {phaseContent.substring(0, 300)}{phaseContent.length > 300 ? '...' : ''}
                </p>
              </div>

              {/* Support type selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Type de support :
                </label>
                <div className="space-y-2">
                  {SUPPORT_TYPES.map((type) => (
                    <label
                      key={type.key}
                      className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        supportType === type.key
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="supportType"
                        value={type.key}
                        checked={supportType === type.key}
                        onChange={() => setSupportType(type.key)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                        supportType === type.key
                          ? 'border-purple-500'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {supportType === type.key && (
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Token cost + Generate button */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Coût : 1 000 tokens
                </span>
                <button
                  onClick={handleGenerate}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Générer
                </button>
              </div>
            </>
          )}

          {/* Loading state */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">Génération en cours...</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Cela peut prendre quelques secondes</p>
            </div>
          )}

          {/* Result view */}
          {generatedContent && (
            <>
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <FileDown className="w-4 h-4" />
                  Exporter PDF
                </button>
                <button
                  onClick={handleExportDOCX}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Exporter Word
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Nouveau support
                </button>
              </div>

              {/* Rendered content */}
              <div className="prose prose-sm max-w-none dark:prose-invert border border-gray-200 dark:border-gray-600 rounded-xl p-6 bg-white dark:bg-gray-900/50">
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw as any]}
                  components={{
                    h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-purple-200 dark:border-purple-800">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 mt-5">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2 mt-4">{children}</h3>,
                    p: ({ children }) => <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-6 mb-3 text-gray-700 dark:text-gray-300">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 text-gray-700 dark:text-gray-300">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
                    em: ({ children }) => <em className="italic text-gray-800 dark:text-gray-200">{children}</em>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-600 dark:text-gray-400 my-4 bg-purple-50 dark:bg-purple-900/20 py-2 rounded-r-lg">{children}</blockquote>,
                    table: ({ children }) => (
                      <table className="w-full border-collapse my-4 text-sm border border-gray-300 dark:border-gray-600">{children}</table>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-purple-100 dark:bg-purple-900/40">{children}</thead>
                    ),
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => (
                      <tr className="border-b border-gray-200 dark:border-gray-700">{children}</tr>
                    ),
                    th: ({ children }) => (
                      <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 bg-purple-50 dark:bg-purple-900/30">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">{children}</td>
                    ),
                  }}
                >
                  {convertMarkdownTablesToHtml(generatedContent)}
                </ReactMarkdown>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {generatedContent && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 shrink-0">
            <button
              onClick={handleClose}
              className="w-full px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Fermer
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </>
  );
}

// =====================================================
// Helper : Markdown vers HTML simple (pour export Word)
// =====================================================
function markdownToSimpleHtml(md: string): string {
  let html = md;

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[\s\-:|]+\|)\n((?:\|.+\|\n?)*)/gm, (_, headerRow, _sep, bodyRows) => {
    const headers = headerRow.slice(1, -1).split('|').map((c: string) => `<th>${c.trim()}</th>`).join('');
    const rows = bodyRows.trim().split('\n').map((row: string) => {
      const cells = row.slice(1, -1).split('|').map((c: string) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs (lines not already wrapped in tags)
  html = html.replace(/^(?!<[a-z])((?!<).+)$/gm, '<p>$1</p>');

  // Clean up double newlines
  html = html.replace(/\n{2,}/g, '\n');

  return html;
}
