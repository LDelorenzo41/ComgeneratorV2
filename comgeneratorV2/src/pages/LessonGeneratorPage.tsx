import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
// Import correct pour jsPDF v2.x
import jsPDF from 'jspdf';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { TOKEN_UPDATED, tokenUpdateEvent } from '../components/layout/Header';

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

// Créneaux de 45 min à 180 min par pas de 15 min
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

// Composant éditeur markdown avec prévisualisation
const MarkdownEditor: React.FC<{
  content: string;
  onChange: (content: string) => void;
  onSaveToBank: (content: string) => void;
  isSaving?: boolean;
}> = ({ content, onChange, onSaveToBank, isSaving = false }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(content);
  const [isExporting, setIsExporting] = React.useState(false);

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

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Fonction pour ajouter du texte avec gestion des sauts de page
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
        yPosition += 3; // Espacement après le texte
      };

      // Fonction pour parser le markdown et convertir en PDF
      const parseMarkdownToPDF = (markdownContent: string) => {
        const lines = markdownContent.split('\n');
        
        lines.forEach((line, _index) => {
          const trimmedLine = line.trim();
          
          if (trimmedLine === '') {
            yPosition += 3;
            return;
          }
          
          // Titres H1
          if (trimmedLine.startsWith('# ')) {
            const title = trimmedLine.substring(2);
            addText(title, 16, true);
            yPosition += 3;
          }
          // Titres H2
          else if (trimmedLine.startsWith('## ')) {
            const title = trimmedLine.substring(3);
            addText(title, 14, true);
            yPosition += 2;
          }
          // Titres H3
          else if (trimmedLine.startsWith('### ')) {
            const title = trimmedLine.substring(4);
            addText(title, 12, true);
            yPosition += 1;
          }
          // Listes à puces
          else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            const listItem = '• ' + trimmedLine.substring(2);
            addText(listItem, 10);
          }
          // Listes numérotées (basique)
          else if (/^\d+\.\s/.test(trimmedLine)) {
            addText(trimmedLine, 10);
          }
          // Citations
          else if (trimmedLine.startsWith('> ')) {
            const quote = trimmedLine.substring(2);
            addText('"' + quote + '"', 10, false, true);
          }
          // Texte avec formatage basique
          else {
            let processedText = trimmedLine;
            
            // Gérer le gras **texte** (simple)
            if (processedText.includes('**')) {
              const parts = processedText.split(/\*\*(.*?)\*\*/g);
              let currentText = '';
              
              for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 0) {
                  currentText += parts[i]; // Texte normal
                } else {
                  // Pour simplifier, on garde le texte en gras mais on ne peut pas mixer
                  // dans une même ligne avec jsPDF basique
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

      // En-tête du document
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('Séance Pédagogique', margin, yPosition);
      yPosition += 10;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Générée le ${new Date().toLocaleDateString('fr-FR')}`, margin, yPosition);
      yPosition += 10;
      
      // Ligne de séparation
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      // Contenu principal
      parseMarkdownToPDF(content);

      // Pied de page sur chaque page
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

      // Télécharger le PDF
      const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
      pdf.save(`seance-pedagogique-${date}.pdf`);
      
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Mode édition
          </h3>
          <div className="space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSave}
            >
              Sauvegarder
            </Button>
          </div>
        </div>
        <textarea
          className="w-full h-96 p-4 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 font-mono"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          placeholder="Éditez votre contenu markdown ici..."
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          💡 Utilisez la syntaxe Markdown : **gras**, *italique*, # Titre, - Liste, etc.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Aperçu de la séance
        </h3>
        <div className="space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigator.clipboard.writeText(content)}
          >
            📋 Copier
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? '⏳ Export...' : '📄 PDF'}
          </Button>
          <Button
            type="button"
            onClick={() => onSaveToBank(content)}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? '⏳ Sauvegarde...' : '💾 Ajouter à ma banque'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEditing(true)}
          >
            ✏️ Modifier
          </Button>
        </div>
      </div>
      <div className="prose prose-sm max-w-none dark:prose-invert bg-gray-50 dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-auto max-h-96">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
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
              <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 my-4">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto my-4">
                {children}
              </pre>
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export function LessonGeneratorPage() {
  const { user, loading: authLoading } = useAuthStore();
  const [tokenCount, setTokenCount] = React.useState<number | null>(null);
  const [generatedContent, setGeneratedContent] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [savingToBank, setSavingToBank] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPedagogy, setSelectedPedagogy] = React.useState<string>('');
  const [selectedDuration, setSelectedDuration] = React.useState<string>('60'); // Valeur initiale 60 min
  const [lastFormData, setLastFormData] = React.useState<LessonFormData | null>(null);

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

  const fetchTokenCount = React.useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setTokenCount(data?.tokens ?? 0);
    } catch (err) {
      console.error('Erreur lors de la récupération du solde de tokens:', err);
    }
  }, [user]);

  React.useEffect(() => {
    fetchTokenCount();
  }, [fetchTokenCount]);

  React.useEffect(() => {
    const handleTokenUpdate = () => {
      fetchTokenCount();
    };
    tokenUpdateEvent.addEventListener(TOKEN_UPDATED, handleTokenUpdate);
    return () => {
      tokenUpdateEvent.removeEventListener(TOKEN_UPDATED, handleTokenUpdate);
    };
  }, [fetchTokenCount]);

  const onSubmit = async (data: LessonFormData) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setGeneratedContent('');

    const pedagogyDescription = pedagogies.find(p => p.value === data.pedagogy_type)?.description ?? data.pedagogy_type;

    const prompt = `Tu es un expert de l'enseignement primaire et secondaire, spécialiste en didactique et en pédagogie. Génère une **séance pédagogique complète** d'une durée de ${data.duration} minutes pour un cours de ${data.subject} avec une classe de niveau ${data.level}, selon la pédagogie suivante : ${pedagogyDescription}. Le **thème** de cette séance est : **${data.topic}**. Structure la séance avec un **objectif clair**, une **mise en activité**, une **phase principale**, une **évaluation finale** et **des prolongements éventuels**. Adopte un style **pédagogique clair, structuré et directement exploitable**. Formate ta réponse en Markdown avec des titres, sous-titres et listes pour une meilleure lisibilité.`;

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
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw new Error("Impossible de vérifier votre solde de tokens");
      if ((profile?.tokens ?? 0) < usedTokens) throw new Error('Solde de tokens insuffisant');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ tokens: (profile.tokens || 0) - usedTokens })
        .eq('user_id', user.id);
      if (updateError) throw new Error('Échec de la mise à jour du solde de tokens');

      tokenUpdateEvent.dispatchEvent(new CustomEvent(TOKEN_UPDATED));

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
      if (insertError) throw insertError;

      // Sauvegarder les données du formulaire pour la banque de séances
      setLastFormData(data);
      reset();
    } catch (err: any) {
      console.error('Erreur lors de la génération:', err);
      setError(err.message || 'Une erreur est survenue lors de la génération.');
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setGeneratedContent(newContent);
    // Optionnel : sauvegarder automatiquement en BDD
  };

  const handleSaveToBank = async (contentToSave: string) => {
    if (!user || !lastFormData) {
      alert('Impossible de sauvegarder : données du formulaire manquantes');
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

      // Success feedback plus discret et professionnel
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300';
      successDiv.innerHTML = '✅ Séance ajoutée à votre banque !';
      document.body.appendChild(successDiv);
      
      setTimeout(() => {
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Générateur de séance
        </h1>
        {tokenCount !== null && (
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Crédits restants : {tokenCount.toLocaleString()} tokens
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8"
      >
        <Input
          id="subject"
          label="Matière"
          {...register('subject')}
          error={errors.subject?.message}
          className="border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500"
        />
        <Input
          id="topic"
          label="Thème"
          {...register('topic')}
          error={errors.topic?.message}
          className="border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500"
        />
        <Input
          id="level"
          label="Niveau"
          {...register('level')}
          error={errors.level?.message}
          className="border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500"
        />
        <Select
          id="pedagogy_type"
          label="Type de pédagogie"
          onChange={(e) => {
            setSelectedPedagogy(e.target.value);
            setValue('pedagogy_type', e.target.value);
          }}
          options={pedagogies.map(p => ({ value: p.value, label: p.label }))}
          error={errors.pedagogy_type?.message}
          className="border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500"
        />
        {selectedPedagogy && (
          <p className="text-sm text-gray-600 dark:text-gray-300 italic">
            {pedagogies.find(p => p.value === selectedPedagogy)?.description}
          </p>
        )}
        <Select
          id="duration"
          label="Durée"
          onChange={(e) => {
            setSelectedDuration(e.target.value);
            setValue('duration', e.target.value);
          }}
          value={selectedDuration}
          options={durationOptions}
          error={errors.duration?.message}
          className="border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500"
        />

        <Button type="submit" loading={loading} className="w-full">
          Générer la séance
        </Button>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </form>

      {generatedContent && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <MarkdownEditor
            content={generatedContent}
            onChange={handleContentChange}
            onSaveToBank={handleSaveToBank}
            isSaving={savingToBank}
          />
        </div>
      )}
    </div>
  );
}

export default LessonGeneratorPage;


