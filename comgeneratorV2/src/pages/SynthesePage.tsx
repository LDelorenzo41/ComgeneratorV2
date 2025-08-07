import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { createWorker } from 'tesseract.js';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export function SynthesePage() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const screenshotInputRef = React.useRef<HTMLInputElement | null>(null);
  const { user } = useAuthStore();

  const [pdfDoc, setPdfDoc] = React.useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [maxChars, setMaxChars] = React.useState(300);
  const [summary, setSummary] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [tokenCount, setTokenCount] = React.useState<number | null>(null);
  const [copySuccess, setCopySuccess] = React.useState(false);

  const fetchTokenCount = React.useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({ user_id: user.id, tokens: 100000 })
            .select('tokens')
            .single();
          setTokenCount(newProfile?.tokens ?? 100000);
          return;
        }
        throw error;
      }

      setTokenCount(data?.tokens ?? 0);
    } catch (err) {
      console.error('Erreur lors de la récupération des tokens:', err);
    }
  }, [user]);

  React.useEffect(() => {
    fetchTokenCount();
  }, [fetchTokenCount]);

  const getResponsiveScale = (containerWidth: number, page: pdfjsLib.PDFPageProxy): number => {
    const desiredWidth = Math.min(containerWidth, 800);
    const viewport = page.getViewport({ scale: 1 });
    return desiredWidth / viewport.width;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    setPdfDoc(pdf);
    setCapturedImage(null); // Reset de la capture précédente

    const page = await pdf.getPage(1);
    const canvas = canvasRef.current!;
    const containerWidth = canvas.parentElement?.clientWidth ?? 600;
    const scale = getResponsiveScale(containerWidth, page);
    const viewport = page.getViewport({ scale });
    const ctx = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas
    }).promise;
  };

  // 🔥 Gestion de l'upload de capture d'écran
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image valide.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageDataUrl = event.target?.result as string;
      setCapturedImage(imageDataUrl);
      console.log('📸 Capture d\'écran chargée avec succès');
    };
    reader.readAsDataURL(file);
  };

  // 🔥 Extraction de texte depuis la capture d'écran
  const extractTextFromCapture = async (): Promise<string> => {
    if (!capturedImage) return '';

    console.log('=== EXTRACTION OCR DEPUIS CAPTURE ===');
    
    try {
      // OCR sur la capture avec paramètres optimisés
      const worker = await createWorker('fra');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?()[]- àâäéèêëïîôöùûüÿçÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇ',
      });
      
      console.log('🔍 Lancement OCR...');
      const { data: { text: ocrText } } = await worker.recognize(capturedImage);
      await worker.terminate();
      
      const extractedText = ocrText.trim();
      console.log('=== RÉSULTAT OCR ===');
      console.log('Texte extrait:', extractedText);
      console.log('===================');
      
      return extractedText;
    } catch (error) {
      console.error('Erreur lors de l\'extraction OCR:', error);
      return '';
    }
  };

  const generateSynthese = async () => {
    if (!capturedImage) {
      alert('Veuillez d\'abord faire une capture d\'écran de la partie souhaitée.');
      return;
    }
    
    setLoading(true);
    const extracted = await extractTextFromCapture();
    
    if (!extracted) {
      setLoading(false);
      alert('Aucun texte détecté dans votre capture d\'écran.');
      return;
    }

    const prompt = `
Voici plusieurs commentaires de professeurs extraits d'un bulletin scolaire.

Tu dois générer une appréciation globale en identifiant les grandes tendances : points forts, difficultés éventuelles, éléments positifs. Ne cite pas les professeurs mais tu peux mentionner les matières. Utilise un ton fluide, synthétique et pertinent.

La synthèse doit respecter la limite maximale de ${maxChars} caractères.

Commentaires :
${extracted}
`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: Math.floor(maxChars * 1.5),
        })
      });

      const data = await response.json();
      setSummary(data.choices?.[0]?.message?.content || '');

      // ✅ Mise à jour du compteur si usage des tokens détecté
      const usedTokens = data.usage?.total_tokens ?? 0;

      if (usedTokens > 0 && user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ tokens: Math.max(0, tokenCount! - usedTokens) })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Erreur lors de la mise à jour du compteur de tokens:', updateError);
        } else {
          fetchTokenCount();
        }
      }

    } catch (error) {
      console.error('Erreur lors de l\'appel à OpenAI:', error);
      alert("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  const resetForNewSynthesis = () => {
    setSummary('');
    setCapturedImage(null);
    setPdfDoc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = '';
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Générer une synthèse
        </h1>
        {tokenCount !== null && (
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Crédits restants : {tokenCount.toLocaleString()} tokens
          </p>
        )}
      </div>

      <div className="space-y-6">
        {/* Étape 1 : Upload PDF */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-3">📄 Étape 1 : Uploadez votre bulletin PDF</h3>
          <Input 
            ref={fileInputRef}
            type="file" 
            accept="application/pdf" 
            onChange={handleFileChange} 
          />
        </div>

        {/* Affichage du PDF */}
        {pdfDoc && (
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">📋 Votre bulletin</h3>
            <div className="relative border rounded overflow-hidden max-w-full">
              <canvas ref={canvasRef} className="w-full" />
            </div>
          </div>
        )}

        {/* Étape 2 : Upload de capture */}
        {pdfDoc && (
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">📸 Étape 2 : Uploadez votre capture d'écran</h3>
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                  📋 Instructions simples :
                </p>
                <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li><strong>Windows :</strong> Appuyez sur <kbd className="bg-blue-100 px-1 rounded">Windows + Shift + S</kbd></li>
                  <li><strong>Mac :</strong> Appuyez sur <kbd className="bg-blue-100 px-1 rounded">Cmd + Shift + 4</kbd></li>
                  <li><strong>Linux :</strong> Appuyez sur <kbd className="bg-blue-100 px-1 rounded">Print Screen</kbd></li>
                  <li>Sélectionnez la partie du bulletin que vous voulez analyser</li>
                  <li>Uploadez l'image avec le bouton ci-dessous</li>
                </ol>
              </div>
              
              <label className="cursor-pointer inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                <Input 
                  ref={screenshotInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={handleScreenshotUpload}
                  className="hidden"
                />
                <span>📤 Sélectionner votre capture d'écran</span>
              </label>
            </div>
          </div>
        )}

        {/* Affichage de la capture */}
        {capturedImage && (
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">✅ Capture sélectionnée</h3>
            <div className="border rounded overflow-hidden max-w-full">
              <img 
                src={capturedImage} 
                alt="Capture d'écran sélectionnée" 
                className="w-full max-h-96 object-contain"
              />
            </div>
            <p className="text-sm text-green-600 mt-2">
              ✅ Parfait ! Cette image sera analysée par l'IA.
            </p>
          </div>
        )}

        <Input
          type="number"
          label="Limite maximale de caractères"
          value={maxChars}
          onChange={e => setMaxChars(Number(e.target.value))}
          min={50}
        />

        <Button 
          onClick={generateSynthese} 
          loading={loading}
          disabled={!capturedImage}
          className="w-full"
        >
          {capturedImage ? '🚀 Générer la synthèse' : '⏳ Uploadez d\'abord un PDF puis faites une capture'}
        </Button>

        {summary && (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Synthèse générée
            </h3>
            <div className="relative p-4 bg-white dark:bg-gray-800 rounded-md shadow">
              <textarea
                className="w-full min-h-32 p-2 text-gray-700 dark:text-gray-300 bg-transparent border-none resize-none focus:outline-none"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Votre synthèse apparaîtra ici..."
              />
              <button
                onClick={copyToClipboard}
                className="absolute bottom-2 right-2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Copier le texte"
              >
                {copySuccess ? (
                  <span className="text-green-500">✅</span>
                ) : (
                  <span>📋</span>
                )}
              </button>
            </div>
            
            <div className="mt-4">
              <Button 
                onClick={resetForNewSynthesis}
                className="bg-gray-500 hover:bg-gray-600 text-white"
              >
                🔄 Faire une autre synthèse
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


