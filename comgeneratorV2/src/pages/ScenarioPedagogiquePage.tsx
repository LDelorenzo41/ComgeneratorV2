// src/pages/ScenarioPedagogiquePage.tsx
// Fonctionnalité "Scénario pédagogique" - Vision macro de séquence

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useAuthStore } from '../lib/store';
import { secureApi } from '../lib/secureApi';
import { TOKEN_UPDATED, tokenUpdateEvent } from '../components/layout/Header';
import useTokenBalance from '../hooks/useTokenBalance';
import { supabase } from '../lib/supabase';
import { extractTextFromFile, formatFileSize } from '../lib/documentExtractor';
import {
  Map,
  Copy,
  RefreshCw,
  Sparkles,
  AlertCircle,
  CreditCard,
  Target,
  BookOpen,
  Users,
  Layers,
  Clock,
  Database,
  Check,
  FileDown,
  Save,
  Edit,
  X,
  Lock,
  Upload,
  FileText,
  Trash2,
  BookMarked,
  Info
} from 'lucide-react';

// ============================================================================
// OPTIONS DE FORMULAIRE
// ============================================================================

const nombreSeancesOptions = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 2).toString(),
  label: `${i + 2} séances`,
}));

const dureeSeanceOptions = [
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '55', label: '55 minutes' },
  { value: '60', label: '1 heure' },
  { value: '90', label: '1h30' },
  { value: '120', label: '2 heures' },
];

// ============================================================================
// SCHÉMA DE VALIDATION
// ============================================================================

const scenarioSchema = z.object({
  matiere: z.string().min(1, 'La matière est requise'),
  niveau: z.string().min(1, 'Le niveau est requis'),
  theme: z.string().min(10, 'Le thème doit contenir au moins 10 caractères'),
  pointDepart: z.string().min(10, 'Le point de départ doit contenir au moins 10 caractères'),
  attendus: z.string().min(10, 'Les attendus doivent contenir au moins 10 caractères'),
  nombreSeances: z.enum(nombreSeancesOptions.map(o => o.value) as [string, ...string[]]),
  dureeSeance: z.enum(dureeSeanceOptions.map(o => o.value) as [string, ...string[]]),
  useRag: z.boolean().default(false),
});

type ScenarioFormData = z.infer<typeof scenarioSchema>;

// ============================================================================
// INTERFACES
// ============================================================================

interface SeanceRow {
  numero: string;
  objectifs: string;
  attendus: string;
  prerequis: string;
  exemples: string;
}

interface RagSource {
  document_name: string;
  chunk_content: string;
  similarity: number;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function ScenarioPedagogiquePage() {
  const { user, loading: authLoading } = useAuthStore();
  const tokenCount = useTokenBalance();
  
  // États
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = React.useState<string>('');
  const [parsedRows, setParsedRows] = React.useState<SeanceRow[]>([]);
  const [copied, setCopied] = React.useState(false);
  const [useRag, setUseRag] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editableRows, setEditableRows] = React.useState<SeanceRow[]>([]);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [lastFormData, setLastFormData] = React.useState<ScenarioFormData | null>(null);
  
  // État pour les notes complémentaires (contenu après le tableau)
  const [additionalNotes, setAdditionalNotes] = React.useState<string>('');
  
  // États pour les sources RAG
  const [ragSources, setRagSources] = React.useState<RagSource[]>([]);
  
  // États pour les fichiers uploadés
  const [uploadedFiles, setUploadedFiles] = React.useState<File[]>([]);
  const [extractedTexts, setExtractedTexts] = React.useState<string[]>([]);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [extractionError, setExtractionError] = React.useState<string | null>(null);
  
  // États pour vérifier l'accès banque
  const [hasBankAccess, setHasBankAccess] = React.useState<boolean | null>(null);
  const [bankAccessLoading, setBankAccessLoading] = React.useState(true);
  
  // États pour les Select
  const [selectedNombreSeances, setSelectedNombreSeances] = React.useState<string>('6');
  const [selectedDureeSeance, setSelectedDureeSeance] = React.useState<string>('55');

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

  // Formulaire
  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<ScenarioFormData>({
    resolver: zodResolver(scenarioSchema),
    defaultValues: {
      matiere: '',
      niveau: '',
      theme: '',
      pointDepart: '',
      attendus: '',
      nombreSeances: '6',
      dureeSeance: '55',
      useRag: false,
    },
  });

  // ============================================================================
  // GESTION DE L'UPLOAD DE FICHIERS
  // ============================================================================

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsExtracting(true);
    setExtractionError(null);

    const newFiles: File[] = [];
    const newTexts: string[] = [];

    for (const file of Array.from(files)) {
      // Vérifier la taille (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setExtractionError(`Le fichier ${file.name} dépasse 10MB`);
        continue;
      }

      try {
        const text = await extractTextFromFile(file);
        newFiles.push(file);
        newTexts.push(text);
      } catch (err: any) {
        setExtractionError(err.message || `Erreur lors de l'extraction de ${file.name}`);
      }
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    setExtractedTexts(prev => [...prev, ...newTexts]);
    setIsExtracting(false);
    
    // Reset input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setExtractedTexts(prev => prev.filter((_, i) => i !== index));
  };

  // ============================================================================
  // PARSING DU TABLEAU MARKDOWN (VERSION ROBUSTE)
  // ============================================================================

  const parseMarkdownTable = (content: string): SeanceRow[] => {
    const rows: SeanceRow[] = [];
    const lines = content.split('\n');
    let inTable = false;
    let headerFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Détecter l'en-tête du tableau
      if (!headerFound && trimmed.startsWith('|') && 
          (trimmed.toLowerCase().includes('séance') || trimmed.toLowerCase().includes('seance'))) {
        headerFound = true;
        inTable = true;
        continue;
      }
      
      // Ignorer la ligne de séparation (|---|---|...)
      if (trimmed.match(/^\|[\s\-:|\s]+\|$/)) {
        continue;
      }
      
      // Parser les lignes de données
      if (inTable && trimmed.startsWith('|') && trimmed.endsWith('|')) {
        // Extraire le contenu entre les premiers et derniers |
        const innerContent = trimmed.slice(1, -1);
        
        // Découper en utilisant | mais en préservant les | échappés ou dans du texte
        const cells: string[] = [];
        let currentCell = '';
        let depth = 0; // Pour gérer les parenthèses, crochets, etc.
        
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
        // Ajouter la dernière cellule
        if (currentCell.trim()) {
          cells.push(currentCell.trim());
        }
        
        // Vérifier si c'est une ligne de données valide (au moins 5 colonnes)
        if (cells.length >= 5) {
          const firstCell = cells[0].trim();
          
          // Accepter : "1", "Séance 1", "S1", ou tout ce qui contient un chiffre
          if (firstCell.match(/\d+/) || firstCell.toLowerCase().includes('séance') || firstCell.toLowerCase().includes('seance')) {
            rows.push({
              numero: firstCell,
              objectifs: cells[1] || '',
              attendus: cells[2] || '',
              prerequis: cells[3] || '',
              exemples: cells.slice(4).join(' | '), // Joindre les colonnes excédentaires
            });
          }
        }
      }
      
      // Sortir du tableau si on rencontre une ligne vide ou du texte hors tableau
      // MAIS seulement si on a déjà trouvé des lignes
      if (inTable && rows.length > 0 && !trimmed.startsWith('|') && trimmed !== '' && !trimmed.startsWith('#')) {
        // Vérifier si c'est vraiment la fin du tableau ou juste une ligne de commentaire
        const nextLine = lines[i + 1]?.trim() || '';
        if (!nextLine.startsWith('|')) {
          inTable = false;
        }
      }
    }
    
    console.log(`[parseMarkdownTable] Parsed ${rows.length} rows from content`);
    return rows;
  };

  // ============================================================================
  // EXTRACTION DES NOTES COMPLÉMENTAIRES (APRÈS LE TABLEAU)
  // ============================================================================

  const extractAdditionalNotes = (content: string): string => {
    const lines = content.split('\n');
    let inTable = false;
    let tableEnded = false;
    let notesStartIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      
      // Détecter le début du tableau
      if (trimmed.startsWith('|') && trimmed.toLowerCase().includes('séance')) {
        inTable = true;
      }
      
      // Détecter la fin du tableau
      if (inTable && !trimmed.startsWith('|') && trimmed !== '') {
        tableEnded = true;
        notesStartIndex = i;
        break;
      }
    }
    
    if (tableEnded && notesStartIndex > 0) {
      const notes = lines.slice(notesStartIndex).join('\n').trim();
      // Nettoyer les notes (enlever les lignes vides multiples)
      return notes.replace(/\n{3,}/g, '\n\n');
    }
    
    return '';
  };

  // ============================================================================
  // CONVERSION DES ROWS EN MARKDOWN
  // ============================================================================

  const rowsToMarkdown = (rows: SeanceRow[]): string => {
    let md = '| Séance | Objectifs d\'apprentissage | Attendus / critères de réussite | Prérequis pour la suite | Exemples de situations |\n';
    md += '|--------|---------------------------|--------------------------------|------------------------|------------------------|\n';
    
    rows.forEach(row => {
      md += `| ${row.numero} | ${row.objectifs} | ${row.attendus} | ${row.prerequis} | ${row.exemples} |\n`;
    });
    
    return md;
  };

  // ============================================================================
  // RENDU MARKDOWN POUR L'AFFICHAGE À L'ÉCRAN
  // ============================================================================

  const renderMarkdown = (text: string): React.ReactNode => {
    if (!text) return null;
    
    // Convertir le markdown en éléments React
    let processedText = text
      // Convertir <br> en marqueur temporaire
      .replace(/<br\s*\/?>/gi, '{{BR}}');
    
    // Découper par les sauts de ligne
    const parts = processedText.split('{{BR}}');
    
    return parts.map((part, index) => {
      // Traiter le gras et l'italique
      const elements: React.ReactNode[] = [];
      let remaining = part;
      let keyCounter = 0;
      
      // Regex pour trouver les patterns markdown
      const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
      let lastIndex = 0;
      let match;
      
      while ((match = regex.exec(part)) !== null) {
        // Ajouter le texte avant le match
        if (match.index > lastIndex) {
          elements.push(part.substring(lastIndex, match.index));
        }
        
        // Ajouter l'élément formaté
        if (match[2]) {
          // ***text*** = gras + italique
          elements.push(
            <strong key={`bi-${index}-${keyCounter++}`}>
              <em>{match[2]}</em>
            </strong>
          );
        } else if (match[3]) {
          // **text** = gras
          elements.push(<strong key={`b-${index}-${keyCounter++}`}>{match[3]}</strong>);
        } else if (match[4]) {
          // *text* = italique
          elements.push(<em key={`i-${index}-${keyCounter++}`}>{match[4]}</em>);
        } else if (match[5]) {
          // `code` = code inline
          elements.push(
            <code key={`c-${index}-${keyCounter++}`} className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-sm">
              {match[5]}
            </code>
          );
        }
        
        lastIndex = regex.lastIndex;
      }
      
      // Ajouter le reste du texte
      if (lastIndex < part.length) {
        elements.push(part.substring(lastIndex));
      }
      
      // Retourner avec ou sans <br>
      return (
        <React.Fragment key={index}>
          {elements.length > 0 ? elements : part}
          {index < parts.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  // ============================================================================
  // NETTOYAGE DU MARKDOWN POUR LE PDF
  // ============================================================================

  const cleanMarkdownForPDF = (text: string): string => {
    if (!text) return '';
    
    return text
      // Remplacer <br> et variantes par des sauts de ligne
      .replace(/<br\s*\/?>/gi, '\n')
      // Supprimer le gras markdown **text** → text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      // Supprimer l'italique markdown *text* → text
      .replace(/\*([^*]+)\*/g, '$1')
      // Supprimer le gras/italique ***text*** → text
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      // Supprimer les backticks `code` → code
      .replace(/`([^`]+)`/g, '$1')
      // Supprimer les liens markdown [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Supprimer les titres markdown ## text → text
      .replace(/^#{1,6}\s+/gm, '')
      // Nettoyer les doubles espaces
      .replace(/  +/g, ' ')
      // Nettoyer les doubles sauts de ligne
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // ============================================================================
  // SOUMISSION DU FORMULAIRE
  // ============================================================================

  const onSubmit = async (data: ScenarioFormData) => {
    if (!user) return;

    if (tokenCount === 0) {
      setError('INSUFFICIENT_TOKENS');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedContent('');
    setParsedRows([]);
    setRagSources([]);
    setAdditionalNotes('');
    setIsEditing(false);

    try {
      // Combiner les textes extraits des documents
      const documentsContent = extractedTexts.length > 0 
        ? extractedTexts.join('\n\n---\n\n') 
        : undefined;

      const result = await secureApi.generateScenario({
        matiere: data.matiere,
        niveau: data.niveau,
        theme: data.theme,
        pointDepart: data.pointDepart,
        attendus: data.attendus,
        nombreSeances: parseInt(data.nombreSeances, 10),
        dureeSeance: parseInt(data.dureeSeance, 10),
        useRag: data.useRag,
        documentsContent,
        documentNames: uploadedFiles.map(f => f.name),
      });

      const content = result.content;
      if (!content) throw new Error('Réponse invalide de l\'API');

      setGeneratedContent(content);

      console.log('=== RAW CONTENT FROM API ===');
      console.log(content);
      console.log('=== END RAW CONTENT ===');
      
      const rows = parseMarkdownTable(content);
      setParsedRows(rows);
      setEditableRows(rows);
      setLastFormData(data);

      // Extraire les notes complémentaires
      const notes = extractAdditionalNotes(content);
      setAdditionalNotes(notes);

      // Capturer les sources RAG si disponibles
      if (result.sources && result.sources.length > 0) {
        setRagSources(result.sources);
      }

      // Mise à jour des tokens
      const usedTokens: number = result.usage?.total_tokens ?? 0;

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

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCopy = async () => {
    try {
      const contentToCopy = isEditing ? rowsToMarkdown(editableRows) : generatedContent;
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  const handleNewScenario = () => {
    setGeneratedContent('');
    setParsedRows([]);
    setEditableRows([]);
    setRagSources([]);
    setAdditionalNotes('');
    setUploadedFiles([]);
    setExtractedTexts([]);
    setSelectedNombreSeances('6');
    setSelectedDureeSeance('55');
    setUseRag(false);
    setIsEditing(false);
    setLastFormData(null);
    reset();
  };

  // ============================================================================
  // ÉDITION
  // ============================================================================

  const handleStartEdit = () => {
    setEditableRows([...parsedRows]);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditableRows([...parsedRows]);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    setParsedRows([...editableRows]);
    setGeneratedContent(rowsToMarkdown(editableRows));
    setIsEditing(false);
  };

  const handleCellChange = (rowIndex: number, field: keyof SeanceRow, value: string) => {
    const newRows = [...editableRows];
    newRows[rowIndex] = { ...newRows[rowIndex], [field]: value };
    setEditableRows(newRows);
  };

  // ============================================================================
  // EXPORT PDF (FORMAT PAYSAGE) - VERSION COMPLÈTE SANS TRONCATURE
  // ============================================================================

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' = landscape
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;
      
      // Titre
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('Scénario pédagogique', margin, 15);
      
      // Sous-titre avec infos
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      if (lastFormData) {
        pdf.text(`${lastFormData.matiere} - ${lastFormData.niveau} | ${lastFormData.nombreSeances} séances de ${lastFormData.dureeSeance} min`, margin, 22);
        pdf.text(`Thème : ${lastFormData.theme.substring(0, 120)}${lastFormData.theme.length > 120 ? '...' : ''}`, margin, 27);
      }
      pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} avec ProfAssist`, margin, 32);
      
      // Ligne séparatrice
      pdf.setLineWidth(0.3);
      pdf.line(margin, 35, pageWidth - margin, 35);
      
      // Configuration du tableau
      const rowsData = isEditing ? editableRows : parsedRows;
      const colWidths = [18, 50, 50, 45, 104]; // Total = 267 (A4 paysage = 297 - 2*15 marges)
      const headers = ['Séance', 'Objectifs', 'Attendus', 'Prérequis', 'Exemples d\'activités'];
      const minRowHeight = 8;
      const cellPadding = 2;
      const fontSize = 7;
      const lineHeightFactor = 3.5;
      
      let yPos = 40;
      
      // Fonction pour calculer la hauteur d'une ligne en fonction du contenu
      const calculateRowHeight = (row: SeanceRow): number => {
        pdf.setFontSize(fontSize);
        const cellData = [row.numero, row.objectifs, row.attendus, row.prerequis, row.exemples];
        let maxLines = 1;
        
        cellData.forEach((text, i) => {
          const maxWidth = colWidths[i] - 2 * cellPadding;
          const cleanedText = cleanMarkdownForPDF(text || '');
          const lines = pdf.splitTextToSize(cleanedText, maxWidth);
          if (lines.length > maxLines) maxLines = lines.length;
        });
        
        return Math.max(minRowHeight, maxLines * lineHeightFactor + 2 * cellPadding);
      };
      
      // Fonction pour dessiner l'en-tête du tableau
      const drawTableHeader = () => {
        pdf.setFillColor(99, 102, 241); // Indigo
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
      
      // Dessiner l'en-tête initial
      drawTableHeader();
      
      // Dessiner chaque ligne du tableau
      rowsData.forEach((row, index) => {
        const rowHeight = calculateRowHeight(row);
        
        // Vérifier si on doit changer de page
        if (yPos + rowHeight > pageHeight - 15) {
          pdf.addPage();
          yPos = 15;
          drawTableHeader();
        }
        
        // Fond alterné
        if (index % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, yPos, contentWidth, rowHeight, 'F');
        }
        
        // Bordures de la ligne
        pdf.setDrawColor(220, 220, 220);
        pdf.rect(margin, yPos, contentWidth, rowHeight, 'S');
        
        // Bordures verticales des colonnes
        let xBorder = margin;
        colWidths.forEach((width, i) => {
          if (i < colWidths.length - 1) {
            xBorder += width;
            pdf.line(xBorder, yPos, xBorder, yPos + rowHeight);
          }
        });
        
        // Contenu des cellules
        pdf.setFontSize(fontSize);
        let xPos = margin + cellPadding;
        const cellData = [row.numero, row.objectifs, row.attendus, row.prerequis, row.exemples];
        
        cellData.forEach((text, i) => {
          const maxWidth = colWidths[i] - 2 * cellPadding;
          const cleanedText = cleanMarkdownForPDF(text || '');
          const lines = pdf.splitTextToSize(cleanedText, maxWidth);
          
          // Dessiner toutes les lignes (pas de limite)
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

      // ========================================================================
      // NOTES COMPLÉMENTAIRES (si présentes)
      // ========================================================================
      
      if (additionalNotes) {
        // Nouvelle page pour les notes
        pdf.addPage();
        yPos = 15;
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(99, 102, 241);
        pdf.text('Notes complémentaires', margin, yPos);
        yPos += 10;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
        
        const cleanedNotes = cleanMarkdownForPDF(additionalNotes);
        const notesLines = pdf.splitTextToSize(cleanedNotes, contentWidth);
        notesLines.forEach((line: string) => {
          if (yPos > pageHeight - 15) {
            pdf.addPage();
            yPos = 15;
          }
          pdf.text(line, margin, yPos);
          yPos += 4;
        });
      }

      // ========================================================================
      // PAGE DES SOURCES RAG (si disponibles)
      // ========================================================================
      
      if (ragSources.length > 0) {
        pdf.addPage();
        yPos = 15;
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(99, 102, 241);
        pdf.text('Sources et Références', margin, yPos);
        yPos += 8;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Documents institutionnels utilisés pour enrichir ce scénario', margin, yPos);
        yPos += 8;
        
        pdf.setTextColor(0, 0, 0);
        
        ragSources.forEach((source, index) => {
          if (yPos + 25 > pageHeight - 15) {
            pdf.addPage();
            yPos = 15;
          }
          
          // Nom du document
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.text(`${index + 1}. ${source.document_name}`, margin, yPos);
          
          // Score
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(7);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Pertinence: ${(source.similarity * 100).toFixed(0)}%`, margin, yPos + 4);
          
          // Contenu
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(60, 60, 60);
          const excerpt = source.chunk_content.substring(0, 500) + (source.chunk_content.length > 500 ? '...' : '');
          const lines = pdf.splitTextToSize(excerpt, contentWidth);
          lines.slice(0, 6).forEach((line: string, lineIndex: number) => {
            pdf.text(line, margin, yPos + 9 + (lineIndex * 3.5));
          });
          
          pdf.setTextColor(0, 0, 0);
          yPos += 12 + Math.min(lines.length, 6) * 3.5 + 5;
        });
      }
      
      // Pied de page sur toutes les pages
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      }
      
      // Téléchargement
      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '-');
      pdf.save(`Scenario-${lastFormData?.matiere || 'pedagogique'}-${dateStr}.pdf`);
      
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.');
    } finally {
      setIsExporting(false);
    }
  };

  // ============================================================================
  // SAUVEGARDE EN BANQUE
  // ============================================================================

  const handleSaveToBank = async () => {
    if (!user || !lastFormData) {
      alert('Impossible de sauvegarder : données du formulaire manquantes');
      return;
    }

    if (!hasBankAccess) {
      const userConfirmed = confirm(
        '⚠️ Accès banque requis\n\n' +
        'Pour sauvegarder vos scénarios, vous devez disposer d\'un plan avec accès banque.\n\n' +
        'Souhaitez-vous consulter nos plans ?'
      );

      if (userConfirmed) {
        window.location.href = '/buy-tokens';
      }
      return;
    }

    setIsSaving(true);
    try {
      const contentToSave = isEditing ? rowsToMarkdown(editableRows) : generatedContent;
      
      const { error } = await (supabase as any)
        .from('scenarios_bank')
        .insert({
          user_id: user.id,
          matiere: lastFormData.matiere,
          niveau: lastFormData.niveau,
          theme: lastFormData.theme,
          nombre_seances: parseInt(lastFormData.nombreSeances, 10),
          duree_seance: parseInt(lastFormData.dureeSeance, 10),
          content: contentToSave,
          sources: ragSources.length > 0 ? JSON.stringify(ragSources) : null,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Notification de succès
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300';
      successDiv.innerHTML = '✅ Scénario ajouté à votre banque !';
      document.body.appendChild(successDiv);

      setTimeout(() => {
        successDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(successDiv), 300);
      }, 3000);

    } catch (err: any) {
      console.error('Erreur lors de l\'enregistrement:', err);
      alert('Erreur lors de l\'enregistrement. Veuillez réessayer.');
    } finally {
      setIsSaving(false);
    }
  };

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
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Map className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Scénario pédagogique
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-3">
            Générez une vision macro de votre séquence pédagogique en quelques clics
          </p>
          
          <p className="text-sm italic text-gray-500 dark:text-gray-400 max-w-3xl mx-auto">
            Le scénario généré est une aide proposée par l'IA : il ne remplace pas votre expertise professionnelle, mais constitue une orientation à adapter avec votre jugement.
          </p>

          {tokenCount !== null && (
            <div className={`mt-6 inline-flex items-center px-6 py-3 rounded-xl shadow-lg border ${
              tokenCount === 0 
                ? 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}>
              {tokenCount === 0 ? (
                <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
              ) : (
                <Sparkles className="w-5 h-5 text-indigo-500 mr-3" />
              )}
              <span className={`text-sm font-medium ${
                tokenCount === 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'
              }`}>
                {tokenCount === 0 ? (
                  <span>
                    <span className="font-bold">Crédits épuisés !</span>
                    <Link to="/buy-tokens" className="ml-2 underline hover:no-underline">Recharger →</Link>
                  </span>
                ) : (
                  <span>
                    Crédits restants : <span className="font-bold text-indigo-600 dark:text-indigo-400">{tokenCount.toLocaleString()}</span> tokens
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Alerte tokens épuisés */}
        {tokenCount === 0 && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-3xl p-8 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-4">Génération indisponible</h2>
              <p className="text-red-600 dark:text-red-400 mb-6 max-w-2xl mx-auto">
                Vous avez utilisé tous vos tokens. Pour continuer à générer des scénarios, veuillez recharger votre compte.
              </p>
              <Link to="/buy-tokens" className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
                <CreditCard className="w-5 h-5 mr-3" />
                Recharger mes crédits
              </Link>
            </div>
          </div>
        )}

        {/* Formulaire */}
        <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 mb-8 ${tokenCount === 0 ? 'opacity-50' : ''}`}>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Paramètres de la séquence
              {tokenCount === 0 && (
                <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Indisponible</span>
              )}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {tokenCount === 0 ? 'Rechargez vos crédits pour générer des scénarios' : 'Décrivez votre séquence pédagogique en détail'}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Matière et Niveau */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <Target className="w-4 h-4 inline mr-2" />Matière *
                </label>
                <Input {...register('matiere')} disabled={tokenCount === 0} error={errors.matiere?.message} placeholder="Ex: Mathématiques, Français, EPS..." className="border-2 border-gray-200 dark:border-gray-600 rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <Users className="w-4 h-4 inline mr-2" />Niveau *
                </label>
                <Input {...register('niveau')} disabled={tokenCount === 0} error={errors.niveau?.message} placeholder="Ex: CE2, 6ème, Terminale ..." className="border-2 border-gray-200 dark:border-gray-600 rounded-xl" />
              </div>
            </div>

            {/* Thème */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <BookOpen className="w-4 h-4 inline mr-2" />Thème précis et détaillé *
              </label>
              <textarea {...register('theme')} disabled={tokenCount === 0} rows={3} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed resize-none" placeholder="Ex: La Révolution française - De la crise de l'Ancien Régime à l'exécution de Louis XVI..." />
              {errors.theme && <p className="text-sm text-red-600 mt-1">⚠️ {errors.theme.message}</p>}
            </div>

            {/* Point de départ */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <Layers className="w-4 h-4 inline mr-2" />Point de départ *
              </label>
              <textarea {...register('pointDepart')} disabled={tokenCount === 0} rows={3} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed resize-none" placeholder="Ex: Les élèves ont déjà étudié... Classe hétérogène avec..." />
              {errors.pointDepart && <p className="text-sm text-red-600 mt-1">⚠️ {errors.pointDepart.message}</p>}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Diagnostic, vécu des élèves, contraintes de contexte...</p>
            </div>

            {/* Attendus */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <Target className="w-4 h-4 inline mr-2" />Attendus et/ou objectifs *
              </label>
              <textarea {...register('attendus')} disabled={tokenCount === 0} rows={3} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed resize-none" placeholder="Ex: Comprendre les causes... Identifier les acteurs..." />
              {errors.attendus && <p className="text-sm text-red-600 mt-1">⚠️ {errors.attendus.message}</p>}
            </div>

            {/* Découpage */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <Layers className="w-4 h-4 inline mr-2" />Nombre de séances *
                </label>
                <Select
                  id="nombreSeances"
                  onChange={(e) => { setSelectedNombreSeances(e.target.value); setValue('nombreSeances', e.target.value); }}
                  value={selectedNombreSeances}
                  disabled={tokenCount === 0}
                  options={nombreSeancesOptions}
                  error={errors.nombreSeances?.message}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />Durée des séances *
                </label>
                <Select
                  id="dureeSeance"
                  onChange={(e) => { setSelectedDureeSeance(e.target.value); setValue('dureeSeance', e.target.value); }}
                  value={selectedDureeSeance}
                  disabled={tokenCount === 0}
                  options={dureeSeanceOptions}
                  error={errors.dureeSeance?.message}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl"
                />
              </div>
            </div>

            {/* Upload de documents supports */}
            <div className="border-t-2 border-gray-200 dark:border-gray-600 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Documents supports (optionnel)</h3>
              
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-3 mb-4">
                  <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Ajouter des documents</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Textes, exercices ou ressources à intégrer dans le scénario (PDF, DOCX, TXT - max 10MB)
                    </p>
                  </div>
                </div>

                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={isExtracting || tokenCount === 0}
                />
                <label
                  htmlFor="file-upload"
                  className={`flex items-center justify-center px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    isExtracting || tokenCount === 0
                      ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-50'
                      : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20'
                  }`}
                >
                  {isExtracting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent mr-2"></div>
                      <span className="text-sm text-gray-500">Extraction en cours...</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-blue-500 mr-2" />
                      <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Cliquez pour ajouter des fichiers</span>
                    </>
                  )}
                </label>

                {extractionError && (
                  <p className="mt-2 text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {extractionError}
                  </p>
                )}

                {/* Liste des fichiers uploadés */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white dark:bg-gray-700 rounded-lg px-3 py-2 shadow-sm">
                        <div className="flex items-center min-w-0">
                          <FileText className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">({formatFileSize(file.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700 ml-2 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      ✓ {uploadedFiles.length} document(s) prêt(s) à être intégré(s) au scénario
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Options avancées - Toggle RAG */}
            <div className="border-t-2 border-gray-200 dark:border-gray-600 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Options avancées</h3>
              
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Utiliser les ressources officielles (RAG)</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Connecter la génération aux textes officiels</p>
                    </div>
                  </div>
                  
                  <button type="button" disabled={tokenCount === 0} onClick={() => { setUseRag(!useRag); setValue('useRag', !useRag); }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${useRag ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useRag ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                
                {useRag && (
                  <div className="mt-3 pl-8 text-sm text-indigo-700 dark:text-indigo-300">
                    ✓ La génération utilisera les programmes officiels pour enrichir le scénario
                  </div>
                )}
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                {error === 'INSUFFICIENT_TOKENS' ? (
                  <div className="text-center">
                    <p className="text-red-700 dark:text-red-300 font-medium mb-4">❌ Crédits insuffisants</p>
                    <Link to="/buy-tokens" className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl">
                      <CreditCard className="w-4 h-4 mr-2" />Recharger mes crédits
                    </Link>
                  </div>
                ) : (
                  <p className="text-red-700 dark:text-red-300 font-medium">❌ {error}</p>
                )}
              </div>
            )}

            {/* Bouton de soumission */}
            <button type="submit" disabled={loading || tokenCount === 0}
              className="w-full group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-purple-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              <span className="relative flex items-center justify-center">
                {loading ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    Génération en cours...
                  </span>
                ) : tokenCount === 0 ? (
                  <span className="flex items-center"><CreditCard className="w-5 h-5 mr-3" />Crédits épuisés</span>
                ) : (
                  <span className="flex items-center"><Sparkles className="w-5 h-5 mr-3" />Générer le scénario pédagogique</span>
                )}
              </span>
            </button>
          </form>
        </div>

        {/* Résultat - Tableau */}
        {generatedContent && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            
            {/* En-tête du résultat */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <Map className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isEditing ? 'Mode édition' : 'Votre scénario pédagogique'}
                </h3>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {isEditing ? (
                  <>
                    <button onClick={handleCancelEdit} className="inline-flex items-center px-4 py-2 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                      <X className="w-4 h-4 mr-2" />Annuler
                    </button>
                    <button onClick={handleSaveEdit} className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-all">
                      <Check className="w-4 h-4 mr-2" />Valider
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleCopy} className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                      {copied ? <><Check className="w-4 h-4 mr-2 text-green-500" />Copié !</> : <><Copy className="w-4 h-4 mr-2" />Copier</>}
                    </button>
                    <button onClick={handleExportPDF} disabled={isExporting} className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all disabled:opacity-50">
                      <FileDown className="w-4 h-4 mr-2" />{isExporting ? 'Export...' : 'PDF'}
                    </button>
                    <button onClick={handleStartEdit} className="inline-flex items-center px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-all">
                      <Edit className="w-4 h-4 mr-2" />Modifier
                    </button>
                    
                    {/* Bouton Banque */}
                    {bankAccessLoading ? (
                      <button disabled className="inline-flex items-center px-4 py-2 bg-gray-400 text-gray-600 rounded-xl font-medium cursor-not-allowed opacity-60">
                        <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Vérification...
                      </button>
                    ) : !hasBankAccess ? (
                      <button onClick={handleSaveToBank} className="inline-flex items-center px-4 py-2 bg-gray-400 text-gray-600 rounded-xl font-medium opacity-60" title="Accès banque requis">
                        <Lock className="w-4 h-4 mr-2" />Banque (accès requis)
                      </button>
                    ) : (
                      <button onClick={handleSaveToBank} disabled={isSaving} className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50">
                        <Save className="w-4 h-4 mr-2" />{isSaving ? 'Sauvegarde...' : 'Ajouter à ma banque'}
                      </button>
                    )}
                    
                    <button onClick={handleNewScenario} className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all">
                      <RefreshCw className="w-4 h-4 mr-2" />Nouveau
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Alerte accès banque */}
            {!bankAccessLoading && !hasBankAccess && !isEditing && (
              <div className="mb-6 bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-6 h-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">Sauvegarde non disponible</h5>
                    <p className="text-orange-700 dark:text-orange-300 text-sm">
                      Votre plan actuel ne permet pas de sauvegarder les scénarios.
                      <button onClick={() => window.location.href = '/buy-tokens'} className="underline hover:no-underline font-medium ml-1">
                        Upgrader vers un plan avec banque
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tableau */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider w-20">Séance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Objectifs</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Attendus</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Prérequis</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Exemples</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {(isEditing ? editableRows : parsedRows).length > 0 ? (
                    (isEditing ? editableRows : parsedRows).map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white align-top">
                          {isEditing ? (
                            <input type="text" value={row.numero} onChange={(e) => handleCellChange(index, 'numero', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                          ) : row.numero}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 align-top">
                          {isEditing ? (
                            <textarea value={row.objectifs} onChange={(e) => handleCellChange(index, 'objectifs', e.target.value)} rows={3}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none" />
                          ) : renderMarkdown(row.objectifs)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 align-top">
                          {isEditing ? (
                            <textarea value={row.attendus} onChange={(e) => handleCellChange(index, 'attendus', e.target.value)} rows={3}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none" />
                          ) : renderMarkdown(row.attendus)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 align-top">
                          {isEditing ? (
                            <textarea value={row.prerequis} onChange={(e) => handleCellChange(index, 'prerequis', e.target.value)} rows={3}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none" />
                          ) : renderMarkdown(row.prerequis)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 align-top">
                          {isEditing ? (
                            <textarea value={row.exemples} onChange={(e) => handleCellChange(index, 'exemples', e.target.value)} rows={3}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none" />
                          ) : renderMarkdown(row.exemples)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-4">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono">{generatedContent}</pre>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Section Notes Complémentaires */}
            {additionalNotes && !isEditing && (
              <div className="mt-8 border-t-2 border-gray-200 dark:border-gray-600 pt-6">
                <div className="flex items-center space-x-3 mb-4">
                  <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">Notes complémentaires</h4>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
                      {additionalNotes}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Section Sources RAG */}
            {ragSources.length > 0 && !isEditing && (
              <div className="mt-8 border-t-2 border-gray-200 dark:border-gray-600 pt-6">
                <div className="flex items-center space-x-3 mb-4">
                  <BookMarked className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">Sources et Références</h4>
                </div>
                
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-4">
                  <div className="flex items-start space-x-2">
                    <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                      Ces documents institutionnels ont été utilisés pour enrichir votre scénario. 
                      Ils sont également inclus dans l'export PDF.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {ragSources.map((source, index) => (
                    <div key={index} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-semibold text-gray-900 dark:text-white flex items-center">
                          <FileText className="w-4 h-4 text-indigo-500 mr-2" />
                          {source.document_name}
                        </h5>
                        <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full">
                          Pertinence: {(source.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                        {source.chunk_content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>💡 Conseil :</strong> Ce scénario est une vision macro de votre séquence. 
                Vous pouvez ensuite utiliser le générateur de séances pour détailler chaque séance individuellement.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScenarioPedagogiquePage;





