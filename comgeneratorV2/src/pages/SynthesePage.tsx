// src/pages/SynthesePage.tsx - VERSION AMÉLIORÉE AVEC CONTRÔLES TON/LONGUEUR/TYPE

import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { createWorker } from 'tesseract.js';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { secureApi, type SynthesisParams } from '../lib/secureApi';
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
  ExternalLink,
  Settings,
  Video
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
  
  // ✅ NOUVEAUX ÉTATS POUR LES CONTRÔLES
  const [tone, setTone] = React.useState<'neutre' | 'encourageant' | 'analytique'>('neutre');
  const [maxChars, setMaxChars] = React.useState<number>(300);
  const [outputType, setOutputType] = React.useState<'complet' | 'essentiel'>('complet');
  
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
    
    try {
      const extracted = await extractTextFromCapture();
      
      if (!extracted) {
        setLoading(false);
        alert('Aucun texte détecté dans votre capture d\'écran.');
        return;
      }

      // ✅ APPEL AVEC LES NOUVEAUX PARAMÈTRES (pour le moment, l'Edge Function les ignore)
      const result = await secureApi.generateSynthesis({
        extractedText: extracted,
        maxChars: maxChars,
        // @ts-ignore - Ces paramètres seront utilisés après la mise à jour de l'Edge Function
        tone: tone,
        outputType: outputType
      });

      const content = result.content;
      if (!content) throw new Error('Réponse invalide de l\'API');

      setSummary(content);

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

    } catch (error: any) {
      console.error('Erreur lors de la génération:', error);

      if (error.message === 'INSUFFICIENT_TOKENS') {
        setError('INSUFFICIENT_TOKENS');
      } else {
        setError(error.message || 'Une erreur est survenue lors de la génération.');
      }
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
    setTone('neutre');
    setMaxChars(300);
    setOutputType('complet');
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
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-3">
            Analysez vos bulletins PDF avec l'IA pour générer des synthèses personnalisées et pertinentes
          </p>
        
          
          <div className="mb-6">
            <a 
              href="https://youtube.com/shorts/2zcbtC02w9Y" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <Video className="w-4 h-4" />
              <span className="underline hover:no-underline">Voir un court tuto vidéo</span>
            </a>
          </div>
          
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
                      ⚠️ <strong>Recommandation :</strong> Sélectionnez uniquement les commentaires des professeurs, jamais les données personnelles de l'élève.
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

          {/* ✅ NOUVELLE SECTION : Configuration et génération avec contrôles */}
          {capturedImage && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Configuration de la synthèse
                    {!tokensAvailable && (
                      <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                        Indisponible
                      </span>
                    )}
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Personnalisez le ton, la longueur et le type de synthèse avant la génération
                </p>
              </div>

              <div className="space-y-6">
                
                {/* ✅ SÉLECTEUR DE TON */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <Sparkles className="w-4 h-4 inline mr-2" />
                    Ton de la synthèse
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => setTone('neutre')}
                      disabled={!tokensAvailable}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        tone === 'neutre'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      } ${!tokensAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-center mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tone === 'neutre' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}>
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">Neutre</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Factuel et objectif</p>
                    </button>

                    <button
                      onClick={() => setTone('encourageant')}
                      disabled={!tokensAvailable}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        tone === 'encourageant'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      } ${!tokensAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-center mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tone === 'encourageant' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}>
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">Encourageant</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Valorise les points positifs</p>
                    </button>

                    <button
                      onClick={() => setTone('analytique')}
                      disabled={!tokensAvailable}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        tone === 'analytique'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      } ${!tokensAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-center mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tone === 'analytique' ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}>
                          <Target className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">Analytique</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Détaillé et approfondi</p>
                    </button>
                  </div>
                </div>

                {/* ✅ CURSEUR DE LONGUEUR */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <Target className="w-4 h-4 inline mr-2" />
                    Longueur maximale : <span className="text-orange-600 dark:text-orange-400 font-bold">{maxChars}</span> caractères
                  </label>
                  <div className="bg-gradient-to-r from-gray-50 to-orange-50 dark:from-gray-700 dark:to-orange-900/20 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-600">
                    <input
                      type="range"
                      min="50"
                      max="500"
                      value={maxChars}
                      onChange={(e) => setMaxChars(Number(e.target.value))}
                      disabled={!tokensAvailable}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(to right, rgb(249, 115, 22) 0%, rgb(249, 115, 22) ${((maxChars - 50) / (500 - 50)) * 100}%, rgb(229, 231, 235) ${((maxChars - 50) / (500 - 50)) * 100}%, rgb(229, 231, 235) 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-2">
                      <span>50</span>
                      <span>275</span>
                      <span>500</span>
                    </div>
                  </div>
                </div>

                {/* ✅ TYPE D'OUTPUT - BOUTONS RADIO */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <Eye className="w-4 h-4 inline mr-2" />
                    Type de synthèse
                  </label>
                  <div className="space-y-3">
                    <label className={`flex items-start p-4 rounded-xl border-2 transition-all duration-200 ${
                      outputType === 'complet'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    } ${!tokensAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="radio"
                        name="outputType"
                        value="complet"
                        checked={outputType === 'complet'}
                        onChange={(e) => setOutputType(e.target.value as 'complet' | 'essentiel')}
                        disabled={!tokensAvailable}
                        className="mt-1 mr-3 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">Synthèse complète</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Analyse détaillée avec points forts, axes d'amélioration et recommandations
                        </p>
                      </div>
                    </label>

                    <label className={`flex items-start p-4 rounded-xl border-2 transition-all duration-200 ${
                      outputType === 'essentiel'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    } ${!tokensAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="radio"
                        name="outputType"
                        value="essentiel"
                        checked={outputType === 'essentiel'}
                        onChange={(e) => setOutputType(e.target.value as 'complet' | 'essentiel')}
                        disabled={!tokensAvailable}
                        className="mt-1 mr-3 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">Synthèse essentielle</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Focus sur la caractéristique principale qui ressort du bulletin
                        </p>
                      </div>
                    </label>
                  </div>
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

                {/* ✅ BOUTON DE GÉNÉRATION */}
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
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-3" />
                        Générer la synthèse
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
                    className="w-full min-h-32 p-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
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