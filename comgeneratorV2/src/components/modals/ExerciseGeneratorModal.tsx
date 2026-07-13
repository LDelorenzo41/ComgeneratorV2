// src/components/modals/ExerciseGeneratorModal.tsx
// Modal pour générer des supports pédagogiques (exercices, fiches, QCM...) à partir d'une phase

import React, { useState, useRef, useCallback, useEffect } from 'react';
import jsPDF from 'jspdf';
import katex from 'katex';
import EnhancedMarkdownRenderer from '../ui/EnhancedMarkdownRenderer';
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
  UserRound,
  Pin,
  Trash2,
  Eye,
  EyeOff,
  BookmarkPlus,
} from 'lucide-react';
import { secureApi } from '../../lib/secureApi';
import copyToClipboard from '../../lib/copyToClipboard';

import { TOKEN_UPDATED, tokenUpdateEvent } from '../layout/Header';

import { logGeneration } from '../../lib/usageStats';
class MarkdownErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackContent: string },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {this.props.fallbackContent}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Strip correction/answer sections from generated content for student exports.
 */
function stripCorrections(content: string): string {
  const correctionPattern = /^#{1,4}\s*(Correction|Corrigé|Corrigés|Réponse|Réponses|Solution|Solutions)[\s:]*$/im;
  const match = content.match(correctionPattern);
  if (match && match.index !== undefined) {
    return content.substring(0, match.index).trim();
  }
  return content;
}

interface ExerciseGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  phaseHeading: string;
  phaseContent: string;
  fullLessonContent: string;
  subject: string;
  level: string;
  /**
   * Identifiant logique de la séance courante. Quand il change, la
   * collection de supports épinglés est réinitialisée (évite de mélanger
   * les supports d'une séance avec une autre).
   */
  lessonKey?: string;
  /**
   * Si fourni, un bouton "Ajouter à la séance" est proposé. Le parent
   * décide comment persister (mémoire pour la génération, UPDATE pour la
   * banque).
   */
  onAttachSupportsToLesson?: (
    items: { heading: string; content: string }[]
  ) => void | Promise<void>;
}

interface PinnedSupport {
  id: string;
  heading: string;
  content: string;
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
  lessonKey,
  onAttachSupportsToLesson,
}: ExerciseGeneratorModalProps) {
  const [supportType, setSupportType] = useState('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Collection de supports épinglés (durée de vie : session de la page)
  const [pinnedSupports, setPinnedSupports] = useState<PinnedSupport[]>([]);
  const [generatedHeading, setGeneratedHeading] = useState<string>('');
  const [expandedPinnedId, setExpandedPinnedId] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [showPinnedPanel, setShowPinnedPanel] = useState(true);

  const cleanSupportLabel = (key: string) => {
    if (key === 'auto') return 'Support pédagogique';
    return SUPPORT_TYPES.find((t) => t.key === key)?.label ?? 'Support pédagogique';
  };

  // Réinitialise les épinglés quand on change de séance
  useEffect(() => {
    setPinnedSupports([]);
    setExpandedPinnedId(null);
  }, [lessonKey]);

  const isCurrentPinned =
    !!generatedContent && pinnedSupports.some((p) => p.content === generatedContent);

  const showToast = (message: string) => {
    const el = document.createElement('div');
    el.className =
      'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-[80] transition-all duration-300';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2500);
  };

  const handleTogglePin = () => {
    if (!generatedContent) return;
    const existing = pinnedSupports.find((p) => p.content === generatedContent);
    if (existing) {
      setPinnedSupports((prev) => prev.filter((p) => p.id !== existing.id));
      return;
    }
    setPinnedSupports((prev) => [
      ...prev,
      {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        heading: generatedHeading || phaseHeading,
        content: generatedContent,
      },
    ]);
  };

  const handleUnpin = (id: string) => {
    setPinnedSupports((prev) => prev.filter((p) => p.id !== id));
    setExpandedPinnedId((cur) => (cur === id ? null : cur));
  };

  const handleReshow = (content: string) => {
    setError(null);
    setGeneratedContent(content);
  };

  const handleCopyPinned = async (content: string) => {
    await copyToClipboard(content);
    showToast('Support copié');
  };

  const handleAttach = async (items: { heading: string; content: string }[]) => {
    if (!onAttachSupportsToLesson || items.length === 0) return;
    setIsAttaching(true);
    try {
      await onAttachSupportsToLesson(items);
      showToast(
        items.length > 1
          ? `${items.length} supports ajoutés à la séance`
          : 'Support ajouté à la séance'
      );
    } catch (err: any) {
      showToast("Échec de l'ajout à la séance");
    } finally {
      setIsAttaching(false);
    }
  };

  // Content area ref for capturing visuals
  const contentAreaRef = useRef<HTMLDivElement>(null);

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
      logGeneration('exercise');
      setGeneratedHeading(`${phaseHeading} — ${cleanSupportLabel(supportType)}`);

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
  // =====================================================
  // Shared PDF export logic
  // =====================================================
  const exportPDF = async (options: {
    content: string;
    includeStudentHeader: boolean;
    filename: string;
  }) => {
    const { content, includeStudentHeader, filename } = options;
    if (!content || !contentAreaRef.current) return;

    const { toPng } = await import('html-to-image');

    const targetElement: HTMLElement = contentAreaRef.current;

    // For student PDF, temporarily remove correction sections from the original DOM
    const removedNodes: { parent: Node; nodes: Node[] }[] = [];
    if (includeStudentHeader) {
      const headings = contentAreaRef.current.querySelectorAll('h1, h2, h3, h4');
      const correctionPattern = /^(Correction|Corrigé|Corrigés|Réponse|Réponses|Solution|Solutions)/i;
      for (const heading of Array.from(headings)) {
        if (correctionPattern.test(heading.textContent?.trim() || '')) {
          const parent = heading.parentNode!;
          const nodesToRemove: Node[] = [heading];
          let sibling: ChildNode | null = heading.nextSibling;
          while (sibling) {
            nodesToRemove.push(sibling);
            sibling = sibling.nextSibling;
          }
          nodesToRemove.forEach(n => parent.removeChild(n));
          removedNodes.push({ parent, nodes: nodesToRemove });
          break;
        }
      }
    }

    // Save and apply print-friendly styles
    const originalStyles = {
      width: contentAreaRef.current.style.width,
      maxHeight: contentAreaRef.current.style.maxHeight,
      overflow: contentAreaRef.current.style.overflow,
      backgroundColor: contentAreaRef.current.style.backgroundColor,
      color: contentAreaRef.current.style.color,
    };

    targetElement.style.width = '794px';
    targetElement.style.maxHeight = 'none';
    targetElement.style.overflow = 'visible';
    targetElement.style.backgroundColor = '#ffffff';
    targetElement.style.color = '#000000';

    // Strip dark: classes temporarily for light-mode capture
    const allEls = targetElement.querySelectorAll('[class*="dark:"]');
    allEls.forEach((el) => {
      const darkCls = Array.from(el.classList).filter(c => c.startsWith('dark:'));
      darkCls.forEach(c => el.classList.remove(c));
      (el as HTMLElement).dataset.removedDarkClasses = darkCls.join(' ');
    });

    try {
      // Capture the rendered DOM at high resolution
      const dataUrl = await toPng(targetElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      // Load image to get dimensions
      const fullImage = new window.Image();
      fullImage.src = dataUrl;
      await new Promise<void>((resolve) => {
        if (fullImage.naturalWidth) resolve();
        else fullImage.onload = () => resolve();
      });

      const imgWidth = fullImage.naturalWidth;
      const imgHeight = fullImage.naturalHeight;

      // PDF setup
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();   // 210
      const pageHeight = pdf.internal.pageSize.getHeight();  // 297
      const margin = 15;
      const maxWidth = pageWidth - 2 * margin;               // 180
      const contentHeightMM = pageHeight - 2 * margin;       // 267

      // Scale: map image pixels to mm
      const scale = maxWidth / imgWidth;

      // Student header height
      let headerHeightMM = 0;
      if (includeStudentHeader) {
        const fieldY = margin;
        const halfWidth = maxWidth / 2 - 2;
        const dotLine = (x: number, y: number, w: number) => {
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.3);
          pdf.line(x, y, x + w, y);
        };

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);

        // Row 1: Nom / Prénom
        pdf.text('Nom :', margin, fieldY + 4);
        dotLine(margin + 14, fieldY + 4, halfWidth - 16);
        pdf.text('Prénom :', margin + halfWidth + 4, fieldY + 4);
        dotLine(margin + halfWidth + 22, fieldY + 4, halfWidth - 22);

        // Row 2: Classe / Date
        pdf.text('Classe :', margin, fieldY + 12);
        dotLine(margin + 16, fieldY + 12, halfWidth - 18);
        pdf.text('Date :', margin + halfWidth + 4, fieldY + 12);
        dotLine(margin + halfWidth + 18, fieldY + 12, halfWidth - 18);

        // Separator line
        const sepY = fieldY + 18;
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.line(margin, sepY, margin + maxWidth, sepY);

        headerHeightMM = 24;
      }

      // Paginate: slice the tall image into A4-sized pages
      const firstPageContentMM = contentHeightMM - headerHeightMM;
      const firstPageHeightPx = firstPageContentMM / scale;
      const normalPageHeightPx = contentHeightMM / scale;

      let sourceY = 0;
      let pageNum = 0;

      while (sourceY < imgHeight) {
        if (pageNum > 0) pdf.addPage();

        const isFirstPage = pageNum === 0;
        const pageHeightPx = isFirstPage ? firstPageHeightPx : normalPageHeightPx;
        const yOffset = isFirstPage ? margin + headerHeightMM : margin;

        const sliceHeight = Math.min(pageHeightPx, imgHeight - sourceY);
        const sliceHeightMM = sliceHeight * scale;

        // Create canvas for this page slice
        const canvas = document.createElement('canvas');
        canvas.width = imgWidth;
        canvas.height = Math.ceil(sliceHeight);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(fullImage, 0, sourceY, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);

        const sliceDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(sliceDataUrl, 'JPEG', margin, yOffset, maxWidth, sliceHeightMM);

        sourceY += pageHeightPx;
        pageNum++;
      }

      pdf.save(`${filename}-${Date.now()}.pdf`);
    } finally {
      // Restore original styles
      Object.assign(contentAreaRef.current.style, originalStyles);
      // Restore dark: classes that were temporarily removed
      targetElement.querySelectorAll('[data-removed-dark-classes]').forEach((el) => {
        const htmlEl = el as HTMLElement;
        const classes = htmlEl.dataset.removedDarkClasses?.split(' ') || [];
        classes.forEach(c => c && htmlEl.classList.add(c));
        delete htmlEl.dataset.removedDarkClasses;
      });
      // Restore removed correction sections
      for (const { parent, nodes } of removedNodes) {
        for (const node of nodes) {
          parent.appendChild(node);
        }
      }
    }
  };

  const handleExportPDF = () => {
    if (!generatedContent) return;
    exportPDF({ content: generatedContent, includeStudentHeader: false, filename: 'support-pedagogique' });
  };

  const handleExportPDFEleve = () => {
    if (!generatedContent) return;
    exportPDF({ content: stripCorrections(generatedContent), includeStudentHeader: true, filename: 'fiche-eleve' });
  };

  // =====================================================
  // Export DOCX (HTML-to-Blob)
  // =====================================================
  const handleExportDOCX = async () => {
    if (!generatedContent) return;

    // Capture rendered mermaid/chart visuals from the DOM
    const capturedImages: string[] = [];
    if (contentAreaRef.current) {
      const { toPng } = await import('html-to-image');
      const allVisuals = Array.from(contentAreaRef.current.querySelectorAll('[data-mermaid], [data-chart]'));
      for (const el of allVisuals) {
        try {
          const dataUrl = await toPng(el as HTMLElement, { backgroundColor: '#ffffff' });
          capturedImages.push(dataUrl);
        } catch {
          capturedImages.push('');
        }
      }
    }

    const htmlContent = markdownToSimpleHtmlWithImages(generatedContent, capturedImages);

    const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns="http://www.w3.org/TR/REC-html40">
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

          {/* Supports épinglés */}
          {pinnedSupports.length > 0 && (
            <div className="mb-4 border-2 border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowPinnedPanel((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Pin className="w-4 h-4" />
                  Supports épinglés ({pinnedSupports.length})
                </span>
                <span className="flex items-center gap-2">
                  {onAttachSupportsToLesson && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAttach(
                          pinnedSupports.map((p) => ({ heading: p.heading, content: p.content }))
                        );
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      Tout ajouter à la séance
                    </span>
                  )}
                  {showPinnedPanel ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </span>
              </button>

              {showPinnedPanel && (
                <ul className="divide-y divide-purple-100 dark:divide-purple-900/40">
                  {pinnedSupports.map((p) => (
                    <li key={p.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() =>
                            setExpandedPinnedId((id) => (id === p.id ? null : p.id))
                          }
                          className="text-left text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 min-w-0 truncate"
                          title={p.heading}
                        >
                          {p.heading}
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleReshow(p.content)}
                            title="Réafficher dans la zone principale"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCopyPinned(p.content)}
                            title="Copier"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {onAttachSupportsToLesson && (
                            <button
                              onClick={() =>
                                handleAttach([{ heading: p.heading, content: p.content }])
                              }
                              disabled={isAttaching}
                              title="Ajouter ce support à la séance"
                              className="p-1.5 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg disabled:opacity-50"
                            >
                              <BookmarkPlus className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleUnpin(p.id)}
                            title="Retirer des épinglés"
                            className="p-1.5 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {expandedPinnedId === p.id && (
                        <div className="mt-2 prose prose-sm max-w-none dark:prose-invert border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900/40 max-h-64 overflow-auto">
                          <MarkdownErrorBoundary fallbackContent={p.content}>
                            <EnhancedMarkdownRenderer content={p.content} />
                          </MarkdownErrorBoundary>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
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
                  onClick={handleTogglePin}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isCurrentPinned
                      ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                  }`}
                  title={
                    isCurrentPinned
                      ? 'Ce support est conservé. Cliquez pour le retirer des épinglés.'
                      : 'Conserver ce support pour en générer un autre sans le perdre'
                  }
                >
                  {isCurrentPinned ? <CheckCircle className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  {isCurrentPinned ? 'Épinglé' : 'Épingler'}
                </button>
                {onAttachSupportsToLesson && (
                  <button
                    onClick={() =>
                      handleAttach([
                        { heading: generatedHeading || phaseHeading, content: generatedContent! },
                      ])
                    }
                    disabled={isAttaching}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-colors disabled:opacity-50"
                    title="Ajouter ce support à la fin de la séance"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                    Ajouter à la séance
                  </button>
                )}
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
                  onClick={handleExportPDFEleve}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <UserRound className="w-4 h-4" />
                  PDF Élève
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
              <div ref={contentAreaRef} className="prose prose-sm max-w-none dark:prose-invert border border-gray-200 dark:border-gray-600 rounded-xl p-6 bg-white dark:bg-gray-900/50">
                <MarkdownErrorBoundary fallbackContent={generatedContent}>
                  <EnhancedMarkdownRenderer content={generatedContent} />
                </MarkdownErrorBoundary>
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
/**
 * Render LaTeX expressions in text to MathML (supported natively by Word).
 * Handles display math (\[...\], $$...$$) and inline math (\(...\), $...$).
 */
function renderLatexToMathML(text: string): string {
  // Display math: \[...\] and $$...$$
  let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, output: 'mathml', displayMode: true });
    } catch { return expr; }
  });
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, output: 'mathml', displayMode: true });
    } catch { return expr; }
  });

  // Inline math: \(...\) and $...$
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, output: 'mathml' });
    } catch { return expr; }
  });
  result = result.replace(/\$([^\$\n]+?)\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, output: 'mathml' });
    } catch { return expr; }
  });

  return result;
}

function markdownToSimpleHtml(md: string): string {
  let html = renderLatexToMathML(md);

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

function markdownToSimpleHtmlWithImages(md: string, capturedImages: string[]): string {
  // Replace mermaid/chart code blocks with captured images before converting
  let imageIndex = 0;
  const processed = md.replace(/```(?:mermaid|chart)\n[\s\S]*?```/g, () => {
    const imgData = capturedImages[imageIndex++];
    if (imgData) {
      return `<p><img src="${imgData}" style="max-width:100%;height:auto;" /></p>`;
    }
    return '<p><em>[Diagramme non disponible]</em></p>';
  });
  return markdownToSimpleHtml(processed);
}