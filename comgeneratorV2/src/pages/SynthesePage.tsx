import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { createWorker } from 'tesseract.js';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import useTokenBalance from '../hooks/useTokenBalance';
import { TOKEN_UPDATED, tokenUpdateEvent } from '../components/layout/Header';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Upload, 
  Camera, 
  Sparkles, 
  CheckCircle, 
  Copy, 
  RotateCcw,
  Zap,
  Eye,
  Target,
  Monitor,
  Command,
  Printer,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export function SynthesePage() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const screenshotInputRef = React.useRef<HTMLInputElement | null>(null);
  const { user } = useAuthStore();

  const tokenCount = useTokenBalance();

  const [pdfDoc, setPdfDoc] = React.useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [maxChars, setMaxChars] = React.useState(300);
  const [summary, setSummary] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [copySuccess, setCopySuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
    setCapturedImage(null);

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

  const extractTextFromCapture = async (): Promise<string> => {
    if (!capturedImage) return '';

    console.log('=== EXTRACTION OCR DEPUIS CAPTURE ===');
    
    try {
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
    if (tokenCount === 0) {
      setError('INSUFFICIENT_TOKENS');
      return;
    }

    if (!capturedImage) {
      alert('Veuillez d\'abord faire une capture d\'écran de la partie souhaitée.');
      return;
    }
    
    setLoading(true);
    setError(null);
    const extracted = await extractTextFromCapture();
    
    if (!extracted) {
      setLoading(false);
      alert('Aucun texte détecté dans votre capture d\'écran.');
      return;
    }

    const prompt = `Tu es un expert en pédagogie et en évaluation scolaire, spécialisé dans la rédaction d'appréciations générales de bulletin.

**CONTEXTE ET MISSION :**
Tu dois analyser les commentaires de plusieurs professeurs extraits d'un bulletin scolaire et rédiger une appréciation générale cohérente et professionnelle qui sera placée en pied de bulletin.

**COMMENTAIRES À ANALYSER :**
"""
${extracted}
"""

**INSTRUCTIONS D'ANALYSE :**

1. **Identification des tendances pédagogiques :**
   - Repère les points forts récurrents dans les différentes matières
   - Identifie les difficultés ou axes d'amélioration mentionnés
   - Détecte les compétences transversales (autonomie, participation, méthode, etc.)
   - Évalue l'évolution ou la progression de l'élève si mentionnée

2. **Analyse des domaines de compétences :**
   - **Savoirs disciplinaires :** Connaissances et compétences spécifiques aux matières
   - **Savoir-faire méthodologiques :** Organisation, rigueur, présentation des travaux
   - **Savoir-être comportementaux :** Participation, attitude, relations avec autrui
   - **Compétences transversales :** Raisonnement, créativité, esprit critique

3. **Cohérence pédagogique :**
   - Identifie les convergences entre les appréciations des différents professeurs
   - Repère les spécificités selon les types de matières (littéraires, scientifiques, artistiques)
   - Détecte les compétences qui se confirment ou s'infirment selon les disciplines

**INSTRUCTIONS DE RÉDACTION :**

4. **Structure de l'appréciation générale :**
   - **Ouverture :** Bilan global du trimestre/semestre en 1-2 phrases
   - **Points forts :** Mise en valeur des réussites et qualités de l'élève
   - **Axes d'amélioration :** Formulation constructive des difficultés avec pistes de progrès
   - **Conclusion :** Encouragements et objectifs pour la suite

5. **Ton et registre :**
   - Adopte un ton bienveillant mais objectif
   - Utilise un vocabulaire pédagogique professionnel
   - Évite les jugements de valeur et privilégie les observations factuelles
   - Maintiens une perspective encourageante même en cas de difficultés

6. **Formulation pédagogique :**
   - Utilise des tournures positives même pour les points d'amélioration
   - Privilégie "Il serait profitable de..." plutôt que "Il faut absolument..."
   - Emploie le vocabulaire des compétences et de la progression
   - Évite les répétitions avec les commentaires disciplinaires

**CONTRAINTES TECHNIQUES :**
- **Limite stricte :** ${maxChars} caractères maximum (espaces compris)
- **Références aux matières :** Tu PEUX mentionner les disciplines sans citer nommément les professeurs
- **Cohérence :** L'appréciation doit être en accord avec l'ensemble des commentaires analysés
- **Lisibilité :** Phrases fluides et accessibles aux parents et à l'élève

**PRINCIPES PÉDAGOGIQUES À RESPECTER :**
- **Bienveillance éducative :** Chaque élève a des potentialités à développer
- **Constructivisme :** Les difficultés sont des étapes vers le progrès
- **Différenciation :** Reconnaissance des spécificités et du rythme de chaque élève
- **Motivation :** L'appréciation doit encourager la poursuite des efforts

**EXEMPLES DE FORMULATIONS PROFESSIONNELLES :**
- "Trimestre révélateur de qualités solides en..."
- "Des acquis qui se confirment particulièrement en..."
- "Une progression encourageante notamment dans..."
- "Il serait profitable de renforcer..."
- "Les efforts consentis méritent d'être poursuivis..."
- "Un potentiel à développer davantage en..."

**ATTENTION PARTICULIÈRE :**
- Si les commentaires sont majoritairement positifs → valorise tout en maintenant des objectifs
- Si les commentaires révèlent des difficultés → reste constructif et propose des pistes
- Si les commentaires sont contradictoires → trouve l'équilibre et explique les variations
- Si certaines matières ne sont pas évaluées → concentre-toi sur celles qui le sont

Rédige maintenant cette appréciation générale en respectant scrupuleusement ces instructions et en t'adaptant intelligemment au profil de l'élève qui se dégage des commentaires analysés.`;

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

      const usedTokens = data.usage?.total_tokens ?? 0;

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

    } catch (error: any) {
      console.error('Erreur lors de l\'appel à OpenAI:', error);
      setError(error.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySuccess = () => {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 transform translate-x-0';
    successDiv.innerHTML = '✅ Synthèse copiée !';
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.style.transform = 'translateX(100%)';
      successDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(successDiv), 300);
    }, 2000);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopySuccess(true);
      handleCopySuccess();
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  const resetForNewSynthesis = () => {
    setSummary('');
    setCapturedImage(null);
    setPdfDoc(null);
    setError(null);
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

  const tokensAvailable = tokenCount !== null && tokenCount > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Synthèse de bulletin
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Analysez vos bulletins PDF avec l'IA pour générer des synthèses personnalisées et pertinentes
          </p>
          
          {tokenCount !== null && (
            <div className={`inline-flex items-center px-6 py-3 rounded-xl shadow-lg border ${
              tokenCount === 0 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}>
              <Sparkles className={`w-5 h-5 mr-3 ${
                tokenCount === 0 
                  ? 'text-red-500' 
                  : 'text-green-500'
              }`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Crédits restants : <span className={`font-bold ${
                  tokenCount === 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>{tokenCount.toLocaleString()}</span> tokens
              </span>
              {tokenCount === 0 && (
                <Link 
                  to="/buy-tokens" 
                  className="ml-4 inline-flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Recharger
                </Link>
              )}
            </div>
          )}
        </div>

        {tokenCount === 0 && (
          <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-bold text-red-800 dark:text-red-200">
                Crédits épuisés
              </h3>
            </div>
            <p className="text-red-700 dark:text-red-300 mb-4">
              Vous n'avez plus de crédits pour générer des synthèses. Rechargez votre compte pour continuer à utiliser cette fonctionnalité.
            </p>
            <Link 
              to="/buy-tokens"
              className="inline-flex items-center bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Recharger mes crédits
            </Link>
          </div>
        )}

        <div className={`space-y-8 ${!tokensAvailable ? 'opacity-60' : ''}`}>
          
          {/* Étape 1: Upload PDF */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Étape 1 : Uploadez votre bulletin PDF
                  {!tokensAvailable && (
                    <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                      Indisponible
                    </span>
                  )}
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Commencez par télécharger le bulletin scolaire que vous souhaitez analyser
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 rounded-2xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-600">
              <Input 
                ref={fileInputRef}
                type="file" 
                accept="application/pdf" 
                onChange={handleFileChange}
                disabled={!tokensAvailable}
                className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Étape 2: Capture d'écran */}
          {pdfDoc && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Étape 2 : Uploadez votre capture d'écran
                    {!tokensAvailable && (
                      <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                        Indisponible
                      </span>
                    )}
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Capturez la partie du bulletin que vous souhaitez analyser
                </p>
              </div>
              
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200">
                      Utilisez votre outil de capture habituel, sinon voici les raccourcis clavier
                    </h3>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-xl">
                      <Monitor className="w-8 h-8 text-blue-500" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">Windows</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Win + Shift + S</kbd>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-xl">
                      <Command className="w-8 h-8 text-blue-500" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">Mac</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Cmd + Shift + 4</kbd>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-xl">
                      <Printer className="w-8 h-8 text-blue-500" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">Linux</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Print Screen</kbd>
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      ⚠️ <strong>Recommandation :</strong> Sélectionnez uniquement les commentaires des professeurs, jamais les données personnelles de l’élève.
                    </p>
                  </div>
                </div>
                
                <div className="text-center">
                  <label className={`group cursor-pointer inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 ${
                    !tokensAvailable ? 'opacity-50 cursor-not-allowed transform-none' : ''
                  }`}>
                    <input 
                      ref={screenshotInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleScreenshotUpload}
                      disabled={!tokensAvailable}
                      className="hidden"
                    />
                    <Camera className="w-5 h-5" />
                    <span>Sélectionner votre capture d'écran</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Capture sélectionnée */}
          {capturedImage && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Capture sélectionnée
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Votre image sera analysée par l'intelligence artificielle
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 rounded-2xl p-6">
                <div className="border-2 border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-white">
                  <img 
                    src={capturedImage} 
                    alt="Capture d'écran sélectionnée" 
                    className="w-full max-h-96 object-contain"
                  />
                </div>
                <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <p className="text-sm text-green-800 dark:text-green-200 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    <strong>Parfait !</strong> Cette image sera analysée par l'IA pour extraire le texte et générer votre synthèse.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Configuration et génération */}
          {capturedImage && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Configuration et génération
                    {!tokensAvailable && (
                      <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                        Indisponible
                      </span>
                    )}
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Définissez la longueur souhaitée et lancez l'analyse
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    <Target className="w-4 h-4 inline mr-2" />
                    Limite maximale de caractères
                  </label>
                  <Input
                    type="number"
                    value={maxChars}
                    onChange={e => setMaxChars(Number(e.target.value))}
                    min={50}
                    max={1000}
                    disabled={!tokensAvailable}
                    className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                    placeholder="300"
                  />
                </div>

                {error === 'INSUFFICIENT_TOKENS' && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                          Crédits insuffisants pour générer une synthèse
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                          Rechargez votre compte pour continuer à utiliser cette fonctionnalité.
                        </p>
                      </div>
                      <Link 
                        to="/buy-tokens"
                        className="inline-flex items-center bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        Recharger
                      </Link>
                    </div>
                  </div>
                )}

                <button
                  onClick={generateSynthese} 
                  disabled={loading || !capturedImage || tokenCount === 0}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-700 to-emerald-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                  <span className="relative flex items-center justify-center">
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                        Analyse en cours...
                      </>
                    ) : tokenCount === 0 ? (
                      <>
                        <AlertCircle className="w-5 h-5 mr-3" />
                        Crédits épuisés
                      </>
                    ) : capturedImage ? (
                      <>
                        <Zap className="w-5 h-5 mr-3" />
                        Générer la synthèse
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mr-3" />
                        Uploadez d'abord un PDF puis une capture
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Synthèse générée */}
          {summary && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Synthèse générée
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Votre synthèse est prête ! Vous pouvez l'éditer si nécessaire
                </p>
              </div>

              <div className="space-y-6">
                <div className="relative bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 rounded-2xl p-6 border-2 border-gray-200 dark:border-gray-600">
                  <textarea
                    className="w-full min-h-32 p-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Votre synthèse apparaîtra ici..."
                  />
                  <button
                    onClick={copyToClipboard}
                    className="absolute bottom-4 right-4 p-3 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                    title="Copier le texte"
                  >
                    {copySuccess ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
                
                <button
                  onClick={resetForNewSynthesis}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-gray-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                  <span className="relative flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 mr-3" />
                    Faire une autre synthèse
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Aperçu du bulletin */}
          {pdfDoc && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Votre bulletin
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Aperçu de votre document PDF
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 rounded-2xl p-6 border-2 border-gray-200 dark:border-gray-600">
                <div className="relative border-2 border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden max-w-full bg-white">
                  <canvas ref={canvasRef} className="w-full" />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}