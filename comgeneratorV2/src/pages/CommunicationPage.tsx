import React from 'react';
import { useSearchParams } from 'react-router-dom'; // ✅ AJOUT
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import Textarea from '../components/ui/Textarea';
import { SignatureManager } from '../components/SignatureManager';
import { useAuthStore } from '../lib/store';
import useTokenBalance from '../hooks/useTokenBalance';
import copyToClipboard from '../lib/copyToClipboard';
import { generateCommunication, splitObjet } from '../lib/generateCommunication';
import { reviseCommunication, REVISION_LABELS, type RevisionKind } from '../lib/reviseCommunication';
import { generateReply } from '../lib/generateReply';
import { supabase } from '../lib/supabase';
import { AICommunicationDisclaimer } from '../components/ui/AICommunicationDisclaimer';
import { DictationRecorder } from '../components/communication/DictationRecorder';
import { analyzeCommunicationBrief, analyzeReplyBrief, type BriefAnalysis } from '../lib/analyzeBrief';
import { exportDocumentToPdf } from '../lib/documentPdfExport';
import { useToast } from '../components/ui/Toast';
import EnhancedMarkdownRenderer from '../components/ui/EnhancedMarkdownRenderer';
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
  ClipboardList,
  Eye,
  Download,
  Mail,
  X
} from 'lucide-react';

// Type de production de la section « créer » : un message adressé, ou un
// document administratif (sans destinataire ni ton)
type DocType = 'message' | 'incident' | 'commission';

// Valeurs historiques attendues par l'Edge Function communication
const DOC_TYPE_TO_DESTINATAIRE: Record<Exclude<DocType, 'message'>, string> = {
  incident: "Rapport d'incident",
  commission: 'Commission disciplinaire'
};

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
  const { showToast } = useToast();

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
  const [docType, setDocType] = React.useState<DocType>('message');
  const [destinataire, setDestinataire] = React.useState("Parents d'élèves");
  const [ton, setTon] = React.useState('Détendu');
  const [contenu, setContenu] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [generatedContent, setGeneratedContent] = React.useState('');
  // Type de production du résultat affiché (fige le mode d'affichage même si
  // l'utilisateur change le sélecteur après génération)
  const [generatedDocType, setGeneratedDocType] = React.useState<DocType>('message');
  const [resultView, setResultView] = React.useState<'preview' | 'edit'>('edit');
  // Objet extrait du message généré (messages uniquement), éditable
  const [generatedObjet, setGeneratedObjet] = React.useState<string | null>(null);
  // Retouches en un clic : type en cours + version précédente (annulation)
  const [revisingKind, setRevisingKind] = React.useState<RevisionKind | null>(null);
  const [previousVersion, setPreviousVersion] = React.useState<{ content: string; objet: string | null } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  
  // ✅ NOUVEAU: État pour le point de vue (rapport d'incident)
  const [pointDeVue, setPointDeVue] = React.useState<'troisieme' | 'premiere'>('troisieme');

  // ✅ LOT 3 v0.2: Analyse de brouillon (pré-remplissage du formulaire)
  const [analyzingBrief, setAnalyzingBrief] = React.useState(false);
  const [briefBackup, setBriefBackup] = React.useState<string | null>(null);
  // Informations manquantes signalées par l'analyse (créneau, prénom…)
  const [briefManques, setBriefManques] = React.useState<string[]>([]);

  // ✅ Analyse des objectifs de réponse (croisée avec le message reçu)
  const [analyzingReply, setAnalyzingReply] = React.useState(false);
  const [replyObjBackup, setReplyObjBackup] = React.useState<string | null>(null);
  const [replyManques, setReplyManques] = React.useState<string[]>([]);
  // Retouches en un clic de la réponse générée
  const [revisingReplyKind, setRevisingReplyKind] = React.useState<RevisionKind | null>(null);
  const [previousReplyVersion, setPreviousReplyVersion] = React.useState<string | null>(null);

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
    setDocType('message');
    setDestinataire("Parents d'élèves");
    setTon('Détendu');
    setContenu('');
    setGeneratedContent('');
    setGeneratedObjet(null);
    setPreviousVersion(null);
    setGeneratedDocType('message');
    setResultView('edit');
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
      applyBriefAnalysis(analysis);
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

  // ✅ Applique une analyse de brouillon au formulaire, y compris le type de
  // production : un brief d'incident ou de commission bascule automatiquement
  // le sélecteur « Que voulez-vous produire ? »
  const applyBriefAnalysis = (analysis: BriefAnalysis) => {
    if (analysis.destinataire === "Rapport d'incident") {
      setDocType('incident');
      if (analysis.pointDeVue) setPointDeVue(analysis.pointDeVue);
    } else if (analysis.destinataire === 'Commission disciplinaire') {
      setDocType('commission');
    } else {
      setDocType('message');
      setDestinataire(analysis.destinataire);
      setTon(analysis.ton);
    }
    setContenu(analysis.contenu);
    setBriefManques(analysis.manques);
  };

  // Restaure le brouillon d'origine après une analyse
  const handleRestoreDraft = () => {
    if (briefBackup !== null) {
      setContenu(briefBackup);
      setBriefBackup(null);
      setLiveMessage('Brouillon d\'origine rétabli.');
    }
  };

  // ✅ Retouche en un clic du message généré (plus court, chaleureux, ferme).
  // L'objet est réintégré au texte envoyé pour que la retouche puisse
  // l'ajuster ; une seule version précédente est conservée (annulation).
  const handleRevise = async (kind: RevisionKind) => {
    if (!generatedContent || revisingKind !== null || loading) return;
    if (tokenCount <= 0) {
      setError('Crédits insuffisants pour retoucher le message.');
      return;
    }

    setRevisingKind(kind);
    setError(null);

    try {
      const fullText = generatedObjet
        ? `Objet : ${generatedObjet}\n\n${generatedContent}`
        : generatedContent;
      const revised = await reviseCommunication(fullText, kind);
      setPreviousVersion({ content: generatedContent, objet: generatedObjet });
      const split = splitObjet(revised);
      setGeneratedContent(split.content);
      // Si la retouche a perdu la ligne Objet, l'objet précédent est conservé
      setGeneratedObjet(split.objet ?? generatedObjet);
      setLiveMessage(`Message retouché : ${REVISION_LABELS[kind].toLowerCase()}.`);
    } catch (err) {
      setError(toUserErrorMessage(err, 'Erreur lors de la retouche. Veuillez réessayer.'));
    } finally {
      setRevisingKind(null);
    }
  };

  const handleUndoRevision = () => {
    if (previousVersion) {
      setGeneratedContent(previousVersion.content);
      setGeneratedObjet(previousVersion.objet);
      setPreviousVersion(null);
      setLiveMessage('Version précédente rétablie.');
    }
  };

  // ✅ Retouche de la réponse générée (section Répondre)
  const handleReviseReply = async (kind: RevisionKind) => {
    if (!generatedReply || revisingReplyKind !== null || loadingReply) return;
    if (tokenCount <= 0) {
      setReplyError('Crédits insuffisants pour retoucher la réponse.');
      return;
    }

    setRevisingReplyKind(kind);
    setReplyError(null);

    try {
      const revised = await reviseCommunication(generatedReply, kind);
      setPreviousReplyVersion(generatedReply);
      setGeneratedReply(revised);
      setLiveMessage(`Réponse retouchée : ${REVISION_LABELS[kind].toLowerCase()}.`);
    } catch (err) {
      setReplyError(toUserErrorMessage(err, 'Erreur lors de la retouche. Veuillez réessayer.'));
    } finally {
      setRevisingReplyKind(null);
    }
  };

  const handleUndoReplyRevision = () => {
    if (previousReplyVersion !== null) {
      setGeneratedReply(previousReplyVersion);
      setPreviousReplyVersion(null);
      setLiveMessage('Version précédente rétablie.');
    }
  };

  // ✅ Ouvre le message dans le logiciel de messagerie (mailto). Selon le
  // client mail, les très longs corps peuvent être tronqués — le bouton
  // Copier reste le chemin garanti.
  const handleOpenInMailer = (objet: string | null, body: string) => {
    const href = `mailto:?subject=${encodeURIComponent(objet ?? '')}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setLiveMessage('Ouverture de votre messagerie…');
  };

  // ✅ Export PDF des documents structurés (rapport, bilan de commission)
  const handleExportPdf = () => {
    if (!generatedContent || generatedDocType === 'message') return;
    const title = generatedDocType === 'incident'
      ? "Rapport d'incident"
      : 'Bilan pour commission disciplinaire';
    const filenameBase = generatedDocType === 'incident' ? 'rapport-incident' : 'bilan-commission';
    exportDocumentToPdf(title, generatedContent, filenameBase);
    setLiveMessage('PDF téléchargé.');
  };

  // ✅ Analyse des objectifs de réponse, croisée avec le message reçu :
  // ton suggéré, objectifs restructurés, et points du message sans réponse
  const handleAnalyzeReply = async (objectifsSource?: string) => {
    const objectifs = objectifsSource ?? objectifsReponse;
    if (analyzingReply || loadingReply) return;
    if (tokenCount <= 0) {
      setReplyError('Crédits insuffisants pour analyser les objectifs.');
      return;
    }
    if (!messageRecu.trim()) {
      setReplyError('Collez d\'abord le message reçu : l\'analyse compare vos objectifs avec ce qu\'il demande.');
      return;
    }
    if (!objectifs.trim()) {
      setReplyError('Écrivez ou dictez d\'abord vos objectifs de réponse.');
      return;
    }
    if (objectifs.length > MAX_INPUT_LENGTH || messageRecu.length > MAX_INPUT_LENGTH) {
      setReplyError(`Texte trop long (maximum ${MAX_INPUT_LENGTH.toLocaleString('fr-FR')} caractères par champ).`);
      return;
    }

    setAnalyzingReply(true);
    setReplyError(null);

    try {
      const analysis = await analyzeReplyBrief(messageRecu, objectifs);
      setReplyObjBackup(objectifs);
      setTonReponse(analysis.ton);
      setObjectifsReponse(analysis.contenu);
      setReplyManques(analysis.manques);
      setLiveMessage(
        analysis.manques.length > 0
          ? 'Objectifs pré-remplis. Des points du message sans réponse ont été signalés.'
          : 'Objectifs pré-remplis. Vérifiez avant de générer.'
      );
    } catch (err) {
      setReplyError(toUserErrorMessage(err, 'Erreur lors de l\'analyse des objectifs. Veuillez réessayer.'));
    } finally {
      setAnalyzingReply(false);
    }
  };

  // Restaure les objectifs d'origine après une analyse
  const handleRestoreReplyDraft = () => {
    if (replyObjBackup !== null) {
      setObjectifsReponse(replyObjBackup);
      setReplyObjBackup(null);
      setLiveMessage('Objectifs d\'origine rétablis.');
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

      // ✅ Le type de production pilote les paramètres : les documents
      // (rapport, commission) partent avec leur valeur historique de
      // « destinataire » et un ton neutre (leur registre est imposé serveur)
      const effectiveDestinataire = docType === 'message'
        ? destinataire
        : DOC_TYPE_TO_DESTINATAIRE[docType];
      const effectiveTon = docType === 'message' ? ton : 'Neutre';

      // ✅ NOUVEAU: Ajout du point de vue pour rapport d'incident
      let contenuAvecPointDeVue = contenu;
      if (docType === 'incident' && pointDeVue === 'premiere') {
        contenuAvecPointDeVue = `[IMPORTANT: Rédiger ce rapport à la PREMIÈRE PERSONNE du singulier (je, j'ai constaté, j'ai observé, etc.)]\n\n${contenu}`;
      }

      // ✅ MODIFICATION: Ajout de la signature dans les paramètres
      const generated = await generateCommunication({
        destinataire: effectiveDestinataire,
        ton: effectiveTon,
        contenu: contenuAvecPointDeVue,
        signature: selectedSignature ? selectedSignature.content : null
      });
      setGeneratedContent(generated.content);
      setGeneratedObjet(docType === 'message' ? generated.objet : null);
      setPreviousVersion(null);
      setGeneratedDocType(docType);
      // Les documents s'ouvrent en aperçu mis en forme, les messages en édition
      setResultView(docType === 'message' ? 'edit' : 'preview');
      logGeneration('communication');
      setLiveMessage(docType === 'message'
        ? 'Communication générée. Le résultat est affiché sous le formulaire.'
        : 'Document généré. L\'aperçu est affiché sous le formulaire.');
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

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text);
    // Toast unifié : accessible et positionné correctement sur mobile
    showToast(ok ? 'Message copié !' : 'La copie a échoué. Veuillez réessayer.', ok ? 'success' : 'error');
  };

  return (
    <div className="focus-accent-blue min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
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

              {/* ✅ Que voulez-vous produire ? Message adressé, ou document
                  administratif (rapport d'incident, dossier commission) —
                  auparavant mélangés dans le menu « destinataire » */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Que voulez-vous produire ?
                </label>
                <div role="radiogroup" aria-label="Type de production" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { value: 'message' as DocType, label: 'Un message', icon: MessageSquare },
                    { value: 'incident' as DocType, label: "Un rapport d'incident", icon: FileText },
                    { value: 'commission' as DocType, label: 'Un dossier pour commission', icon: ClipboardList }
                  ]).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={docType === value}
                      onClick={() => setDocType(value)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all duration-200 ${
                        docType === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
                {docType === 'incident' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Document factuel sans destinataire : date, heure, lieu, personnes impliquées,
                    déroulé chronologique, mesures prises — versable au dossier administratif.
                  </p>
                )}
                {docType === 'commission' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Bilan analytique de présentation en 6 parties (contexte, faits, analyse,
                    impact, propositions, conclusion) — déposez vos notes en vrac, l'outil structure.
                  </p>
                )}
              </div>

              {/* Destinataire et ton : uniquement pour un message adressé */}
              {docType === 'message' && (
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
                      }
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
              )}

              {/* ✅ NOUVEAU: Choix du point de vue pour Rapport d'incident */}
              {docType === 'incident' && (
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
                        applyBriefAnalysis(analysis);
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

              <Button
                onClick={handleGenerate}
                disabled={loading || tokenCount <= 0}
                variant="blue"
                className="w-full"
              >
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
              </Button>
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
                    {generatedDocType === 'incident'
                      ? "Rapport d'incident généré"
                      : generatedDocType === 'commission'
                        ? 'Dossier pour commission généré'
                        : 'Communication générée'}
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {generatedDocType === 'message'
                    ? 'Votre message est prêt ! Vous pouvez l\'éditer si nécessaire'
                    : 'Votre document est prêt ! Relisez-le, modifiez-le si besoin, puis exportez-le en PDF'}
                </p>
              </div>

              <div className="space-y-6">
                {/* ✅ Objet extrait, éditable et copiable séparément (messages) */}
                {generatedDocType === 'message' && generatedObjet !== null && (
                  <div className="space-y-1">
                    <label htmlFor="objet-genere" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Objet
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="objet-genere"
                        type="text"
                        value={generatedObjet}
                        onChange={(e) => setGeneratedObjet(e.target.value)}
                        className="flex-1 border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm font-medium dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedObjet)}
                        title="Copier l'objet"
                        aria-label="Copier l'objet"
                        className="px-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 hover:border-green-300 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ✅ Documents : bascule Aperçu mis en forme / Modifier */}
                {generatedDocType !== 'message' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setResultView('preview')}
                      aria-pressed={resultView === 'preview'}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                        resultView === 'preview'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-green-300'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      Aperçu
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultView('edit')}
                      aria-pressed={resultView === 'edit'}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                        resultView === 'edit'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-green-300'
                      }`}
                    >
                      <PenTool className="w-4 h-4" />
                      Modifier
                    </button>
                  </div>
                )}

                {generatedDocType !== 'message' && resultView === 'preview' ? (
                  <div className="border-2 border-gray-200 dark:border-gray-600 rounded-xl p-6 bg-gray-50 dark:bg-gray-900/40 max-h-[70vh] overflow-y-auto">
                    <EnhancedMarkdownRenderer content={generatedContent} />
                  </div>
                ) : (
                  <Textarea
                    rows={generatedDocType === 'message' ? 8 : 16}
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                    className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                  />
                )}

                {/* ✅ Retouches en un clic + Régénérer + annulation */}
                <div className="flex items-center gap-2 flex-wrap">
                  {generatedDocType === 'message' && (
                    <>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Retoucher :</span>
                      {(Object.keys(REVISION_LABELS) as RevisionKind[]).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => handleRevise(kind)}
                          disabled={revisingKind !== null || loading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {revisingKind === kind && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {REVISION_LABELS[kind]}
                        </button>
                      ))}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={loading || revisingKind !== null}
                    title="Relance une génération complète avec les mêmes réglages"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Régénérer
                  </button>
                  {previousVersion && (
                    <button
                      type="button"
                      onClick={handleUndoRevision}
                      className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      <Undo2 className="w-4 h-4" />
                      Version précédente
                    </button>
                  )}
                </div>

                {/* ✅ Actions : Copier, Messagerie (messages), PDF (documents), Nouvelle communication */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={() => handleCopy(generatedContent)}
                    variant="green"
                    className="flex-1"
                  >
                    <Copy className="w-5 h-5 mr-3" />
                    {generatedDocType === 'message' ? 'Copier le message' : 'Copier le document'}
                  </Button>

                  {generatedDocType === 'message' && (
                    <Button
                      onClick={() => handleOpenInMailer(generatedObjet, generatedContent)}
                      title="Ouvre votre logiciel de messagerie avec l'objet et le message pré-remplis (les messages très longs peuvent être tronqués selon le logiciel — le bouton Copier reste le chemin garanti)"
                      variant="blue"
                      className="flex-1"
                    >
                      <Mail className="w-5 h-5 mr-3" />
                      Ouvrir dans ma messagerie
                    </Button>
                  )}

                  {generatedDocType !== 'message' && (
                    <Button
                      onClick={handleExportPdf}
                      variant="blue"
                      className="flex-1"
                    >
                      <Download className="w-5 h-5 mr-3" />
                      Télécharger en PDF
                    </Button>
                  )}

                  <Button
                    onClick={handleResetCommunication}
                    variant="softGray"
                    className="flex-1"
                  >
                    <RefreshCw className="w-5 h-5 mr-3" />
                    Nouvelle communication
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Fonction 2 - Répondre à une communication */}
          {/* ✅ AJOUT: Ref pour le scroll */}
          <div
            ref={replySectionRef}
            className="focus-accent-purple bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8"
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
                  {/* ✅ Dictée des objectifs → analyse croisée avec le message reçu.
                      Si l'analyse échoue ou si le message reçu manque, la dictée
                      est déposée dans le champ — rien n'est perdu. */}
                  {FEATURES.DICTATION_ENABLED && (
                    <DictationRecorder
                      disabled={loadingReply || analyzingReply}
                      buttonLabel="Dicter et pré-remplir"
                      buttonTitle="Dictez vos objectifs : le ton est suggéré, les objectifs structurés, et les points du message restés sans réponse sont signalés (100 crédits par minute entamée + coût de l'analyse)"
                      processingLabel="Transcription et analyse en cours…"
                      onTranscript={async (text) => {
                        const merged = objectifsReponse.trim() ? `${objectifsReponse}\n${text}` : text;
                        if (!messageRecu.trim()) {
                          setObjectifsReponse(merged);
                          setReplyError('Dictée déposée dans les objectifs. Collez le message reçu puis cliquez « Analyser et pré-remplir » pour le croisement.');
                          setLiveMessage('Dictée déposée dans les objectifs.');
                          return;
                        }
                        setAnalyzingReply(true);
                        setReplyError(null);
                        try {
                          const analysis = await analyzeReplyBrief(messageRecu, merged);
                          setReplyObjBackup(merged);
                          setTonReponse(analysis.ton);
                          setObjectifsReponse(analysis.contenu);
                          setReplyManques(analysis.manques);
                          setLiveMessage(
                            analysis.manques.length > 0
                              ? 'Objectifs pré-remplis depuis votre dictée. Des points du message sans réponse ont été signalés.'
                              : 'Objectifs pré-remplis depuis votre dictée. Vérifiez avant de générer.'
                          );
                        } catch {
                          setObjectifsReponse(merged);
                          setReplyManques([]);
                          setReplyError('L\'analyse a échoué — votre dictée a été déposée dans les objectifs. Vous pouvez cliquer « Analyser et pré-remplir ».');
                          setLiveMessage('Dictée déposée dans les objectifs, analyse à relancer.');
                        } finally {
                          setAnalyzingReply(false);
                        }
                      }}
                    />
                  )}
                  <Textarea
                    rows={3}
                    placeholder="Quels éléments doit contenir la réponse ?"
                    value={objectifsReponse}
                    onChange={(e) => setObjectifsReponse(e.target.value)}
                    className="border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                  />

                  {/* ✅ Analyse des objectifs tapés/collés (miroir du côté création) */}
                  {FEATURES.BRIEF_ANALYSIS_ENABLED && (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {replyObjBackup !== null ? (
                        <button
                          type="button"
                          onClick={handleRestoreReplyDraft}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        >
                          <Undo2 className="w-4 h-4" />
                          Rétablir mes objectifs d'origine
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          L'analyse vérifie que vos objectifs répondent à tout le message
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAnalyzeReply()}
                        disabled={analyzingReply || loadingReply || !objectifsReponse.trim() || !messageRecu.trim()}
                        title="Compare vos objectifs avec le message reçu : ton suggéré, objectifs structurés, points sans réponse signalés"
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {analyzingReply ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analyse en cours…
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4" />
                            Analyser et pré-remplir
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ Points du message sans réponse, signalés par l'analyse */}
              {replyManques.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                          Avant de générer la réponse :
                        </p>
                        <ul className="mt-1 space-y-0.5 text-sm text-amber-700 dark:text-amber-300/90 list-disc list-inside">
                          {replyManques.map((manque, index) => (
                            <li key={index}>{manque}</li>
                          ))}
                        </ul>
                        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400/80">
                          Complétez vos objectifs si besoin — la génération fonctionnera aussi sans.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyManques([])}
                      aria-label="Masquer ces suggestions"
                      className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {replyError && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-red-700 dark:text-red-300 font-medium">❌ {replyError}</p>
                </div>
              )}

              <Button
                onClick={handleGenerateReply}
                disabled={loadingReply || tokenCount <= 0}
                variant="purple"
                className="w-full"
              >
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
              </Button>
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

                {/* ✅ Retouches en un clic + Régénérer + annulation */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Retoucher :</span>
                  {(Object.keys(REVISION_LABELS) as RevisionKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => handleReviseReply(kind)}
                      disabled={revisingReplyKind !== null || loadingReply}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {revisingReplyKind === kind && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {REVISION_LABELS[kind]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleGenerateReply}
                    disabled={loadingReply || revisingReplyKind !== null}
                    title="Relance une génération complète avec les mêmes réglages"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Régénérer
                  </button>
                  {previousReplyVersion !== null && (
                    <button
                      type="button"
                      onClick={handleUndoReplyRevision}
                      className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      <Undo2 className="w-4 h-4" />
                      Version précédente
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={() => handleCopy(generatedReply)}
                    variant="green"
                    className="flex-1"
                  >
                    <Copy className="w-5 h-5 mr-3" />
                    Copier la réponse
                  </Button>

                  <Button
                    onClick={() => handleOpenInMailer(null, generatedReply)}
                    title="Ouvre votre logiciel de messagerie avec la réponse pré-remplie (répondez de préférence depuis le fil de discussion d'origine)"
                    variant="blue"
                    className="flex-1"
                  >
                    <Mail className="w-5 h-5 mr-3" />
                    Ouvrir dans ma messagerie
                  </Button>

                  <Button
                    onClick={() => {
                      setMessageRecu('');
                      setObjectifsReponse('');
                      setGeneratedReply('');
                      setReplyError(null);
                      setReplyObjBackup(null);
                      setReplyManques([]);
                      setPreviousReplyVersion(null);
                    }}
                    variant="softBlue"
                    className="flex-1"
                  >
                    <RefreshCw className="w-5 h-5 mr-3" />
                    Nouvelle demande
                  </Button>
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
