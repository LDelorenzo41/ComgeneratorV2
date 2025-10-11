import React from 'react';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import Textarea from '../components/ui/Textarea';
import { SignatureManager } from '../components/SignatureManager';
import { useAuthStore } from '../lib/store';
import useTokenBalance from '../hooks/useTokenBalance';
import copyToClipboard from '../lib/copyToClipboard';
import { generateCommunication } from '../lib/generateCommunication';
import { tokenUpdateEvent, TOKEN_UPDATED } from '../components/layout/Header';
import { generateReply } from '../lib/generateReply';
import { supabase } from '../lib/supabase';
import { AICommunicationDisclaimer } from '../components/ui/AICommunicationDisclaimer';

import { 
  MessageSquare, 
  Send, 
  Reply, 
  Copy, 
  Sparkles, 
  Users, 
  Volume2, 
  FileText, 
  RefreshCw, 
  CheckCircle,
  CreditCard,
  AlertCircle,
  PenTool,
  X
} from 'lucide-react';

// ✅ AJOUT: Interface pour les signatures
interface Signature {
  id: string;
  name: string;
  content: string;
  is_default: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  user_id?: string;
}

export function CommunicationPage() {
  const { user } = useAuthStore();
  const tokenBalance = useTokenBalance();

  // Fonction 1
  const [destinataire, setDestinataire] = React.useState("Parents d'élèves");
  const [ton, setTon] = React.useState('Détendu');
  const [contenu, setContenu] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [generatedContent, setGeneratedContent] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Fonction 2
  const [messageRecu, setMessageRecu] = React.useState('');
  const [tonReponse, setTonReponse] = React.useState('Neutre');
  const [objectifsReponse, setObjectifsReponse] = React.useState('');
  const [generatedReply, setGeneratedReply] = React.useState('');
  const [loadingReply, setLoadingReply] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);

  // ✅ AJOUT: États pour la gestion des signatures
  const [signatures, setSignatures] = React.useState<Signature[]>([]);
  const [selectedSignatureOutgoing, setSelectedSignatureOutgoing] = React.useState<string>('');
  const [selectedSignatureIncoming, setSelectedSignatureIncoming] = React.useState<string>('');
  const [showSignatureModal, setShowSignatureModal] = React.useState(false);

  // ✅ AJOUT: État pour tracking des tokens locaux
  const [tokenCount, setTokenCount] = React.useState<number>(0);

  // ✅ AJOUT: Synchronisation des tokens
  React.useEffect(() => {
    setTokenCount(tokenBalance ?? 0);
  }, [tokenBalance]);

  // ✅ AJOUT: Récupération des signatures de l'utilisateur
  const fetchSignatures = React.useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('signatures')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setSignatures(data || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des signatures:', error);
    }
  }, [user]);

  React.useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  // ✅ MODIFICATION: Fonction handleGenerate avec signature
  const handleGenerate = async () => {
    if (tokenCount === 0) {
      setError('Crédits insuffisants pour générer une communication.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedContent('');

    try {
      // ✅ AJOUT: Récupération de la signature sélectionnée
      const selectedSignature = selectedSignatureOutgoing 
        ? signatures.find(s => s.id === selectedSignatureOutgoing)
        : null;

      // ✅ MODIFICATION: Ajout de la signature dans les paramètres
      const text = await generateCommunication({ 
        destinataire, 
        ton, 
        contenu,
        signature: selectedSignature ? selectedSignature.content : null
      });
      setGeneratedContent(text);
      
      // ✅ MODIFICATION: Nouvelle logique de mise à jour des tokens
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tokens')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          const usedTokens = 1; // Ou calculé selon la logique métier
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
      setError('Erreur lors de la génération');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ MODIFICATION: Fonction handleGenerateReply avec signature
  const handleGenerateReply = async () => {
    if (tokenCount === 0) {
      setReplyError('Crédits insuffisants pour générer une réponse.');
      return;
    }

    setLoadingReply(true);
    setReplyError(null);
    setGeneratedReply('');

    try {
      // ✅ AJOUT: Récupération de la signature sélectionnée
      const selectedSignature = selectedSignatureIncoming 
        ? signatures.find(s => s.id === selectedSignatureIncoming)
        : null;

      // ✅ MODIFICATION: Ajout de la signature dans les paramètres
      const reply = await generateReply({
        message: messageRecu,
        ton: tonReponse,
        objectifs: objectifsReponse,
        signature: selectedSignature ? selectedSignature.content : null
      });

      setGeneratedReply(reply);
      
      // ✅ MODIFICATION: Nouvelle logique de mise à jour des tokens
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tokens')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          const usedTokens = 1; // Ou calculé selon la logique métier
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
      setReplyError('Erreur lors de la génération de la réponse.');
      console.error(err);
    } finally {
      setLoadingReply(false);
    }
  };

  const handleCopySuccess = (message: string) => {
    // Success feedback moderne
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 transform translate-x-0';
    successDiv.innerHTML = '✅ Message copié !';
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.style.transform = 'translateX(100%)';
      successDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(successDiv), 300);
    }, 2000);
  };

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    handleCopySuccess(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header moderne */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Communication
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Générez des communications professionnelles et des réponses personnalisées pour tous vos interlocuteurs
          </p>
          
          {/* Compteur de tokens */}
          <div className="inline-flex items-center bg-white dark:bg-gray-800 px-6 py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <Sparkles className="w-5 h-5 text-purple-500 mr-3" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Crédits restants : <span className="font-bold text-purple-600 dark:text-purple-400">{tokenBalance ?? '...'}</span> tokens
            </span>
          </div>
        </div>

        <div className="space-y-12">

          {/* Fonction 1 - Générer une communication */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Générer une communication à envoyer
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Créez des messages professionnels adaptés à votre destinataire et au ton souhaité
              </p>
            </div>

            <div className="space-y-6">
              {/* AJOUT : Disclaimer IA - seulement si tokens > 0 */}
              {tokenCount > 0 && <AICommunicationDisclaimer />}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    <Users className="w-4 h-4 inline mr-2" />
                    Type de destinataire
                  </label>
                  <Select
                    id="destinataire"
                    value={destinataire}
                    onChange={(e) => setDestinataire(e.target.value)}
                    className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    options={[
                      { value: "Parent d'élève", label: "Parent d'élève" },
                      { value: "Parents d'élèves", label: "Parents d'élèves" },
                      { value: 'Élève', label: 'Élève' },
                      { value: 'Élèves', label: 'Élèves' },
                      { value: 'Classe', label: 'Classe' },
                      { value: 'Collègue(s)', label: 'Collègue(s)' },
                      {
                        value: "Chef(fe) d'établissement / Chef(fe) adjoint",
                        label: "Chef(fe) d'établissement / Chef(fe) adjoint"
                      },
                      { value: 'Commission disciplinaire', label: 'Commission disciplinaire' },
                      { value: "Rapport d'incident", label: "Rapport d'incident" }
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    <Volume2 className="w-4 h-4 inline mr-2" />
                    Ton de la communication
                  </label>
                  <Select
                    id="ton"
                    value={ton}
                    onChange={(e) => setTon(e.target.value)}
                    className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    options={[
                      { value: 'Détendu', label: 'Détendu' },
                      { value: 'Neutre', label: 'Neutre' },
                      { value: 'Stricte', label: 'Stricte' }
                    ]}
                  />
                </div>
              </div>

              {/* ✅ AJOUT: Menu déroulant pour signature sortante avec bouton de gestion */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    <PenTool className="w-4 h-4 inline mr-2" />
                    Signature
                  </label>
                  <button
                    onClick={() => setShowSignatureModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    + Gérer les signatures
                  </button>
                </div>
                <Select
                  id="signature-outgoing"
                  value={selectedSignatureOutgoing}
                  onChange={(e) => setSelectedSignatureOutgoing(e.target.value)}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  options={[
                    { value: '', label: 'Au choix de l\'utilisateur' },
                    ...signatures.map(signature => ({
                      value: signature.id,
                      label: `${signature.name}${signature.is_default ? ' (par défaut)' : ''}`
                    }))
                  ]}
                />
                {/* ✅ AJOUT: Aperçu de la signature */}
                {selectedSignatureOutgoing && (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Aperçu de la signature :</p>
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                      {signatures.find(s => s.id === selectedSignatureOutgoing)?.content}
                    </pre>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Contenu à communiquer
                </label>
                <Textarea
                  id="contenu"
                  rows={4}
                  value={contenu}
                  onChange={(e) => setContenu(e.target.value)}
                  placeholder="Décrivez les éléments à faire apparaître dans votre communication..."
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
                />
              </div>

              {error && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-red-700 dark:text-red-300 font-medium">❌ {error}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading || tokenCount === 0}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                <span className="relative flex items-center justify-center">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                      Génération en cours...
                    </>
                  ) : tokenCount === 0 ? (
                    <>
                      <CreditCard className="w-5 h-5 mr-3" />
                      Crédits épuisés
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-3" />
                      Générer la communication
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Résultat de la communication générée */}
          {generatedContent && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Communication générée
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Votre message est prêt ! Vous pouvez l'éditer si nécessaire
                </p>
              </div>

              <div className="space-y-6">
                <Textarea
                  rows={8}
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 resize-none"
                />

                <button
                  onClick={() => handleCopy(generatedContent)}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-700 to-emerald-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                  <span className="relative flex items-center justify-center">
                    <Copy className="w-5 h-5 mr-3" />
                    Copier le message
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Fonction 2 - Répondre à une communication */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Reply className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Répondre à une communication reçue
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Générez une réponse appropriée basée sur le message reçu et vos objectifs
              </p>
            </div>

            <div className="space-y-6">
              {/* AJOUT : Disclaimer IA - seulement si tokens > 0 */}
              {tokenCount > 0 && <AICommunicationDisclaimer />}

              {/* ✅ AJOUT: Menu déroulant pour signature entrante avec bouton de gestion */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    <PenTool className="w-4 h-4 inline mr-2" />
                    Signature pour la réponse
                  </label>
                  <button
                    onClick={() => setShowSignatureModal(true)}
                    className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium transition-colors"
                  >
                    + Gérer les signatures
                  </button>
                </div>
                <Select
                  id="signature-incoming"
                  value={selectedSignatureIncoming}
                  onChange={(e) => setSelectedSignatureIncoming(e.target.value)}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                  options={[
                    { value: '', label: 'Au choix de l\'utilisateur' },
                    ...signatures.map(signature => ({
                      value: signature.id,
                      label: `${signature.name}${signature.is_default ? ' (par défaut)' : ''}`
                    }))
                  ]}
                />
                {/* ✅ AJOUT: Aperçu de la signature */}
                {selectedSignatureIncoming && (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Aperçu de la signature :</p>
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                      {signatures.find(s => s.id === selectedSignatureIncoming)?.content}
                    </pre>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Message reçu
                </label>
                <Textarea
                  rows={4}
                  placeholder="Collez ici le message reçu auquel vous souhaitez répondre..."
                  value={messageRecu}
                  onChange={(e) => setMessageRecu(e.target.value)}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 resize-none"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    <Volume2 className="w-4 h-4 inline mr-2" />
                    Ton de la réponse
                  </label>
                  <Select
                    id="ton-reponse"
                    value={tonReponse}
                    onChange={(e) => setTonReponse(e.target.value)}
                    className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                    options={[
                      { value: 'Détendu', label: 'Détendu' },
                      { value: 'Neutre', label: 'Neutre' },
                      { value: 'Stricte', label: 'Stricte' }
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Objectifs de la réponse
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="Quels éléments doit contenir la réponse ?"
                    value={objectifsReponse}
                    onChange={(e) => setObjectifsReponse(e.target.value)}
                    className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 resize-none"
                  />
                </div>
              </div>

              {replyError && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-red-700 dark:text-red-300 font-medium">❌ {replyError}</p>
                </div>
              )}

              <button
                onClick={handleGenerateReply}
                disabled={loadingReply || tokenCount === 0}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-700 to-pink-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                <span className="relative flex items-center justify-center">
                  {loadingReply ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                      Génération en cours...
                    </>
                  ) : tokenCount === 0 ? (
                    <>
                      <CreditCard className="w-5 h-5 mr-3" />
                      Crédits épuisés
                    </>
                  ) : (
                    <>
                      <Reply className="w-5 h-5 mr-3" />
                      Générer la réponse
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Résultat de la réponse générée */}
          {generatedReply && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Réponse générée
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Votre réponse est prête ! Vous pouvez l'ajuster avant envoi
                </p>
              </div>

              <div className="space-y-6">
                <Textarea
                  rows={8}
                  value={generatedReply}
                  onChange={(e) => setGeneratedReply(e.target.value)}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 resize-none"
                />

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => handleCopy(generatedReply)}
                    className="flex-1 group relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-700 to-emerald-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                    <span className="relative flex items-center justify-center">
                      <Copy className="w-5 h-5 mr-3" />
                      Copier la réponse
                    </span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setMessageRecu('');
                      setObjectifsReponse('');
                      setGeneratedReply('');
                    }}
                    className="flex-1 group relative overflow-hidden bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 font-bold py-4 px-8 rounded-xl border-2 border-blue-200 dark:border-blue-800 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-200 to-indigo-200 dark:from-blue-800 dark:to-indigo-800 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                    <span className="relative flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 mr-3" />
                      Nouvelle demande
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ✅ NOUVEAU: Modal de gestion des signatures */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                    <PenTool className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Gestion des signatures
                  </h2>
                </div>
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="Fermer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <SignatureManager onSignatureChange={fetchSignatures} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunicationPage;
