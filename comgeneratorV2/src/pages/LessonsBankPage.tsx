import React from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import jsPDF from 'jspdf';
import { 
  BookOpen, 
  Search, 
  Filter, 
  Calendar,
  Clock,
  Users,
  Target,
  Copy,
  FileDown,
  Trash2,
  Eye,
  RotateCcw,
  Archive,
  Sparkles,
  Settings,
  CheckCircle
} from 'lucide-react';

type LessonBank = {
  id: string;
  subject: string;
  topic: string;
  level: string;
  pedagogy_type: string;
  duration: number;
  content: string;
  created_at: string;
};

const tagColors = {
  subject: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-200', border: 'border-blue-200 dark:border-blue-800' },
  level: { bg: 'bg-gray-50 dark:bg-gray-900/20', text: 'text-gray-700 dark:text-gray-200', border: 'border-gray-200 dark:border-gray-800' },
  pedagogy: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-200', border: 'border-green-200 dark:border-green-800' },
  duration: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-200', border: 'border-orange-200 dark:border-orange-800' }
};

// ✅ Fonction pour convertir les tableaux Markdown en HTML
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

export function LessonsBankPage() {
  const { user } = useAuthStore();
  const [lessons, setLessons] = React.useState<LessonBank[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<'date' | 'subject' | 'duration'>('date');
  const [filterSubject, setFilterSubject] = React.useState<string>('all');
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [exportingId, setExportingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchLessons = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('lessons_bank')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) setLessons(data);
      setLoading(false);
    };
    fetchLessons();
  }, [user]);

  const handleCopy = async (content: string, topic: string) => {
    try {
      await navigator.clipboard.writeText(content);
      
      // Success feedback
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 transform translate-x-0';
      successDiv.innerHTML = `📋 Séance "${topic}" copiée !`;
      document.body.appendChild(successDiv);
      
      setTimeout(() => {
        successDiv.style.transform = 'translateX(100%)';
        successDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(successDiv), 300);
      }, 2000);
    } catch (err) {
      console.error("Erreur lors de la copie:", err);
    }
  };

    // ✅ Export PDF CORRIGÉ - Gestion complète du markdown
  const handleExportPDF = async (lesson: LessonBank) => {
    setExportingId(lesson.id);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Fonction de nettoyage du texte (emojis, caractères spéciaux)
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

      // Vérifier si on a besoin d'une nouvelle page
      const checkNewPage = (neededHeight: number = 25) => {
        if (yPosition > pageHeight - neededHeight) {
          pdf.addPage();
          yPosition = margin;
        }
      };

      // ✅ Fonction pour écrire du texte avec segments gras/normal
      const writeTextWithBold = (text: string, fontSize: number, baseIndent: number = 0) => {
        const cleaned = cleanText(text);
        if (!cleaned) return;

        pdf.setFontSize(fontSize);
        const lineHeight = fontSize * 0.45;
        const availableWidth = maxWidth - baseIndent;

        // Découper le texte en segments (gras ou normal)
        const segments: { text: string; bold: boolean }[] = [];
        let remaining = cleaned;
        
        // Pattern pour trouver **texte** ou le texte sans **
        const boldPattern = /\*\*([^*]+)\*\*/g;
        let lastIndex = 0;
        let match;

        while ((match = boldPattern.exec(cleaned)) !== null) {
          // Texte avant le gras
          if (match.index > lastIndex) {
            segments.push({ text: cleaned.slice(lastIndex, match.index), bold: false });
          }
          // Texte en gras (sans les **)
          segments.push({ text: match[1], bold: true });
          lastIndex = match.index + match[0].length;
        }
        // Texte restant après le dernier gras
        if (lastIndex < cleaned.length) {
          segments.push({ text: cleaned.slice(lastIndex), bold: false });
        }

        // Si pas de segments (pas de gras trouvé), tout est normal
        if (segments.length === 0) {
          segments.push({ text: cleaned, bold: false });
        }

        // Reconstruire le texte complet sans les ** pour le wrapping
        const fullText = segments.map(s => s.text).join('');
        
        // Calculer les lignes avec wrapping
        pdf.setFont('helvetica', 'normal');
        const wrappedLines = pdf.splitTextToSize(fullText, availableWidth);

        wrappedLines.forEach((line: string) => {
          checkNewPage();
          
          let xPos = margin + baseIndent;
          let lineRemaining = line;
          
          // Pour chaque ligne, on doit déterminer quelles parties sont en gras
          // On parcourt les segments et on écrit chaque partie
          let charIndex = 0;
          
          // Trouver où on en est dans les segments
          for (const segment of segments) {
            if (lineRemaining.length === 0) break;
            
            const segmentText = segment.text;
            let toWrite = '';
            
            // Trouver combien de ce segment est dans cette ligne
            for (let i = 0; i < segmentText.length && lineRemaining.length > 0; i++) {
              if (segmentText[i] === lineRemaining[0]) {
                toWrite += lineRemaining[0];
                lineRemaining = lineRemaining.slice(1);
              }
            }
            
            if (toWrite) {
              pdf.setFont('helvetica', segment.bold ? 'bold' : 'normal');
              pdf.text(toWrite, xPos, yPosition);
              xPos += pdf.getTextWidth(toWrite);
            }
          }
          
          yPosition += lineHeight;
        });

        yPosition += 1;
      };

      // ✅ Fonction simplifiée pour le texte simple (sans parsing complexe)
      const addSimpleText = (text: string, fontSize: number, isBold: boolean = false, indent: number = 0) => {
        const cleaned = cleanText(text).replace(/\*\*/g, ''); // Retire les ** pour le texte simple
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

      // ✅ Fonction pour le texte avec markdown inline
      const addMarkdownText = (text: string, fontSize: number, indent: number = 0) => {
        const cleaned = cleanText(text);
        if (!cleaned) return;

        checkNewPage();
        pdf.setFontSize(fontSize);

        const availableWidth = maxWidth - indent;
        const lineHeight = fontSize * 0.45;

        // Retirer les ** pour calculer le wrapping
        const textWithoutMd = cleaned.replace(/\*\*/g, '');
        const wrappedLines = pdf.splitTextToSize(textWithoutMd, availableWidth);

        // Pour chaque ligne wrappée, on réécrit avec le bon formatage
        let globalPos = 0; // Position dans le texte original sans **

        wrappedLines.forEach((wrappedLine: string) => {
          checkNewPage();
          
          let xPos = margin + indent;
          let lineText = wrappedLine;
          
          // Trouver les parties bold dans cette ligne
          // On doit mapper la ligne wrappée au texte original avec **
          
          // Approche simple: écrire la ligne et chercher les mots en gras
          const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
          let currentLinePos = 0;
          
          parts.forEach(part => {
            if (!part) return;
            
            const isBold = part.startsWith('**') && part.endsWith('**');
            const partText = isBold ? part.slice(2, -2) : part;
            
            // Vérifier si cette partie est dans la ligne actuelle
            const partInLine = lineText.includes(partText) || 
                              partText.split(' ').some(word => lineText.includes(word));
            
            if (partInLine) {
              // Trouver quelle portion de partText est dans lineText
              let toWrite = '';
              for (const char of partText) {
                if (lineText.startsWith(char) || lineText.includes(char)) {
                  const idx = lineText.indexOf(char);
                  if (idx === 0 || idx <= 2) {
                    toWrite += char;
                    lineText = lineText.slice(idx + 1);
                  }
                }
              }
              
              if (toWrite.trim()) {
                pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
                pdf.text(toWrite, xPos, yPosition);
                xPos += pdf.getTextWidth(toWrite);
              }
            }
          });
          
          yPosition += lineHeight;
        });

        yPosition += 1;
      };

      // ✅ Fonction améliorée pour rendre les tableaux
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

      // ✅ Parser le markdown
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

          // Ligne vide
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
            // Gérer le gras dans les listes
            const cleanContent = cleanText(content).replace(/\*\*/g, '');
            const hasBold = content.includes('**');
            
            checkNewPage();
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.text('•', margin + 3, yPosition);
            
            if (hasBold && content.includes(':')) {
              // Format "**Titre :** description"
              const colonIndex = content.indexOf(':');
              const beforeColon = content.substring(0, colonIndex + 1).replace(/\*\*/g, '');
              const afterColon = content.substring(colonIndex + 1).replace(/\*\*/g, '');
              
              pdf.setFont('helvetica', 'bold');
              pdf.text(beforeColon, margin + 7, yPosition);
              const boldWidth = pdf.getTextWidth(beforeColon);
              
              pdf.setFont('helvetica', 'normal');
              const remainingWidth = maxWidth - 7 - boldWidth;
              const restLines = pdf.splitTextToSize(afterColon.trim(), remainingWidth);
              
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
          // Texte normal (avec potentiellement du gras)
          else {
            const cleaned = cleanText(trimmedLine);
            if (!cleaned) return;
            
            // Vérifier si c'est une ligne entièrement en gras
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**') && trimmedLine.indexOf('**', 2) === trimmedLine.length - 2) {
              addSimpleText(cleaned.replace(/\*\*/g, ''), 9, true);
            }
            // Ligne avec format "**Label :** valeur"
            else if (cleaned.includes(':**') || (cleaned.includes(':') && trimmedLine.includes('**'))) {
              const colonIdx = cleaned.indexOf(':');
              if (colonIdx > 0) {
                const label = cleaned.substring(0, colonIdx + 1).replace(/\*\*/g, '');
                const value = cleaned.substring(colonIdx + 1).replace(/\*\*/g, '').trim();
                
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
            // Texte simple
            else {
              addSimpleText(cleaned.replace(/\*\*/g, ''), 9, false);
            }
          }
        });

        if (inTable) {
          flushTable();
        }
      };

      // === GÉNÉRATION DU PDF ===
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(30, 64, 175);
      pdf.text('Séance Pédagogique', margin, yPosition);
      yPosition += 10;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${lesson.subject} | ${lesson.level} | ${lesson.duration} min | ${lesson.pedagogy_type}`, margin, yPosition);
      yPosition += 5;
      pdf.text(`Générée avec ProfAssist`, margin, yPosition);
      yPosition += 6;

      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      pdf.setTextColor(0, 0, 0);

      parseMarkdownToPDF(lesson.content);

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

      const safeFilename = lesson.topic
        .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      pdf.save(`Seance-${safeFilename}.pdf`);

      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-6 py-3 rounded-xl shadow-lg z-50';
      successDiv.innerHTML = 'PDF exporté !';
      document.body.appendChild(successDiv);
      setTimeout(() => { successDiv.remove(); }, 2000);

    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert('Erreur lors de l\'export PDF.');
    } finally {
      setExportingId(null);
    }
  };



  const handleDelete = async (id: string, topic: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la séance "${topic}" ?`)) {
      return;
    }

    const { error } = await supabase
      .from('lessons_bank')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erreur lors de la suppression:", error);
      return;
    }

    setLessons((prev) => prev.filter((item) => item.id !== id));
    
    // Success feedback
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 transform translate-x-0';
    successDiv.innerHTML = '🗑️ Séance supprimée !';
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.style.transform = 'translateX(100%)';
      successDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(successDiv), 300);
    }, 2000);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Filtrage et tri
  const filteredLessons = React.useMemo(() => {
    let filtered = lessons;

    // Filtre par recherche textuelle
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((l) =>
        [l.subject, l.topic, l.level, l.pedagogy_type, l.content]
          .join(' ')
          .toLowerCase()
          .includes(searchLower)
      );
    }

    // Filtre par matière
    if (filterSubject !== 'all') {
      filtered = filtered.filter(l => l.subject === filterSubject);
    }

    // Tri
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'subject':
          return a.subject.localeCompare(b.subject);
        case 'duration':
          return b.duration - a.duration;
        default:
          return 0;
      }
    });

    return filtered;
  }, [lessons, search, filterSubject, sortBy]);

  // Extraction des matières uniques pour le filtre
  const uniqueSubjects = React.useMemo(() => {
    const subjects = [...new Set(lessons.map(l => l.subject))];
    return subjects.sort();
  }, [lessons]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTruncatedContent = (content: string, maxLength: number = 300) => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Chargement de vos séances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header moderne */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Banque de séances
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Retrouvez et gérez toutes vos séances pédagogiques sauvegardées, organisées et recherchables
          </p>
          
          {/* Stats */}
          <div className="inline-flex items-center bg-white dark:bg-gray-800 px-6 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <Archive className="w-5 h-5 text-green-500 mr-3" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="font-bold text-green-600 dark:text-green-400">{lessons.length}</span> séances sauvegardées
            </span>
          </div>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            
            {/* Recherche */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par mot-clé, matière, niveau, pédagogie..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
              />
            </div>

            {/* Filtre par matière */}
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            >
              <option value="all">Toutes les matières</option>
              {uniqueSubjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            {/* Tri */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'subject' | 'duration')}
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
            >
              <option value="date">Trier par date</option>
              <option value="subject">Trier par matière</option>
              <option value="duration">Trier par durée</option>
            </select>

            {/* Toggle vue */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid' 
                    ? 'bg-white dark:bg-gray-800 text-green-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Target className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-gray-800 text-green-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Résultats de recherche */}
          {(search || filterSubject !== 'all') && (
            <div className="mt-4 flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <span className="text-sm text-green-800 dark:text-green-200">
                <strong>{filteredLessons.length}</strong> résultat(s) trouvé(s)
                {search && ` pour "${search}"`}
                {filterSubject !== 'all' && ` en ${filterSubject}`}
              </span>
              <button
                onClick={() => {
                  setSearch('');
                  setFilterSubject('all');
                }}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Contenu principal */}
        {filteredLessons.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {search || filterSubject !== 'all' ? 'Aucun résultat' : 'Aucune séance'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {search || filterSubject !== 'all'
                ? 'Essayez de modifier vos critères de recherche'
                : 'Commencez par créer des séances pour les voir apparaître ici'
              }
            </p>
            {(search || filterSubject !== 'all') && (
              <button
                onClick={() => {
                  setSearch('');
                  setFilterSubject('all');
                }}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-6'}`}>
            {filteredLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Header avec tags */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border ${tagColors.subject.bg} ${tagColors.subject.text} ${tagColors.subject.border}`}>
                    <Target className="w-3 h-3 mr-1" />
                    {lesson.subject}
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border ${tagColors.level.bg} ${tagColors.level.text} ${tagColors.level.border}`}>
                    <Users className="w-3 h-3 mr-1" />
                    {lesson.level}
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border ${tagColors.pedagogy.bg} ${tagColors.pedagogy.text} ${tagColors.pedagogy.border}`}>
                    <Settings className="w-3 h-3 mr-1" />
                    {lesson.pedagogy_type}
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border ${tagColors.duration.bg} ${tagColors.duration.text} ${tagColors.duration.border}`}>
                    <Clock className="w-3 h-3 mr-1" />
                    {lesson.duration} min
                  </div>
                </div>

                {/* Titre et date */}
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex-1 mr-4">
                    {lesson.topic}
                  </h2>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(lesson.created_at)}
                  </div>
                </div>

                {/* Contenu avec support tableaux */}
                <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden mb-4">
                  <div className={`prose prose-sm max-w-none dark:prose-invert p-6 ${
                    expandedItems.has(lesson.id) ? '' : 'max-h-96 overflow-hidden'
                  }`}>
                    <ReactMarkdown
                      rehypePlugins={[rehypeRaw as any]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-blue-200 dark:border-blue-800">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 mt-4">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-6 mb-3 text-gray-700 dark:text-gray-300">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-6 mb-3 text-gray-700 dark:text-gray-300">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="mb-1">
                            {children}
                          </li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-gray-900 dark:text-gray-100">
                            {children}
                          </strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic text-gray-800 dark:text-gray-200">
                            {children}
                          </em>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 my-4 bg-blue-50 dark:bg-blue-900/20 py-2 rounded-r-lg">
                            {children}
                          </blockquote>
                        ),
                        code: ({ children }) => (
                          <code className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-sm font-mono text-blue-800 dark:text-blue-200">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl overflow-x-auto my-4 border border-gray-200 dark:border-gray-700">
                            {children}
                          </pre>
                        ),
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
                    >
                      {convertMarkdownTablesToHtml(
                        expandedItems.has(lesson.id) 
                          ? lesson.content 
                          : getTruncatedContent(lesson.content, viewMode === 'grid' ? 200 : 300)
                      )}
                    </ReactMarkdown>
                  </div>
                  
                  {lesson.content.length > (viewMode === 'grid' ? 200 : 300) && (
                    <div className="px-6 pb-4">
                      <button
                        onClick={() => toggleExpanded(lesson.id)}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium flex items-center bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-200"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {expandedItems.has(lesson.id) ? 'Réduire' : 'Voir plus'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Séance complète
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleCopy(lesson.content, lesson.topic)}
                      className="inline-flex items-center px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200"
                      title="Copier la séance"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copier
                    </button>
                    
                    <button
                      onClick={() => handleExportPDF(lesson)}
                      disabled={exportingId === lesson.id}
                      className="inline-flex items-center px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all duration-200 disabled:opacity-50"
                      title="Exporter en PDF"
                    >
                      <FileDown className="w-4 h-4 mr-1" />
                      {exportingId === lesson.id ? 'Export...' : 'PDF'}
                    </button>
                    
                    <button
                      onClick={() => handleDelete(lesson.id, lesson.topic)}
                      className="inline-flex items-center px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all duration-200"
                      title="Supprimer la séance"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LessonsBankPage;

