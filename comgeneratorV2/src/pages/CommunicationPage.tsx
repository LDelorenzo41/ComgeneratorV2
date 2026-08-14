import React from 'react';
import { useSearchParams } from 'react-router-dom'; // ✅ AJOUT
import { Select } from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import { SignatureManager } from '../components/SignatureManager';
import { useAuthStore } from '../lib/store';
import useTokenBalance from '../hooks/useTokenBalance';
import copyToClipboard from '../lib/copyToClipboard';
import { generateCommunication } from '../lib/generateCommunication';
import { generateReply } from '../lib/generateReply';
import { supabase } from '../lib/supabase';
import { AICommunicationDisclaimer } from '../components/ui/AICommunicationDisclaimer';
import { DictationRecorder } from '../components/communication/DictationRecorder';
import { analyzeCommunicationBrief } from '../lib/analyzeBrief';
import { FEATURES } from '../lib/features';

import { logGeneration } from '../lib/usageStats';
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
  PenTool,
  Wand2,
  Undo2,
  Loader2,
  AlertTriangle,
  X
} from 'lucide-react';

// Longueur maximale des saisies envoyées à l'IA (protection coûts / erreurs de copier-coller)
const MAX_INPUT_LENGTH = 10000;

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

  // ✅ AJOUT : Hooks pour la gestion du focus via URL
  const [searchParams] = useSearchParams();
  const createSectionRef = React.useRef<HTMLDivElement>(null);
  const replySectionRef = React.useRef<HTMLDivElement>(null);

  // ✅ AJOUT : Refs vers les blocs de résultat (scroll + focus après génération)
  const createResultRef = React.useRef<HTMLDivElement>(null);
  const replyResultRef = React.useRef<HTMLDivElement>(null);

  // ✅ AJOUT : Message pour la région aria-live (lecteurs d'écran)
  const [liveMessage, setLiveMessage] = React.useState('');

  // ✅ AJOUT : Effet pour scroller vers la bonne section selon le mode
  React.useEffect(() => {
    const mode = searchParams.get('mode');
    
    // Petit délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
      if (mode === 'create' && createSectionRef.current) {
        createSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (mode === 'reply' && replySectionRef.current) {
        replySectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, [searchParams]);

  // Fonction 1
  const [destinataire, setDestinataire] = React.useState("Parents d'élèves");
  const [ton, setTon] = React.useState('Détendu');
  const [contenu, setContenu] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [generatedContent, setGeneratedContent] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  
  // ✅ NOUVEAU: État pour le point de vue (rapport d'incident)
  const [pointDeVue, setPointDeVue] = React.useState<'troisieme' | 'premiere'>('troisieme');

  // ✅ LOT 3 v0.2: Analyse de brouillon (pré-remplissage du formulaire)
  const [analyzingBrief, setAnalyzingBrief] = React.useState(false);
  const [briefBackup, setBriefBackup] = React.useState<string | null>(null);
  // Informations manquantes signalées par l'analyse (créneau, prénom…)
  const [briefManques, setBriefManques] = React.useState<string[]>([]);

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

  // ✅ AJOUT: Présélection de la signature par défaut (une seule fois, au premier chargement)
  const signaturesInitialized = React.useRef(false);

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
      const list = data || [];
      setSignatures(list);

      const defaultId = list.find(s => s.is_default)?.id ?? '';
      if (!signaturesInitialized.current) {
        // Premier chargement : on présélectionne la signature par défaut
        signaturesInitialized.current = true;
        if (defaultId) {
          setSelectedSignatureOutgoing(defaultId);
          setSelectedSignatureIncoming(defaultId);
        }
      } else {
        // Rechargements suivants (après édition dans la modale) : on ne touche à la
        // sélection que si elle pointe vers une signature supprimée
        setSelectedSignatureOutgoing(prev =>
          prev && !list.some(s => s.id === prev) ? defaultId : prev
        );
        setSelectedSignatureIncoming(prev =>
          prev && !list.some(s => s.id === prev) ? defaultId : prev
        );
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des signatures:', error);
    }
  }, [user]);

  React.useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  // ✅ NOUVEAU: Fonction de réinitialisation complète
  const handleResetCommunication = () => {
    setDestinataire("Parents d'élèves");
    setTon('Détendu');
    setContenu('');
    setGeneratedContent('');
    setError(null);
    // La signature par défaut est restaurée (cohérent avec la présélection initiale)
    setSelectedSignatureOutgoing(signatures.find(s => s.is_default)?.id ?? '');
    setPointDeVue('troisieme');
    setBriefBackup(null);
    setBriefManques([]);
  };

  // ✅ LOT 3 v0.2: Analyse du brouillon → pré-remplissage du formulaire.
  // Le texte du champ (tapé, collé ou dicté) est restructuré en brief, et
  // destinataire / ton / point de vue sont déduits. Chaque champ reste
  // modifiable, et le brouillon d'origine est restaurable.
  const handleAnalyzeBrief = async () => {
    if (analyzingBrief || loading) return;
    if (tokenCount <= 0) {
      setError('Crédits insuffisants pour analyser le brouillon.');
      return;
    }
    if (!contenu.trim()) {
      setError('Écrivez ou dictez d\'abord votre brouillon dans le champ « Contenu à communiquer ».');
      return;
    }
    if (contenu.length > MAX_INPUT_LENGTH) {
      setError(
        `Le brouillon est trop long (${contenu.length.toLocaleString('fr-FR')} caractères, ` +
        `maximum ${MAX_INPUT_LENGTH.toLocaleString('fr-FR')}). Veuillez le raccourcir.`
      );
      return;
    }

    setAnalyzingBrief(true);
    setError(null);
    const draft = contenu;

    try {
      const analysis = await analyzeCommunicationBrief(draft);
      setBriefBackup(draft);
      setDestinataire(analysis.destinataire);
      setTon(analysis.ton);
      if (analysis.destinataire === "Rapport d'incident" && analysis.pointDeVue) {
        setPointDeVue(analysis.pointDeVue);
      }
      setContenu(analysis.contenu);
      setBriefManques(analysis.manques);
      setLiveMessage(
        analysis.manques.length > 0
          ? 'Formulaire pré-rempli. Des informations à préciser ont été signalées sous le champ.'
          : 'Formulaire pré-rempli depuis votre brouillon. Vérifiez les champs avant de générer.'
      );
    } catch (err) {
      setError(toUserErrorMessage(err, 'Erreur lors de l\'analyse du brouillon. Veuillez réessayer.'));
    } finally {
      setAnalyzingBrief(false);
    }
  };

  // Restaure le brouillon d'origine après une analyse
  const handleRestoreDraft = () => {
    if (briefBackup !== null) {
      setContenu(briefBackup);
      setBriefBackup(null);
      setLiveMessage('Brouillon d\'origine rétabli.');
    }
  };

  // ✅ AJOUT: Scroll + focus vers un bloc de résultat après génération
  const scrollToResult = (ref: React.RefObject<HTMLDivElement>) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus({ preventScroll: true });
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // ✅ AJOUT: Message d'erreur lisible à partir d'une exception
  const toUserErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof TypeError) {
      // fetch qui échoue (réseau coupé, serveur injoignable)
      return 'Problème de connexion. Vérifiez votre réseau et réessayez.';
    }
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return fallback;
  };

  // ✅ MODIFICATION: Fonction handleGenerate avec signature et point de vue
  // Le décompte des crédits est effectué dans generateCommunication (un seul débit)
  const handleGenerate = async () => {
    if (tokenCount <= 0) {
      setError('Crédits insuffisants pour générer une communication.');
      return;
    }
    if (!contenu.trim()) {
      setError('Veuillez décrire le contenu à communiquer avant de lancer la génération.');
      return;
    }
    if (contenu.length > MAX_INPUT_LENGTH) {
      setError(
        `Le contenu est trop long (${contenu.length.toLocaleString('fr-FR')} caractères, ` +
        `maximum ${MAX_INPUT_LENGTH.toLocaleString('fr-FR')}). Veuillez le raccourcir.`
      );
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

      // ✅ NOUVEAU: Ajout du point de vue pour rapport d'incident
      let contenuAvecPointDeVue = contenu;
      if (destinataire === "Rapport d'incident" && pointDeVue === 'premiere') {
        contenuAvecPointDeVue = `[IMPORTANT: Rédiger ce rapport à la PREMIÈRE PERSONNE du singulier (je, j'ai constaté, j'ai observé, etc.)]\n\n${contenu}`;
      }

      // ✅ MODIFICATION: Ajout de la signature dans les paramètres
      const text = await generateCommunication({
        destinataire,
        ton,
        contenu: contenuAvecPointDeVue,
        signature: selectedSignature ? selectedSignature.content : null
      });
      setGeneratedContent(text);
      logGeneration('communication');
      setLiveMessage('Communication générée. Le résultat est affiché sous le formulaire.');
      scrollToResult(createResultRef);

    } catch (err: any) {
      setError(toUserErrorMessage(err, 'Erreur lors de la génération. Veuillez réessayer.'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ MODIFICATION: Fonction handleGenerateReply avec signature
  // Le décompte des crédits est effectué dans generateReply (un seul débit)
  const handleGenerateReply = async () => {
    if (tokenCount <= 0) {
      setReplyError('Crédits insuffisants pour générer une réponse.');
      return;
    }
    if (!messageRecu.trim()) {
      setReplyError('Veuillez coller le message reçu avant de lancer la génération.');
      return;
    }
    if (messageRecu.length > MAX_INPUT_LENGTH) {
      setReplyError(
        `Le message reçu est trop long (${messageRecu.length.toLocaleString('fr-FR')} caractères, ` +
        `maximum ${MAX_INPUT_LENGTH.toLocaleString('fr-FR')}). Veuillez le raccourcir.`
      );
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
      logGeneration('communication');
      setLiveMessage('Réponse générée. Le résultat est affiché sous le formulaire.');
      scrollToResult(replyResultRef);
    } catch (err: any) {
      setReplyError(toUserErrorMessage(err, 'Erreur lors de la génération de la réponse. Veuillez réessayer.'));
      console.error(err);
    } finally {
      setLoadingReply(false);
    }
  };

  const handleCopySuccess = () => {
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
    setLiveMessage('Message copié dans le presse-papiers.');
    handleCopySuccess();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      {/* ✅ AJOUT: Région aria-live pour annoncer les résultats aux lecteurs d'écran */}
      <div className="sr-only" role="status" aria-live="polite">{liveMessage}</div>

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
          {/* ✅ AJOUT: Ref pour le scroll */}
          <div 
            ref={createSectionRef}
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8"
          >
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
                      // La valeur « Stricte » est conservée : les Edge Functions font un
                      // switch sur cette chaîne exacte. Seul le libellé affiché est corrigé.
                      { value: 'Stricte', label: 'Strict' }
                    ]}
                  />
                </div>
              </div>

              {/* ✅ NOUVEAU: Choix du point de vue pour Rapport d'incident */}
              {destinataire === "Rapport d'incident" && (
                <div className="space-y-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Point de vue de rédaction
                  </label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="pointDeVue"
                        value="troisieme"
                        checked={pointDeVue === 'troisieme'}
                        onChange={(e) => setPointDeVue(e.target.value as 'troisieme' | 'premiere')}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>Troisième personne</strong> (objectif : "L'élève a fait...")
                      </span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="pointDeVue"
                        value="premiere"
                        checked={pointDeVue === 'premiere'}
                        onChange={(e) => setPointDeVue(e.target.value as 'troisieme' | 'premiere')}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>Première personne</strong> (témoin : "J'ai constaté que...")
                      </span>
                    </label>
                  </div>
                </div>
              )}

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
                    { value: '', label: 'Aucune signature' },
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
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Contenu à communiquer
                  </label>
                </div>
                {/* ✅ LOT 3 : dictée → analyse → formulaire pré-rempli, en un geste.
                    Si l'analyse échoue, la dictée n'est pas perdue : le texte brut
                    est déposé dans le champ et reste analysable manuellement. */}
                {FEATURES.DICTATION_ENABLED && (
                  <DictationRecorder
                    disabled={loading || analyzingBrief}
                    buttonLabel="Dicter et pré-remplir le formulaire"
                    buttonTitle="Dictez au micro : le formulaire est ensuite analysé et pré-rempli automatiquement (100 crédits par minute entamée + coût de l'analyse)"
                    processingLabel="Transcription et analyse en cours…"
                    onTranscript={async (text) => {
                      setAnalyzingBrief(true);
                      try {
                        const analysis = await analyzeCommunicationBrief(text);
                        setBriefBackup(text);
                        setDestinataire(analysis.destinataire);
                        setTon(analysis.ton);
                        if (analysis.destinataire === "Rapport d'incident" && analysis.pointDeVue) {
                          setPointDeVue(analysis.pointDeVue);
                        }
                        setContenu(analysis.contenu);
                        setBriefManques(analysis.manques);
                        setLiveMessage(
                          analysis.manques.length > 0
                            ? 'Formulaire pré-rempli depuis votre dictée. Des informations à préciser ont été signalées sous le champ.'
                            : 'Formulaire pré-rempli depuis votre dictée. Vérifiez les champs avant de générer.'
                        );
                      } catch {
                        // L'analyse a échoué : on conserve la dictée brute dans le champ
                        setContenu(prev => (prev.trim() ? `${prev}\n\n${text}` : text));
                        setBriefManques([]);
                        setError('L\'analyse du brouillon a échoué — votre dictée a été déposée dans le champ. Vous pouvez la modifier puis cliquer « Analyser et pré-remplir le formulaire ».');
                        setLiveMessage('Dictée déposée dans le champ, analyse à relancer.');
                      } finally {
                        setAnalyzingBrief(false);
                      }
                    }}
                  />
                )}
                <Textarea
                  id="contenu"
                  rows={4}
                  value={contenu}
                  onChange={(e) => setContenu(e.target.value)}
                  placeholder="Décrivez les éléments à faire apparaître dans votre communication..."
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />

                {/* ✅ LOT 3 v0.2 : analyse du brouillon → pré-remplissage du formulaire */}
                {FEATURES.BRIEF_ANALYSIS_ENABLED && (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    {briefBackup !== null ? (
                      <button
                        type="button"
                        onClick={handleRestoreDraft}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                      >
                        <Undo2 className="w-4 h-4" />
                        Rétablir mon texte d'origine
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Astuce : notez vos idées en vrac (ou dictez-les), l'analyse organise le reste
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleAnalyzeBrief}
                      disabled={analyzingBrief || loading || !contenu.trim()}
                      title="Analyse votre brouillon et pré-remplit destinataire, ton et contenu (coût selon la longueur, généralement inférieur à une génération)"
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {analyzingBrief ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyse en cours…
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          Analyser et pré-remplir le formulaire
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ✅ Informations manquantes signalées par l'analyse */}
                {briefManques.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                            À préciser avant de générer :
                          </p>
                          <ul className="mt-1 space-y-0.5 text-sm text-amber-700 dark:text-amber-300/90 list-disc list-inside">
                            {briefManques.map((manque, index) => (
                              <li key={index}>{manque}</li>
                            ))}
                          </ul>
                          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400/80">
                            Complétez le champ ci-dessus si besoin — la génération fonctionnera aussi sans.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBriefManques([])}
                        aria-label="Masquer ces suggestions"
                        className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-red-700 dark:text-red-300 font-medium">❌ {error}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading || tokenCount <= 0}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                <span className="relative flex items-center justify-center">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                      Génération en cours...
                    </>
                  ) : tokenCount <= 0 ? (
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
            <div
              ref={createResultRef}
              tabIndex={-1}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 focus:outline-none"
            >
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
                {/* ✅ MODIFICATION: Textarea redimensionnable (suppression de resize-none) */}
                <Textarea
                  rows={8}
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                />

                {/* ✅ NOUVEAU: Deux boutons - Copier ET Nouvelle communication */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => handleCopy(generatedContent)}
                    className="flex-1 group relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-700 to-emerald-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                    <span className="relative flex items-center justify-center">
                      <Copy className="w-5 h-5 mr-3" />
                      Copier le message
                    </span>
                  </button>

                  <button
                    onClick={handleResetCommunication}
                    className="flex-1 group relative overflow-hidden bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-xl border-2 border-gray-300 dark:border-gray-600 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                    <span className="relative flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 mr-3" />
                      Nouvelle communication
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fonction 2 - Répondre à une communication */}
          {/* ✅ AJOUT: Ref pour le scroll */}
          <div 
            ref={replySectionRef}
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8"
          >
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
                    { value: '', label: 'Aucune signature' },
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
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"

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
                      // Valeur « Stricte » conservée (switch côté Edge Function), libellé corrigé
                      { value: 'Stricte', label: 'Strict' }
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Objectifs de la réponse
                  </label>
                  {/* ✅ Dictée simple des objectifs (pas d'analyse : champ court) */}
                  {FEATURES.DICTATION_ENABLED && (
                    <DictationRecorder
                      disabled={loadingReply}
                      buttonLabel="Dicter mes objectifs"
                      onTranscript={(text) =>
                        setObjectifsReponse(prev => (prev.trim() ? `${prev}\n${text}` : text))
                      }
                    />
                  )}
                  <Textarea
                    rows={3}
                    placeholder="Quels éléments doit contenir la réponse ?"
                    value={objectifsReponse}
                    onChange={(e) => setObjectifsReponse(e.target.value)}
                    className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
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
                disabled={loadingReply || tokenCount <= 0}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-700 to-pink-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                <span className="relative flex items-center justify-center">
                  {loadingReply ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                      Génération en cours...
                    </>
                  ) : tokenCount <= 0 ? (
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
            <div
              ref={replyResultRef}
              tabIndex={-1}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 focus:outline-none"
            >
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
                {/* ✅ MODIFICATION: Textarea redimensionnable */}
                <Textarea
                  rows={8}
                  value={generatedReply}
                  onChange={(e) => setGeneratedReply(e.target.value)}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
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
