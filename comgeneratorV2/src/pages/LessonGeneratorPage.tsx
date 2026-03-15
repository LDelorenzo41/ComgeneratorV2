// src/pages/LessonGeneratorPage.tsx - VERSION MIGRÉE VERS EDGE FUNCTION

import React from 'react';
// ⭐ NOUVEAUX IMPORTS POUR PDF
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { createWorker } from 'tesseract.js';
// FIN NOUVEAUX IMPORTS
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
// ✅ AJOUT IMPORT REHYPE-RAW
import rehypeRaw from 'rehype-raw';

import jsPDF from 'jspdf';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
// ✅ IMPORT MODIFIÉ - Utilisation de secureApi au lieu d'OpenAI direct
import { secureApi, type LessonParams } from '../lib/secureApi';
import { TOKEN_UPDATED, tokenUpdateEvent } from '../components/layout/Header';
import useTokenBalance from '../hooks/useTokenBalance';
import { getFolders } from '../lib/ragApi';
import type { RagFolder } from '../lib/rag.types';
import { FolderSelector } from '../components/chatbot/FolderSelector';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Copy,
  FileDown,
  Save,
  Edit,
  Check,
  X,
  Sparkles,
  Clock,
  Users,
  Target,
  AlertCircle,
  CreditCard,
  Lock,
  ShoppingCart,
  Upload,
  FileText,
  Video,
  Database
} from 'lucide-react';

// ⭐ CONFIGURATION PDFJS
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const pedagogies = [
  {
    value: 'traditionnelle',
    label: 'Pédagogie traditionnelle',
    description: "Méthode centrée sur la transmission directe des savoirs de l'enseignant vers les élèves (exposés, leçons magistrales, démonstration), favorisant la mémorisation et l'acquisition des bases."
  },
  {
    value: 'active',
    label: 'Pédagogie active',
    description: "L'élève est acteur de son apprentissage : il explore, manipule, agit. Favorise l'expérimentation, la résolution de problèmes concrets, seul ou en groupe."
  },
  {
    value: 'projet',
    label: 'Pédagogie de projet',
    description: "Le savoir est mobilisé autour d'un projet concret (exposé, création, enquête). Les élèves planifient, réalisent, évaluent, ce qui développe leur autonomie."
  },
  {
    value: 'cooperatif',
    label: 'Apprentissage coopératif',
    description: "Les élèves travaillent en groupes pour résoudre des tâches ou projets, développant entraide, communication et responsabilisation."
  },
  {
    value: 'differenciee',
    label: 'Pédagogie différenciée',
    description: "Enseignement adapté aux besoins, rythmes et niveaux des élèves, avec des tâches variées et un accompagnement personnalisé."
  },
  {
    value: 'objectifs',
    label: 'Pédagogie par objectifs',
    description: "L'apprentissage est organisé autour d'objectifs clairs (compétences à atteindre, comportements observables). Permet un suivi précis de la progression."
  },
  {
    value: 'problemes',
    label: 'Apprentissage par problèmes (ABP)',
    description: "Les élèves doivent résoudre un problème complexe ou répondre à une question de recherche en mobilisant différentes connaissances."
  },
  {
    value: 'inverse',
    label: 'Enseignement inversé',
    description: "La théorie est étudiée à la maison (vidéos, docs), et la classe sert à pratiquer, échanger, approfondir."
  },
  {
    value: 'jeu',
    label: 'Apprentissage par le jeu',
    description: "Utilisation de jeux éducatifs, simulations ou jeux de rôle pour faciliter l'acquisition de compétences scolaires et sociales."
  }
];

const durationOptions = Array.from({ length: 10 }, (_, i) => {
  const value = (45 + i * 15).toString();
  return {
    value,
    label: `${parseInt(value, 10)} minutes`
  };
});

// ✅ SCHÉMA MODIFIÉ pour correspondre à LessonParams
const lessonSchema = z.object({
  subject: z.string().min(1, 'La matière est requise'),
  topic: z.string().min(1, 'Le thème est requis'),
  level: z.string().min(1, 'Le niveau est requis'),
  pedagogy_type: z.string().min(1, 'Le type de pédagogie est requis'),
  duration: z.enum(durationOptions.map(o => o.value) as [string, ...string[]])
});

type LessonFormData = z.infer<typeof lessonSchema>;

// ✅ FONCTION AJOUTÉE : Conversion des tableaux Markdown en HTML
const convertMarkdownTablesToHtml = (markdown: string): string => {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inTable = false;
  let tableLines: string[] = [];

  const processTable = (tableLines: string[]): string => {
    if (tableLines.length < 2) return tableLines.join('\n');
    
    const headerLine = tableLines[0];
    const dataLines = tableLines.slice(2); // Skip separator line
    
    const parseRow = (line: string): string[] => {
      return line
        .slice(1, -1) // Remove first and last |
        .split('|')
        .map(cell => cell.trim());
    };
    
    const headers = parseRow(headerLine);
    
    let html = '<table class="markdown-table"><thead><tr>';
    headers.forEach(h => {
      html += `<th>${h}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    dataLines.forEach(line => {
      if (line.trim()) {
        const cells = parseRow(line);
        html += '<tr>';
        cells.forEach(c => {
          html += `<td>${c}</td>`;
        });
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

  // Handle table at end of content
  if (inTable && tableLines.length > 0) {
    result.push(processTable(tableLines));
  }

  return result.join('\n');
};

const MarkdownEditor: React.FC<{
  content: string;
  onChange: (content: string) => void;
  onSaveToBank: (content: string) => void;
  isSaving?: boolean;
  tokensAvailable?: number;
}> = ({ content, onChange, onSaveToBank, isSaving = false, tokensAvailable = 0 }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(content);
  const [isExporting, setIsExporting] = React.useState(false);

  // États pour vérifier l'accès banque
  const [hasBankAccess, setHasBankAccess] = React.useState<boolean | null>(null);
  const [bankAccessLoading, setBankAccessLoading] = React.useState(true);
  const { user } = useAuthStore();

  // Vérification de l'accès banque au chargement
  React.useEffect(() => {
    const checkBankAccess = async () => {
      if (!user) {
        setHasBankAccess(null);
        setBankAccessLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('has_bank_access')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Erreur lors de la vérification de l\'accès banque:', error);
          setHasBankAccess(false);
        } else {
          setHasBankAccess(profile?.has_bank_access || false);
        }
      } catch (err) {
        console.error('Erreur dans checkBankAccess:', err);
        setHasBankAccess(false);
      } finally {
        setBankAccessLoading(false);
      }
    };

    checkBankAccess();
  }, [user]);

  React.useEffect(() => {
    setEditContent(content);
  }, [content]);

  const handleSave = () => {
    onChange(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleSaveToBank = () => {
    if (!hasBankAccess) {
      const userConfirmed = confirm(
        '⚠️ Accès banque requis\n\n' +
        'Pour sauvegarder vos séances, vous devez disposer d\'un plan avec accès banque.\n\n' +
        'Souhaitez-vous consulter nos plans ?'
      );

      if (userConfirmed) {
        window.location.href = '/buy-tokens';
      }
      return;
    }

    onSaveToBank(content);
  };

    const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Fonction de nettoyage du texte
      const cleanText = (text: string): string => {
        return text
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
          .replace(/[\u{2600}-\u{26FF}]/gu, '')
          .replace(/[\u{2700}-\u{27BF}]/gu, '')
          .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
          .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
          .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
          .replace(/[📚🎯🛠️🏫⏰🚀🔍🏗️📝🎨🟢🔵♿📊💡⚠️🗣️🔄📈💻🔥💪🧘📎✅❌⭐🏃💪🎯📋📄🗑️✓●○◆◇■□▪▫•]/g, '')
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

      const parseMarkdownToPDF = (markdownContent: string) => {
        const lines = markdownContent.split('\n');
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

          // Tableau
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

          // H1
          if (trimmedLine.startsWith('# ')) {
            yPosition += 4;
            addSimpleText(trimmedLine.substring(2), 16, true);
            yPosition += 2;
          }
          // H2
          else if (trimmedLine.startsWith('## ')) {
            yPosition += 3;
            addSimpleText(trimmedLine.substring(3), 13, true);
            yPosition += 1;
          }
          // H3
          else if (trimmedLine.startsWith('### ')) {
            yPosition += 2;
            addSimpleText(trimmedLine.substring(4), 11, true);
          }
          // H4
          else if (trimmedLine.startsWith('#### ')) {
            yPosition += 2;
            addSimpleText(trimmedLine.substring(5), 10, true);
          }
          // Liste à puces
          else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('• ')) {
            const content = trimmedLine.replace(/^[-*•]\s*/, '');
            const cleanContent = cleanText(content).replace(/\*\*/g, '');
            const hasBold = content.includes('**');
            
            checkNewPage();
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.text('•', margin + 3, yPosition);
            
            if (hasBold && content.includes(':')) {
              const colonIndex = cleanContent.indexOf(':');
              if (colonIndex > 0) {
                const beforeColon = cleanContent.substring(0, colonIndex + 1);
                const afterColon = cleanContent.substring(colonIndex + 1).trim();
                
                pdf.setFont('helvetica', 'bold');
                pdf.text(beforeColon, margin + 7, yPosition);
                const boldWidth = pdf.getTextWidth(beforeColon + ' ');
                
                pdf.setFont('helvetica', 'normal');
                const remainingWidth = maxWidth - 7 - boldWidth;
                const restLines = pdf.splitTextToSize(afterColon, remainingWidth);
                
                if (restLines.length > 0) {
                  pdf.text(restLines[0], margin + 7 + boldWidth, yPosition);
                  yPosition += 9 * 0.45;
                  
                  for (let i = 1; i < restLines.length; i++) {
                    checkNewPage();
                    pdf.text(restLines[i], margin + 7, yPosition);
                    yPosition += 9 * 0.45;
                  }
                }
              } else {
                const lines = pdf.splitTextToSize(cleanContent, maxWidth - 7);
                lines.forEach((l: string, idx: number) => {
                  if (idx > 0) checkNewPage();
                  pdf.text(l, margin + 7, yPosition);
                  yPosition += 9 * 0.45;
                });
              }
            } else {
              const lines = pdf.splitTextToSize(cleanContent, maxWidth - 7);
              lines.forEach((l: string, idx: number) => {
                if (idx > 0) checkNewPage();
                pdf.text(l, margin + 7, yPosition);
                yPosition += 9 * 0.45;
              });
            }
            yPosition += 1;
          }
          // Liste numérotée
          else if (/^\d+\.\s/.test(trimmedLine)) {
            const match = trimmedLine.match(/^(\d+\.)\s*(.*)/);
            if (match) {
              const num = match[1];
              const content = cleanText(match[2]).replace(/\*\*/g, '');
              
              checkNewPage();
              pdf.setFontSize(9);
              pdf.setFont('helvetica', 'normal');
              pdf.text(num, margin + 2, yPosition);
              
              const lines = pdf.splitTextToSize(content, maxWidth - 10);
              lines.forEach((l: string, idx: number) => {
                if (idx > 0) checkNewPage();
                pdf.text(l, margin + 10, yPosition);
                yPosition += 9 * 0.45;
              });
              yPosition += 1;
            }
          }
          // Citation
          else if (trimmedLine.startsWith('> ')) {
            const content = cleanText(trimmedLine.substring(2)).replace(/\*\*/g, '');
            checkNewPage();
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'italic');
            
            const lines = pdf.splitTextToSize(content, maxWidth - 10);
            lines.forEach((l: string) => {
              checkNewPage();
              pdf.text(l, margin + 5, yPosition);
              yPosition += 9 * 0.45;
            });
            yPosition += 1;
          }
          // Texte normal
          else {
            const cleaned = cleanText(trimmedLine);
            if (!cleaned) return;
            
            // Ligne entièrement en gras
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**') && trimmedLine.indexOf('**', 2) === trimmedLine.length - 2) {
              addSimpleText(cleaned.replace(/\*\*/g, ''), 9, true);
            }
            // Format "**Label :** valeur"
            else if (cleaned.includes(':') && trimmedLine.includes('**')) {
              const colonIdx = cleaned.replace(/\*\*/g, '').indexOf(':');
              if (colonIdx > 0) {
                const fullCleaned = cleaned.replace(/\*\*/g, '');
                const label = fullCleaned.substring(0, colonIdx + 1);
                const value = fullCleaned.substring(colonIdx + 1).trim();
                
                checkNewPage();
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.text(label, margin, yPosition);
                const labelWidth = pdf.getTextWidth(label + ' ');
                
                pdf.setFont('helvetica', 'normal');
                const valueLines = pdf.splitTextToSize(value, maxWidth - labelWidth);
                
                if (valueLines.length > 0) {
                  pdf.text(valueLines[0], margin + labelWidth, yPosition);
                  yPosition += 9 * 0.45;
                  
                  for (let i = 1; i < valueLines.length; i++) {
                    checkNewPage();
                    pdf.text(valueLines[i], margin, yPosition);
                    yPosition += 9 * 0.45;
                  }
                }
                yPosition += 1;
              } else {
                addSimpleText(cleaned.replace(/\*\*/g, ''), 9, false);
              }
            }
            else {
              addSimpleText(cleaned.replace(/\*\*/g, ''), 9, false);
            }
          }
        });

        if (inTable) {
          flushTable();
        }
      };

      // === GÉNÉRATION ===
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(30, 64, 175);
      pdf.text('Séance Pédagogique', margin, yPosition);
      yPosition += 10;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Générée le ${new Date().toLocaleDateString('fr-FR')} avec ProfAssist`, margin, yPosition);
      yPosition += 6;

      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      pdf.setTextColor(0, 0, 0);
      parseMarkdownToPDF(content);

      // Pagination
      const pdfInternal = pdf.internal as any;
      const totalPages = pdfInternal.getNumberOfPages();
      
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${i} / ${totalPages}`, (pageWidth - pdf.getTextWidth(`Page ${i} / ${totalPages}`)) / 2, pageHeight - 8);
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      pdf.save(`Seance-${dateStr}-${timeStr}.pdf`);

    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert('Erreur lors de l\'export PDF.');
    } finally {
      setIsExporting(false);
    }
  };


  const renderSaveToBankButton = () => {
    if (bankAccessLoading) {
      return (
        <button
          disabled
          className="inline-flex items-center px-6 py-2 bg-gray-400 text-gray-600 rounded-xl font-semibold cursor-not-allowed opacity-60"
        >
          <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin mr-2"></div>
          Vérification...
        </button>
      );
    }

    if (!hasBankAccess) {
      return (
        <div className="relative group">
          <button
            disabled
            className="inline-flex items-center px-6 py-2 bg-gray-400 text-gray-600 rounded-xl font-semibold cursor-not-allowed opacity-60"
            title="Accès banque requis"
          >
            <Lock className="w-4 h-4 mr-2" />
            Ajouter à ma banque (accès requis)
          </button>

          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
            <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 whitespace-nowrap">
              Achetez un plan avec banque pour sauvegarder
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <button
        onClick={handleSaveToBank}
        disabled={isSaving}
        className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
      >
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? 'Sauvegarde...' : 'Ajouter à ma banque'}
      </button>
    );
  };

  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Edit className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Mode édition
            </h3>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
            >
              <X className="w-4 h-4 mr-2" />
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <Check className="w-4 h-4 mr-2" />
              Sauvegarder
            </button>
          </div>
        </div>

        <ResizableBox
          className="relative"
          height={384}
          minConstraints={[300, 200]}
          maxConstraints={[Infinity, 1200]}
          axis="y"
          resizeHandles={['se']}
        >
          <textarea
            className="w-full h-full p-6 border-2 border-gray-200 dark:border-gray-600 rounded-2xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono resize-none"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Éditez votre contenu markdown ici..."
          />
          <div className="absolute bottom-4 right-4 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">💡 Syntaxe Markdown supportée</p>
          </div>
        </ResizableBox>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Aperçu de la séance</h3>
        </div>
        <div className="flex space-x-3">
          <button onClick={() => navigator.clipboard.writeText(content)} className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200">
            <Copy className="w-4 h-4 mr-2" /> Copier
          </button>
          <button onClick={handleExportPDF} disabled={isExporting} className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all duration-200 disabled:opacity-50">
            <FileDown className="w-4 h-4 mr-2" /> {isExporting ? 'Export...' : 'PDF'}
          </button>
          {renderSaveToBankButton()}
          <button onClick={() => setIsEditing(true)} className="inline-flex items-center px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-all duration-200">
            <Edit className="w-4 h-4 mr-2" /> Modifier
          </button>
        </div>
      </div>

      {!bankAccessLoading && !hasBankAccess && (
        <div className="bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Lock className="w-6 h-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">Sauvegarde non disponible</h5>
              <p className="text-orange-700 dark:text-orange-300 text-sm">
                Votre plan actuel ne permet pas de sauvegarder les séances.
                <button onClick={() => window.location.href = '/buy-tokens'} className="underline hover:no-underline font-medium ml-1">
                  Upgrader vers un plan avec banque
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      <ResizableBox
        className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-xl overflow-auto relative"
        height={384}
        minConstraints={[300, 200]}
        maxConstraints={[Infinity, 1200]}
        axis="y"
        resizeHandles={['se']}
      >
        <div className="prose prose-sm max-w-none dark:prose-invert p-8 h-full">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-blue-200 dark:border-blue-800">{children}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">{children}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 mt-4">{children}</h3>,
              p: ({ children }) => <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-6 mb-3 text-gray-700 dark:text-gray-300">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 text-gray-700 dark:text-gray-300">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
              em: ({ children }) => <em className="italic text-gray-800 dark:text-gray-200">{children}</em>,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 my-4 bg-blue-50 dark:bg-blue-900/20 py-2 rounded-r-lg">{children}</blockquote>,
              code: ({ children }) => <code className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-sm font-mono text-blue-800 dark:text-blue-200">{children}</code>,
              pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl overflow-x-auto my-4 border border-gray-200 dark:border-gray-700">{children}</pre>,
              // ✅ COMPOSANTS TABLE MIS À JOUR
              table: ({ children }) => (
                <table className="w-full border-collapse my-4 text-sm border border-gray-300 dark:border-gray-600">
                  {children}
                </table>
              ),
              thead: ({ children }) => (
                <thead className="bg-blue-100 dark:bg-blue-900/40">{children}</thead>
              ),
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => (
                <tr className="border-b border-gray-200 dark:border-gray-700">{children}</tr>
              ),
              th: ({ children }) => (
                <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 bg-blue-50 dark:bg-blue-900/30">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                  {children}
                </td>
              ),
            }}
            // On utilise 'as any' pour contourner le conflit de types TypeScript entre les versions de vfile
            rehypePlugins={[rehypeRaw as any]} 
          >
            {convertMarkdownTablesToHtml(content)}
          </ReactMarkdown>

        </div>
      </ResizableBox>
    </div>
  );
};

export function LessonGeneratorPage() {
  const { user, loading: authLoading } = useAuthStore();
  const tokenCount = useTokenBalance();
  const [generatedContent, setGeneratedContent] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [savingToBank, setSavingToBank] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPedagogy, setSelectedPedagogy] = React.useState<string>('traditionnelle');
  const [selectedDuration, setSelectedDuration] = React.useState<string>('60');
  const [lastFormData, setLastFormData] = React.useState<LessonFormData | null>(null);

  // États pour le RAG (corpus personnel)
  const [useRag, setUseRag] = React.useState(false);
  const [folders, setFolders] = React.useState<RagFolder[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = React.useState<string[]>([]);

  // ⭐ NOUVEAUX ÉTATS POUR PDF
  const [pdfDoc, setPdfDoc] = React.useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [extractedText, setExtractedText] = React.useState<string>('');
  const [isExtracting, setIsExtracting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Charger les dossiers
  React.useEffect(() => {
    getFolders().then(setFolders).catch(console.error);
  }, []);

  // États pour vérifier l'accès banque
  const [hasBankAccess, setHasBankAccess] = React.useState<boolean | null>(null);

  // Vérification de l'accès banque au chargement
  React.useEffect(() => {
    const checkBankAccess = async () => {
      if (!user) {
        setHasBankAccess(null);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('has_bank_access')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Erreur lors de la vérification de l\'accès banque:', error);
          setHasBankAccess(false);
        } else {
          setHasBankAccess(profile?.has_bank_access || false);
        }
      } catch (err) {
        console.error('Erreur dans checkBankAccess:', err);
        setHasBankAccess(false);
      }
    };

    checkBankAccess();
  }, [user]);

  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      subject: '',
      topic: '',
      level: '',
      pedagogy_type: 'traditionnelle',
      duration: '60'
    }
  });

  // ⭐ NOUVELLE FONCTION : Extraction de texte du PDF
  const extractTextFromPDF = async (pdf: pdfjsLib.PDFDocumentProxy): Promise<string> => {
    try {
      setIsExtracting(true);
      let fullText = '';
      
      // Extraire le texte de toutes les pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }
      
      // Nettoyer et limiter le texte
      const cleanedText = fullText
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 4000); // Limiter à 4000 caractères
      
      setExtractedText(cleanedText);
      return cleanedText;
    } catch (error) {
      console.error('Erreur lors de l\'extraction du texte:', error);
      return '';
    } finally {
      setIsExtracting(false);
    }
  };

  // ⭐ NOUVELLE FONCTION : Gestion de l'upload PDF
  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(pdf);
      
      // Extraction automatique du texte
      await extractTextFromPDF(pdf);
    } catch (error) {
      console.error('Erreur lors du chargement du PDF:', error);
      alert('Erreur lors du chargement du PDF. Veuillez réessayer.');
    }
  };

  // ⭐ NOUVELLE FONCTION : Réinitialiser le PDF
  const resetPDF = () => {
    setPdfDoc(null);
    setExtractedText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ✅ FONCTION MODIFIÉE - Utilisation de secureApi avec documentContext
  const onSubmit = async (data: LessonFormData) => {
    if (!user) return;

    if (tokenCount === 0) {
      setError('INSUFFICIENT_TOKENS');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedContent('');

    try {
      // ✅ REMPLACEMENT - Appel à secureApi avec documentContext optionnel
      const result = await secureApi.generateLesson({
        subject: data.subject,
        topic: data.topic,
        level: data.level,
        pedagogy_type: data.pedagogy_type,
        duration: data.duration,
        documentContext: extractedText || undefined,
        useRag: useRag || undefined,
        folderIds: selectedFolderIds.length > 0 ? selectedFolderIds : undefined,
      });

      const content = result.content;
      if (!content) throw new Error('Réponse invalide de l\'API');

      setGeneratedContent(content);

      // ✅ MODIFICATION - Usage récupéré depuis result.usage
      const usedTokens: number = result.usage?.total_tokens ?? 0;

      // Mise à jour des tokens
      if (usedTokens > 0 && user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('tokens')
          .eq('user_id', user.id)
          .single();

        if (!profileError && profile) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              tokens: Math.max(0, (profile.tokens || 0) - usedTokens)
            })
            .eq('user_id', user.id);

          if (!updateError) {
            tokenUpdateEvent.dispatchEvent(new CustomEvent(TOKEN_UPDATED));
          }
        }
      }

      // Sauvegarde automatique en historique
      const remainingTokens = Math.max(0, (tokenCount || 0) - usedTokens);
      if (remainingTokens >= 0) {
        const { error: insertError } = await supabase.from('lessons').insert({
          user_id: user.id,
          subject: data.subject,
          topic: data.topic,
          level: data.level,
          pedagogy_type: data.pedagogy_type,
          duration: parseInt(data.duration, 10),
          content,
          created_at: new Date().toISOString()
        });
        if (insertError) console.error('Erreur lors de la sauvegarde automatique:', insertError);
      }

      setLastFormData(data);
      reset();
    } catch (err: any) {
      console.error('Erreur lors de la génération:', err);

      if (err.message === 'INSUFFICIENT_TOKENS') {
        setError('INSUFFICIENT_TOKENS');
      } else {
        setError(err.message || 'Une erreur est survenue lors de la génération.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setGeneratedContent(newContent);
  };

  // ✅ FONCTION handleSaveToBank avec vérification d'accès
  const handleSaveToBank = async (contentToSave: string) => {
    if (!user || !lastFormData) {
      alert('Impossible de sauvegarder : données du formulaire manquantes');
      return;
    }

    // Vérification accès banque
    if (!hasBankAccess) {
      const userConfirmed = confirm(
        '⚠️ Accès banque requis\n\n' +
        'Pour sauvegarder vos séances, vous devez disposer d\'un plan avec accès banque.\n\n' +
        'Souhaitez-vous consulter nos plans ?'
      );

      if (userConfirmed) {
        window.location.href = '/buy-tokens';
      }
      return;
    }

    setSavingToBank(true);
    try {
      const { error } = await supabase
        .from('lessons_bank')
        .insert({
          user_id: user.id,
          subject: lastFormData.subject,
          topic: lastFormData.topic,
          level: lastFormData.level,
          pedagogy_type: lastFormData.pedagogy_type,
          duration: parseInt(lastFormData.duration, 10),
          content: contentToSave,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 transform translate-x-0';
      successDiv.innerHTML = '✅ Séance ajoutée à votre banque !';
      document.body.appendChild(successDiv);

      setTimeout(() => {
        successDiv.style.transform = 'translateX(100%)';
        successDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(successDiv), 300);
      }, 3000);

    } catch (err: any) {
      console.error('Erreur lors de l\'enregistrement dans la banque:', err);
      alert('Erreur lors de l\'enregistrement dans la banque. Veuillez réessayer.');
    } finally {
      setSavingToBank(false);
    }
  };

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Générateur de séance
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-3">
            Créez des séances pédagogiques personnalisées et professionnelles en quelques clics
          </p>
          
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mb-6"
          >
            <Video className="w-4 h-4" />
            <span className="underline hover:no-underline">Voir un court tuto vidéo</span>
          </a>

          <p className="text-sm italic text-gray-500 dark:text-gray-400 max-w-3xl mx-auto">
            La séance générée est une aide proposée par l'IA : elle peut contenir des approximations. Elle ne remplace pas votre expertise professionnelle, mais constitue une orientation à adapter avec votre jugement.
          </p>

          {tokenCount !== null && (
            <div className={`mt-6 ${tokenCount === 0 ? 'inline-flex items-center px-6 py-3 rounded-xl shadow-lg border bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800' : 'inline-flex items-center px-6 py-3 rounded-xl shadow-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
              {tokenCount === 0 ? (
                <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
              ) : (
                <Sparkles className="w-5 h-5 text-blue-500 mr-3" />
              )}
              <span className={tokenCount === 0 ? 'text-sm font-medium text-red-700 dark:text-red-300' : 'text-sm font-medium text-gray-700 dark:text-gray-300'}>
                {tokenCount === 0 ? (
                  <span>
                    <span className="font-bold">Crédits épuisés !</span>
                    <Link to="/buy-tokens" className="ml-2 underline hover:no-underline">
                      Recharger →
                    </Link>
                  </span>
                ) : (
                  <span>
                    Crédits restants : <span className="font-bold text-blue-600 dark:text-blue-400">{tokenCount.toLocaleString()}</span> tokens
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {tokenCount === 0 && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-3xl p-8 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-4">
                Génération indisponible
              </h2>
              <p className="text-red-600 dark:text-red-400 mb-6 max-w-2xl mx-auto">
                Vous avez utilisé tous vos tokens. Pour continuer à générer des séances, veuillez recharger votre compte.
              </p>
              <Link
                to="/buy-tokens"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <CreditCard className="w-5 h-5 mr-3" />
                Recharger mes crédits
              </Link>
            </div>
          </div>
        )}

        <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 mb-8 ${tokenCount === 0 ? 'opacity-50' : ''}`}>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Paramètres de la séance
              {tokenCount === 0 && (
                <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  Indisponible
                </span>
              )}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {tokenCount === 0 ? 'Rechargez vos crédits pour générer des séances pédagogiques' : 'Configurez les détails de votre séance pédagogique'}
            </p>
          </div>
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2 mb-8">
  <div className="flex items-start">
      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
      <div>
          <h4 className="font-semibold text-amber-800 dark:text-amber-200">Conseils pour une génération optimale :</h4>
          <ul className="list-disc pl-5 mt-1 text-sm text-amber-700 dark:text-amber-300 space-y-1">
              <li>
                  <strong>Précisez votre thème :</strong> Soyez spécifique dans le champ "Thème". Mentionnez les objectifs, les compétences visées et les attendus pour un résultat plus pertinent.
              </li>
              <li>
                  <strong>Document de référence :</strong> L'ajout d'un PDF améliore grandement la qualité de la séance. Attention, son analyse peut consommer <strong>jusqu'à 4000 tokens supplémentaires</strong>.
              </li>
          </ul>
      </div>
  </div>
</div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <Target className="w-4 h-4 inline mr-2" />
                  Matière
                </label>
                <Input
                  id="subject"
                  {...register('subject')}
                  disabled={tokenCount === 0}
                  error={errors.subject?.message}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Ex: Mathématiques, Français, Histoire..."
                />
              </div>

              <div className="space-y-2">
  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
    <BookOpen className="w-4 h-4 inline mr-2" />
    Thème
  </label>
  <textarea
    id="topic"
    {...register('topic')}
    disabled={tokenCount === 0}
    rows={3}
    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
    placeholder="Ex: La description d'un lieu dans un récit  👉 Objectifs :  Comprendre l'importance de la description pour créer une atmosphère.  Identifier les procédés d'écriture (adjectifs qualificatifs, expansions du nom, verbes de perception, champs lexicaux).  S'exercer à écrire une description en suivant un plan."
  />
  {errors.topic && (
    <p className="text-sm text-red-600 mt-1 flex items-center">
      <span className="mr-1">⚠️</span>
      {errors.topic.message}
    </p>
  )}
</div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <Users className="w-4 h-4 inline mr-2" />
                  Niveau
                </label>
                <Input
                  id="level"
                  {...register('level')}
                  disabled={tokenCount === 0}
                  error={errors.level?.message}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Ex: CE2, 6ème, Terminale ..."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Durée
                </label>
                <Select
                  id="duration"
                  onChange={(e) => {
                    setSelectedDuration(e.target.value);
                    setValue('duration', e.target.value);
                  }}
                  value={selectedDuration}
                  disabled={tokenCount === 0}
                  options={durationOptions}
                  error={errors.duration?.message}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <Sparkles className="w-4 h-4 inline mr-2" />
                Type de pédagogie
              </label>
              <Select
                id="pedagogy_type"
                onChange={(e) => {
                  setSelectedPedagogy(e.target.value);
                  setValue('pedagogy_type', e.target.value);
                }}
                disabled={tokenCount === 0}
                options={pedagogies.map(p => ({ value: p.value, label: p.label }))}
                error={errors.pedagogy_type?.message}
                className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {selectedPedagogy && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                    💡 <strong>Description :</strong> {pedagogies.find(p => p.value === selectedPedagogy)?.description}
                  </p>
                </div>
              )}
            </div>

            {/* ⭐ NOUVELLE SECTION : Document de référence (optionnel) */}
            <div className="space-y-4 border-t-2 border-gray-200 dark:border-gray-600 pt-6">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  <FileText className="w-4 h-4 inline mr-2" />
                  📎 Document de référence (optionnel)
                </label>
                {pdfDoc && (
                  <button
                    onClick={resetPDF}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Supprimer le document
                  </button>
                )}
              </div>

              {!pdfDoc ? (
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 rounded-xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <div className="text-center">
                    <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Uploadez un PDF de référence (bulletin officiel, programme, manuel, exemples d'exercices...)
                      pour optimiser la génération de séance
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handlePDFUpload}
                      disabled={tokenCount === 0}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label
                      htmlFor="pdf-upload"
                      className={`inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all duration-200 ${
                        tokenCount === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Sélectionner un PDF
                    </label>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border-2 border-green-200 dark:border-green-800">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                        Document chargé ({pdfDoc.numPages} page{pdfDoc.numPages > 1 ? 's' : ''})
                      </h4>
                      {isExtracting ? (
                        <div className="flex items-center text-sm text-green-700 dark:text-green-300">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent mr-2"></div>
                          Extraction du texte en cours...
                        </div>
                      ) : (
                        <p className="text-sm text-green-700 dark:text-green-300">
                          ✓ Texte extrait ({extractedText.length} caractères) - Ce contenu sera utilisé pour enrichir la génération
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* FIN NOUVELLE SECTION */}

            {/* Options avancées - Corpus personnel */}
            <div className="border-t-2 border-gray-200 dark:border-gray-600 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Options avancées</h3>

              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <p className="font-medium text-gray-900 dark:text-white">Utiliser mon corpus documentaire personnel (cf. mon chatbot)</p>
                  </div>

                  <button type="button" disabled={tokenCount === 0} onClick={() => setUseRag(!useRag)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${useRag ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useRag ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {useRag && (
                  <div className="mt-3 pl-8 space-y-3">
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                      ✓ La génération utilisera les documents de votre corpus personnel. Si aucun contenu pertinent n'est trouvé, l'IA générera la séance à partir de ses propres connaissances.
                    </p>
                    {folders.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-2">Filtrer par dossier (optionnel) :</p>
                        <FolderSelector
                          folders={folders}
                          selectedFolderIds={selectedFolderIds}
                          onChange={setSelectedFolderIds}
                          compact
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                {error === 'INSUFFICIENT_TOKENS' ? (
                  <div className="text-center">
                    <p className="text-red-700 dark:text-red-300 font-medium mb-4">
                      ❌ Crédits insuffisants pour cette génération
                    </p>
                    <p className="text-red-600 dark:text-red-400 text-sm mb-4">
                      Cette séance nécessite plus de tokens que votre solde actuel.
                    </p>
                    <Link
                      to="/buy-tokens"
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Recharger mes crédits
                    </Link>
                  </div>
                ) : (
                  <p className="text-red-700 dark:text-red-300 font-medium">❌ {error}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || tokenCount === 0}
              className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              <span className="relative flex items-center justify-center">
                {loading ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    Génération en cours...
                  </span>
                ) : tokenCount === 0 ? (
                  <span className="flex items-center">
                    <CreditCard className="w-5 h-5 mr-3" />
                    Crédits épuisés
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Sparkles className="w-5 h-5 mr-3" />
                    Générer la séance pédagogique
                  </span>
                )}
              </span>
            </button>
          </form>
        </div>

        {generatedContent && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            <MarkdownEditor
              content={generatedContent}
              onChange={handleContentChange}
              onSaveToBank={handleSaveToBank}
              isSaving={savingToBank}
              tokensAvailable={tokenCount ?? 0}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default LessonGeneratorPage;


