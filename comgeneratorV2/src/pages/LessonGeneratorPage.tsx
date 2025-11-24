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
  Video
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
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      const addText = (text: string, fontSize: number, isBold: boolean = false, isItalic: boolean = false, marginLeft: number = 0) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = margin;
        }

        const cleanText = text
          .replace(/[📚🎯🛠️🏫⏰🚀🔍🏗️📝🎨🟢🔵♿📊💡⚠️🗣️🔄📈💻🔥💪🎯🧘]/g, '')
          .replace(/[""]/g, '"')
          .replace(/['']/g, "'")
          .replace(/…/g, '...')
          .replace(/–/g, '-')
          .replace(/—/g, '-')
          .trim();

        if (!cleanText) return;

        let fontStyle = 'normal';
        if (isBold && isItalic) fontStyle = 'bolditalic';
        else if (isBold) fontStyle = 'bold';
        else if (isItalic) fontStyle = 'italic';

        pdf.setFont('helvetica', fontStyle);
        pdf.setFontSize(fontSize);

        const availableWidth = maxWidth - marginLeft;
        const lines = pdf.splitTextToSize(cleanText, availableWidth);
        
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - 30) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line.trim(), margin + marginLeft, yPosition);
          yPosition += fontSize * 0.35 + 1;
        });

        yPosition += Math.max(2, fontSize * 0.1);
      };

      const parseMarkdownToPDF = (markdownContent: string) => {
        const lines = markdownContent.split('\n');
        let inList = false;
        let listLevel = 0;

        lines.forEach((line) => {
          const trimmedLine = line.trim();

          if (trimmedLine === '') {
            if (inList) {
              yPosition += 2;
            } else {
              yPosition += 4;
            }
            return;
          }

          if (!trimmedLine.match(/^[\s]*[-*•]\s/) && !trimmedLine.match(/^[\s]*\d+\.\s/)) {
            inList = false;
            listLevel = 0;
          }

          if (trimmedLine.startsWith('# ')) {
            const title = trimmedLine.substring(2);
            yPosition += 8;
            addText(title, 16, true);
            yPosition += 4;
          }
          else if (trimmedLine.startsWith('## ')) {
            const title = trimmedLine.substring(3);
            yPosition += 6;
            addText(title, 14, true);
            yPosition += 3;
          }
          else if (trimmedLine.startsWith('### ')) {
            const title = trimmedLine.substring(4);
            yPosition += 4;
            addText(title, 12, true);
            yPosition += 2;
          }
          else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            inList = true;
            const listItem = '• ' + trimmedLine.substring(2);
            addText(listItem, 10, false, false, 5);
          }
          else if (/^\d+\.\s/.test(trimmedLine)) {
            inList = true;
            addText(trimmedLine, 10, false, false, 5);
          }
          else if (trimmedLine.startsWith('> ')) {
            const quote = trimmedLine.substring(2);
            addText('"' + quote + '"', 10, false, true, 10);
          }
          else if (trimmedLine.includes('**')) {
            const cleanedText = trimmedLine.replace(/\*\*/g, '');
            addText(cleanedText, 10, true);
          }
          else if (trimmedLine.includes('**Niveau :**') || trimmedLine.includes('Niveau :')) {
            addText(trimmedLine.replace(/\*/g, ''), 11, true);
            yPosition += 2;
          }
          else {
            addText(trimmedLine, 10);
          }
        });
      };

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.text('Séance Pédagogique', margin, yPosition);
      yPosition += 12;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Générée le ${new Date().toLocaleDateString('fr-FR')} avec ProfAssist`, margin, yPosition);
      yPosition += 8;

      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      parseMarkdownToPDF(content);

      const pdfInternal = pdf.internal as any;
      const totalPages = pdfInternal.getNumberOfPages();
      
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        
        const pageText = `Page ${i} sur ${totalPages}`;
        const pageTextWidth = pdf.getTextWidth(pageText);
        pdf.text(pageText, (pageWidth - pageTextWidth) / 2, pageHeight - 10);
        
        pdf.setTextColor(0, 0, 0);
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      pdf.save(`Séance-${dateStr}-${timeStr}.pdf`);

    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.');
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
              pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl overflow-x-auto my-4 border border-gray-200 dark:border-gray-700">{children}</pre>
            }}
          >
            {content}
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

  // ⭐ NOUVEAUX ÉTATS POUR PDF
  const [pdfDoc, setPdfDoc] = React.useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [extractedText, setExtractedText] = React.useState<string>('');
  const [isExtracting, setIsExtracting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
        documentContext: extractedText || undefined  // ⭐ AJOUT DU CONTEXTE PDF
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
            href="https://youtube.com/shorts/j3N7ZSTlXjc" 
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
            <div className={tokenCount === 0 ? 'inline-flex items-center px-6 py-3 rounded-xl shadow-lg border bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800' : 'inline-flex items-center px-6 py-3 rounded-xl shadow-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}>
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
                  placeholder="Ex: CE2, 6ème, Terminale S..."
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


