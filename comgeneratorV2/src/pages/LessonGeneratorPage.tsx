import React from 'react';
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
  ShoppingCart
} from 'lucide-react';

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

  // ✅ AJOUT : États pour vérifier l'accès banque
  const [hasBankAccess, setHasBankAccess] = React.useState<boolean | null>(null);
  const [bankAccessLoading, setBankAccessLoading] = React.useState(true);
  const { user } = useAuthStore();

  // ✅ AJOUT : Vérification de l'accès banque au chargement
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

  // ✅ MODIFICATION : Fonction de sauvegarde avec vérification d'accès
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

      const addText = (text: string, fontSize: number, isBold: boolean = false, isItalic: boolean = false) => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = margin;
        }

        let fontStyle = 'normal';
        if (isBold && isItalic) fontStyle = 'bolditalic';
        else if (isBold) fontStyle = 'bold';
        else if (isItalic) fontStyle = 'italic';

        pdf.setFont('helvetica', fontStyle);
        pdf.setFontSize(fontSize);

        const lines = pdf.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line, margin, yPosition);
          yPosition += fontSize * 0.5 + 2;
        });
        yPosition += 3;
      };

      const parseMarkdownToPDF = (markdownContent: string) => {
        const lines = markdownContent.split('\n');

        lines.forEach((line, _index) => {
          const trimmedLine = line.trim();

          if (trimmedLine === '') {
            yPosition += 3;
            return;
          }

          if (trimmedLine.startsWith('# ')) {
            const title = trimmedLine.substring(2);
            addText(title, 16, true);
            yPosition += 3;
          }
          else if (trimmedLine.startsWith('## ')) {
            const title = trimmedLine.substring(3);
            addText(title, 14, true);
            yPosition += 2;
          }
          else if (trimmedLine.startsWith('### ')) {
            const title = trimmedLine.substring(4);
            addText(title, 12, true);
            yPosition += 1;
          }
          else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            const listItem = '• ' + trimmedLine.substring(2);
            addText(listItem, 10);
          }
          else if (/^\d+\.\s/.test(trimmedLine)) {
            addText(trimmedLine, 10);
          }
          else if (trimmedLine.startsWith('> ')) {
            const quote = trimmedLine.substring(2);
            addText('"' + quote + '"', 10, false, true);
          }
          else {
            let processedText = trimmedLine;

            if (processedText.includes('**')) {
              const parts = processedText.split(/\*\*(.*?)\*\*/g);
              let currentText = '';

              for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 0) {
                  currentText += parts[i];
                } else {
                  currentText += parts[i];
                }
              }
              addText(currentText, 10);
            } else {
              addText(processedText, 10);
            }
          }
        });
      };

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('Séance Pédagogique', margin, yPosition);
      yPosition += 10;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Générée le ${new Date().toLocaleDateString('fr-FR')}`, margin, yPosition);
      yPosition += 10;

      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      parseMarkdownToPDF(content);

      const pdfInternal = pdf.internal as any;
      const totalPages = pdfInternal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text(
          `Page ${i} sur ${totalPages}`,
          pageWidth - margin - 20,
          pageHeight - 10
        );
      }

      const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
      pdf.save(`seance-pedagogique-${date}.pdf`);

    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.');
    } finally {
      setIsExporting(false);
    }
  };

  // ✅ AJOUT : Fonction pour rendre le bouton de sauvegarde conditionnel
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

          {/* ✅ TOOLTIP EXPLICATIF */}
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
        <div className="relative">
          <textarea
            className="w-full h-96 p-6 border-2 border-gray-200 dark:border-gray-600 rounded-2xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono resize-none transition-all duration-200"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Éditez votre contenu markdown ici..."
          />
          <div className="absolute bottom-4 right-4 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              💡 Syntaxe Markdown supportée
            </p>
          </div>
        </div>
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
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Aperçu de la séance
          </h3>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => navigator.clipboard.writeText(content)}
            className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copier
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all duration-200 disabled:opacity-50"
          >
            <FileDown className="w-4 h-4 mr-2" />
            {isExporting ? 'Export...' : 'PDF'}
          </button>

          {/* ✅ BOUTON DE SAUVEGARDE CONDITIONNEL */}
          {renderSaveToBankButton()}

          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-all duration-200"
          >
            <Edit className="w-4 h-4 mr-2" />
            Modifier
          </button>
        </div>
      </div>

      {/* ✅ ALERTE POUR UTILISATEURS SANS ACCÈS BANQUE */}
      {!bankAccessLoading && !hasBankAccess && (
        <div className="bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Lock className="w-6 h-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">
                Sauvegarde non disponible
              </h5>
              <p className="text-orange-700 dark:text-orange-300 text-sm">
                Votre plan actuel ne permet pas de sauvegarder les séances.
                <button
                  onClick={() => window.location.href = '/buy-tokens'}
                  className="underline hover:no-underline font-medium ml-1"
                >
                  Upgrader vers un plan avec banque
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
        <div className="prose prose-sm max-w-none dark:prose-invert p-8 overflow-auto max-h-96">
          <ReactMarkdown
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
              )
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
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
  const [selectedPedagogy, setSelectedPedagogy] = React.useState<string>('');
  const [selectedDuration, setSelectedDuration] = React.useState<string>('60');
  const [lastFormData, setLastFormData] = React.useState<LessonFormData | null>(null);

  // ✅ AJOUT : États pour vérifier l'accès banque
  const [hasBankAccess, setHasBankAccess] = React.useState<boolean | null>(null);

  // ✅ AJOUT : Vérification de l'accès banque au chargement
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
      pedagogy_type: '',
      duration: '60'
    }
  });

  const onSubmit = async (data: LessonFormData) => {
    if (!user) return;

    if (tokenCount === 0) {
      setError('INSUFFICIENT_TOKENS');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedContent('');

    const pedagogyDescription = pedagogies.find(p => p.value === data.pedagogy_type)?.description ?? data.pedagogy_type;

    const prompt = `Tu es un expert en ingénierie pédagogique et en didactique, spécialisé dans la conception de séances d'enseignement primaire et secondaire.

**CONTEXTE DE LA SÉANCE :**
- Matière : ${data.subject}
- Thème/Notion : ${data.topic}
- Niveau : ${data.level}
- Durée : ${data.duration} minutes
- Approche pédagogique : ${pedagogyDescription}

**CONSIGNES DE STRUCTURATION :**
Génère une séance pédagogique complète et directement exploitable en respectant OBLIGATOIREMENT cette structure Markdown :

# 📚 [Titre accrocheur de la séance]
**Niveau :** ${data.level} | **Durée :** ${data.duration} min | **Matière :** ${data.subject}

## 🎯 Objectifs et compétences visées
### Objectifs d'apprentissage
- [3-4 objectifs précis et mesurables]

### Compétences du socle/programmes officiels
- [Références aux programmes en vigueur]

## 🛠️ Matériel et supports nécessaires
### Pour l'enseignant
- [Liste détaillée]

### Pour les élèves
- [Liste détaillée]

${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ?
`### Espace et terrain
- [Configuration spatiale nécessaire]
- [Matériel sportif requis]` : ''}

## 🏫 Organisation spatiale de la classe
> **💡 Configuration adaptée à la pédagogie ${data.pedagogy_type}**
- [Description précise de l'aménagement de l'espace selon la pédagogie choisie]
- [Disposition des élèves, des tables, des espaces de travail]

## ⏰ Déroulé détaillé de la séance

### 🚀 **Phase 1 : Accroche/Situation déclenchante** - [X minutes]
> **Modalité :** [Individuel/Groupe/Collectif]

**Activité :** [Description précise de l'activité]

**Rôle de l'enseignant :** [Actions concrètes de l'enseignant]

**Rôle des élèves :** [Actions attendues des élèves]

---

### 🔍 **Phase 2 : [Nom de la phase]** - [X minutes]
> **Modalité :** [Individuel/Groupe/Collectif]

**Activité :** [Description précise de l'activité]

**Rôle de l'enseignant :** [Actions concrètes de l'enseignant]

**Rôle des élèves :** [Actions attendues des élèves]

---

### 🏗️ **Phase 3 : [Nom de la phase]** - [X minutes]
> **Modalité :** [Individuel/Groupe/Collectif]

**Activité :** [Description précise de l'activité]

**Rôle de l'enseignant :** [Actions concrètes de l'enseignant]

**Rôle des élèves :** [Actions attendues des élèves]

---

### 📝 **Phase 4 : Synthèse/Institutionnalisation** - [X minutes]
> **Modalité :** [Individuel/Groupe/Collectif]

**Activité :** [Description précise de l'activité]

**Rôle de l'enseignant :** [Actions concrètes de l'enseignant]

**Rôle des élèves :** [Actions attendues des élèves]

## 🎨 Différenciation et adaptations

### 🟢 Pour les élèves en difficulté
- [3-4 adaptations concrètes]

### 🔵 Pour les élèves à l'aise
- [3-4 enrichissements possibles]

### ♿ Adaptations inclusives
- [Adaptations pour élèves à besoins particuliers]

## 📊 Évaluation et critères de réussite

### Critères de réussite observables
- **Critère 1 :** [Comportement/production attendue]
- **Critère 2 :** [Comportement/production attendue]
- **Critère 3 :** [Comportement/production attendue]

### Modalités d'évaluation
- [Formative/Sommative/Auto-évaluation/Etc.]

## 💡 Conseils pratiques et anticipation

### ⚠️ Points de vigilance
- [Difficultés prévisibles et solutions]

### 🗣️ Questions types à poser
- [5-6 questions pour guider les élèves]

### 🔄 Variantes possibles
- [Adaptations selon le contexte]

## 📈 Prolongements possibles
- **Séance suivante :** [Piste pour la continuité]
- **Interdisciplinarité :** [Liens avec d'autres matières]
- **À la maison :** [Travail personnel éventuel]

---
> **💻 Ressources numériques :** [Sites, apps, outils TICE recommandés]
> **📚 Pour aller plus loin :** [Ressources pédagogiques complémentaires]

**EXIGENCES QUALITÉ :**
1. Chaque timing doit être précis et la somme doit correspondre à ${data.duration} minutes
2. Les activités doivent être concrètes et directement réalisables
3. La pédagogie ${data.pedagogy_type} doit être clairement visible dans les modalités
4. Les consignes aux élèves doivent être formulées simplement
5. Prévoir des transitions fluides entre les phases
6. Intégrer des éléments de différenciation naturelle

Génère maintenant cette séance en respectant scrupuleusement cette structure et en étant très concret dans toutes les descriptions.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        })
      });

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new Error('Réponse invalide de l\'API OpenAI');

      setGeneratedContent(content);

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

  // ✅ MODIFICATION : Fonction handleSaveToBank avec vérification d'accès
  const handleSaveToBank = async (contentToSave: string) => {
    if (!user || !lastFormData) {
      alert('Impossible de sauvegarder : données du formulaire manquantes');
      return;
    }

    // ✅ VÉRIFICATION ACCÈS BANQUE
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
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Créez des séances pédagogiques personnalisées et professionnelles en quelques clics
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
                <Input
                  id="topic"
                  {...register('topic')}
                  disabled={tokenCount === 0}
                  error={errors.topic?.message}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Ex: Les fractions, La Renaissance, L'écosystème..."
                />
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


