// src/pages/ScenariosBankPage.tsx
// Page "Banque de scénarios" - Affichage et gestion des scénarios sauvegardés

import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import {
  Map,
  Search,
  FileDown,
  Trash2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  BookOpen,
  Users,
  AlertCircle,
  Loader2,
  FolderOpen,
  ArrowLeft
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ScenarioItem {
  id: string;
  user_id: string;
  matiere: string;
  niveau: string;
  theme: string;
  nombre_seances: number;
  duree_seance: number;
  content: string;
  sources?: string;
  created_at: string;
}

interface SeanceRow {
  numero: string;
  objectifs: string;
  attendus: string;
  prerequis: string;
  exemples: string;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function ScenariosBankPage() {
  const { user, loading: authLoading } = useAuthStore();
  
  // États
  const [scenarios, setScenarios] = React.useState<ScenarioItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Charger les scénarios
  React.useEffect(() => {
    const fetchScenarios = async () => {
      if (!user) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await (supabase as any)
          .from('scenarios_bank')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        setScenarios(data as ScenarioItem[] || []);
      } catch (err: any) {
        console.error('Erreur lors du chargement des scénarios:', err);
        setError(err.message || 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };
    
    fetchScenarios();
  }, [user]);

  // ============================================================================
  // PARSING DU TABLEAU MARKDOWN
  // ============================================================================

  const parseMarkdownTable = (content: string): SeanceRow[] => {
    const rows: SeanceRow[] = [];
    const lines = content.split('\n');
    let inTable = false;
    let headerFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (!headerFound && trimmed.startsWith('|') && 
          (trimmed.toLowerCase().includes('séance') || trimmed.toLowerCase().includes('seance'))) {
        headerFound = true;
        inTable = true;
        continue;
      }
      
      if (trimmed.match(/^\|[\s\-:|\s]+\|$/)) {
        continue;
      }
      
      if (inTable && trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const innerContent = trimmed.slice(1, -1);
        const cells: string[] = [];
        let currentCell = '';
        let depth = 0;
        
        for (let j = 0; j < innerContent.length; j++) {
          const char = innerContent[j];
          
          if (char === '(' || char === '[' || char === '{') depth++;
          if (char === ')' || char === ']' || char === '}') depth--;
          
          if (char === '|' && depth === 0) {
            cells.push(currentCell.trim());
            currentCell = '';
          } else {
            currentCell += char;
          }
        }
        if (currentCell.trim()) {
          cells.push(currentCell.trim());
        }
        
        if (cells.length >= 5) {
          const firstCell = cells[0].trim();
          
          if (firstCell.match(/\d+/) || firstCell.toLowerCase().includes('séance') || firstCell.toLowerCase().includes('seance')) {
            rows.push({
              numero: firstCell,
              objectifs: cells[1] || '',
              attendus: cells[2] || '',
              prerequis: cells[3] || '',
              exemples: cells.slice(4).join(' | '),
            });
          }
        }
      }
      
      if (inTable && rows.length > 0 && !trimmed.startsWith('|') && trimmed !== '' && !trimmed.startsWith('#')) {
        const nextLine = lines[i + 1]?.trim() || '';
        if (!nextLine.startsWith('|')) {
          inTable = false;
        }
      }
    }
    
    return rows;
  };

  // ============================================================================
  // RENDU MARKDOWN POUR L'ÉCRAN (gras, italique, retours à la ligne)
  // ============================================================================

  const renderMarkdown = (text: string): React.ReactNode => {
    if (!text) return null;

    // Remplacer les <br> par un marqueur temporaire
    let processedText = text.replace(/<br\s*\/?>/gi, '{{BR}}');
    const parts = processedText.split('{{BR}}');

    return parts.map((part, index) => {
      const elements: React.ReactNode[] = [];
      // Regex pour bold+italic, bold, italic, code
      const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
      let lastIndex = 0;
      let match;
      let keyCounter = 0;

      while ((match = regex.exec(part)) !== null) {
        // Ajouter le texte avant le match
        if (match.index > lastIndex) {
          elements.push(part.substring(lastIndex, match.index));
        }

        if (match[2]) {
          // Bold + italic (***text***)
          elements.push(<strong key={`bi-${index}-${keyCounter++}`}><em>{match[2]}</em></strong>);
        } else if (match[3]) {
          // Bold (**text**)
          elements.push(<strong key={`b-${index}-${keyCounter++}`}>{match[3]}</strong>);
        } else if (match[4]) {
          // Italic (*text*)
          elements.push(<em key={`i-${index}-${keyCounter++}`}>{match[4]}</em>);
        } else if (match[5]) {
          // Code (`text`)
          elements.push(<code key={`c-${index}-${keyCounter++}`} className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-sm">{match[5]}</code>);
        }

        lastIndex = regex.lastIndex;
      }

      // Ajouter le reste du texte
      if (lastIndex < part.length) {
        elements.push(part.substring(lastIndex));
      }

      return (
        <React.Fragment key={index}>
          {elements.length > 0 ? elements : part}
          {index < parts.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  // ============================================================================
  // NETTOYAGE DU MARKDOWN (pour PDF)
  // ============================================================================

  const cleanMarkdown = (text: string): string => {
    if (!text) return '';
    
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/  +/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // ============================================================================
  // SUPPRESSION D'UN SCÉNARIO
  // ============================================================================

  const handleDelete = async (id: string, theme: string) => {
    const confirmed = window.confirm(
      `⚠️ Supprimer ce scénario ?\n\n"${theme}"\n\nCette action est irréversible.`
    );
    
    if (!confirmed) return;
    
    setDeletingId(id);
    
    try {
      const { error } = await (supabase as any)
        .from('scenarios_bank')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      
      if (error) throw error;
      
      // Retirer de l'affichage
      setScenarios(prev => prev.filter(s => s.id !== id));
      
      // Si c'était le scénario développé, le fermer
      if (expandedId === id) {
        setExpandedId(null);
      }
      
      // Notification
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50';
      successDiv.innerHTML = '✅ Scénario supprimé';
      document.body.appendChild(successDiv);
      setTimeout(() => {
        successDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(successDiv), 300);
      }, 2000);
      
    } catch (err: any) {
      console.error('Erreur lors de la suppression:', err);
      alert('Erreur lors de la suppression. Veuillez réessayer.');
    } finally {
      setDeletingId(null);
    }
  };

  // ============================================================================
  // EXPORT PDF
  // ============================================================================

  const handleExportPDF = (scenario: ScenarioItem) => {
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;
    
    // Titre
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Scénario pédagogique', margin, 15);
    
    // Infos
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`${scenario.matiere} - ${scenario.niveau} | ${scenario.nombre_seances} séances de ${scenario.duree_seance} min`, margin, 22);
    pdf.text(`Thème : ${scenario.theme.substring(0, 120)}${scenario.theme.length > 120 ? '...' : ''}`, margin, 27);
    pdf.text(`Généré le ${new Date(scenario.created_at).toLocaleDateString('fr-FR')} avec ProfAssist`, margin, 32);
    
    pdf.setLineWidth(0.3);
    pdf.line(margin, 35, pageWidth - margin, 35);
    
    // Tableau
    const rows = parseMarkdownTable(scenario.content);
    const colWidths = [18, 50, 50, 45, 104];
    const headers = ['Séance', 'Objectifs', 'Attendus', 'Prérequis', 'Exemples'];
    const fontSize = 7;
    const lineHeightFactor = 3.5;
    const cellPadding = 2;
    const minRowHeight = 8;
    
    let yPos = 40;
    
    const calculateRowHeight = (row: SeanceRow): number => {
      pdf.setFontSize(fontSize);
      const cellData = [row.numero, row.objectifs, row.attendus, row.prerequis, row.exemples];
      let maxLines = 1;
      
      cellData.forEach((text, i) => {
        const maxWidth = colWidths[i] - 2 * cellPadding;
        const cleanedText = cleanMarkdown(text || '');
        const lines = pdf.splitTextToSize(cleanedText, maxWidth);
        if (lines.length > maxLines) maxLines = lines.length;
      });
      
      return Math.max(minRowHeight, maxLines * lineHeightFactor + 2 * cellPadding);
    };
    
    const drawTableHeader = () => {
      pdf.setFillColor(99, 102, 241);
      pdf.rect(margin, yPos, contentWidth, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      
      let xPos = margin + cellPadding;
      headers.forEach((header, i) => {
        pdf.text(header, xPos, yPos + 5.5);
        xPos += colWidths[i];
      });
      
      yPos += 8;
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
    };
    
    drawTableHeader();
    
    rows.forEach((row, index) => {
      const rowHeight = calculateRowHeight(row);
      
      if (yPos + rowHeight > pageHeight - 15) {
        pdf.addPage();
        yPos = 15;
        drawTableHeader();
      }
      
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, yPos, contentWidth, rowHeight, 'F');
      }
      
      pdf.setDrawColor(220, 220, 220);
      pdf.rect(margin, yPos, contentWidth, rowHeight, 'S');
      
      let xBorder = margin;
      colWidths.forEach((width, i) => {
        if (i < colWidths.length - 1) {
          xBorder += width;
          pdf.line(xBorder, yPos, xBorder, yPos + rowHeight);
        }
      });
      
      pdf.setFontSize(fontSize);
      let xPos = margin + cellPadding;
      const cellData = [row.numero, row.objectifs, row.attendus, row.prerequis, row.exemples];
      
      cellData.forEach((text, i) => {
        const maxWidth = colWidths[i] - 2 * cellPadding;
        const cleanedText = cleanMarkdown(text || '');
        const lines = pdf.splitTextToSize(cleanedText, maxWidth);
        
        lines.forEach((line: string, lineIndex: number) => {
          const textY = yPos + cellPadding + 2.5 + (lineIndex * lineHeightFactor);
          if (textY < yPos + rowHeight - cellPadding) {
            pdf.text(line, xPos, textY);
          }
        });
        
        xPos += colWidths[i];
      });
      
      yPos += rowHeight;
    });
    
    // Pied de page
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    }
    
    const dateStr = new Date(scenario.created_at).toLocaleDateString('fr-FR').replace(/\//g, '-');
    pdf.save(`Scenario-${scenario.matiere}-${dateStr}.pdf`);
  };

  // ============================================================================
  // FILTRAGE
  // ============================================================================

  const filteredScenarios = scenarios.filter(scenario => {
    const search = searchTerm.toLowerCase();
    return (
      scenario.matiere.toLowerCase().includes(search) ||
      scenario.niveau.toLowerCase().includes(search) ||
      scenario.theme.toLowerCase().includes(search)
    );
  });

  // ============================================================================
  // GUARDS
  // ============================================================================

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  // ============================================================================
  // RENDU
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-900 dark:via-indigo-900/20 dark:to-purple-900/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
              <FolderOpen className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Banque de scénarios
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Retrouvez et gérez vos scénarios pédagogiques sauvegardés
          </p>
        </div>

        {/* Barre de recherche et actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par matière, niveau ou thème..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <Link
            to="/scenario-pedagogique"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Nouveau scénario
          </Link>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Chargement...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        ) : filteredScenarios.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
            <Map className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {searchTerm ? 'Aucun résultat' : 'Aucun scénario sauvegardé'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm 
                ? 'Essayez avec d\'autres termes de recherche'
                : 'Créez votre premier scénario pédagogique et sauvegardez-le ici'
              }
            </p>
            {!searchTerm && (
              <Link
                to="/scenario-pedagogique"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transition-all"
              >
                <Map className="w-5 h-5 mr-2" />
                Créer un scénario
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredScenarios.map((scenario) => {
              const isExpanded = expandedId === scenario.id;
              const rows = isExpanded ? parseMarkdownTable(scenario.content) : [];
              
              return (
                <div
                  key={scenario.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* En-tête du scénario */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded">
                            {scenario.matiere}
                          </span>
                          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-medium rounded">
                            {scenario.niveau}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">
                          {scenario.theme}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <BookOpen className="w-4 h-4 mr-1" />
                            {scenario.nombre_seances} séances
                          </span>
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {scenario.duree_seance} min
                          </span>
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(scenario.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportPDF(scenario);
                          }}
                          className="p-2 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                          title="Exporter en PDF"
                        >
                          <FileDown className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(scenario.id, scenario.theme);
                          }}
                          disabled={deletingId === scenario.id}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                          title="Supprimer"
                        >
                          {deletingId === scenario.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Trash2 className="w-5 h-5" />
                          )}
                        </button>
                        <div className="p-2 text-gray-400">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contenu étendu */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                      {rows.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase w-16">Séance</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase">Objectifs</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase">Attendus</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase">Prérequis</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase">Exemples</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {rows.map((row, index) => (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">{renderMarkdown(row.numero)}</td>
                                  <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{renderMarkdown(row.objectifs)}</td>
                                  <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{renderMarkdown(row.attendus)}</td>
                                  <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{renderMarkdown(row.prerequis)}</td>
                                  <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{renderMarkdown(row.exemples)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                          {scenario.content}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Compteur */}
        {!loading && !error && filteredScenarios.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {filteredScenarios.length} scénario{filteredScenarios.length > 1 ? 's' : ''} 
            {searchTerm && ` trouvé${filteredScenarios.length > 1 ? 's' : ''}`}
          </div>
        )}
      </div>
    </div>
  );
}

export default ScenariosBankPage;


