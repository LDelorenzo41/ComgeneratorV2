// src/components/communication/DictationRecorder.tsx
// Dictée vocale (lot 3 v0.1) : enregistre au micro (3 min max), transcrit via
// l'Edge Function transcribe (Mistral Voxtral) et transmet le texte au parent.
//
// Principes :
// - L'audio n'est jamais stocké : il part à la transcription puis est oublié.
// - Premier usage : encart d'information (confidentialité + coût), accord
//   mémorisé en localStorage.
// - Dégradation douce : navigateur sans micro/MediaRecorder → bouton
//   désactivé avec explication, aucune autre fonctionnalité affectée.

import React from 'react';
import { Mic, Square, Loader2, X, ShieldCheck } from 'lucide-react';
import { transcribeAudio } from '../../lib/transcribeAudio';

const MAX_SECONDS = 180; // 3 minutes
const NOTICE_ACK_KEY = 'profassist_dictation_notice_ack';

type Phase = 'idle' | 'notice' | 'recording' | 'transcribing';

interface DictationRecorderProps {
  /** Reçoit le texte transcrit (à insérer dans le champ cible) */
  onTranscript: (text: string) => void;
  /** Désactive le déclenchement (ex. pendant une génération) */
  disabled?: boolean;
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'audio/mp4',              // Safari / iOS, Chrome récents — accepté par Mistral (M4A)
    'audio/ogg;codecs=opus',  // Firefox — accepté par Mistral (OGG)
    'audio/webm;codecs=opus', // Chrome — vérifié au spike côté Mistral
    'audio/webm',
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? null;
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function DictationRecorder({ onTranscript, disabled }: DictationRecorderProps) {
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [seconds, setSeconds] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState(''); // annonce aria-live

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const timerRef = React.useRef<number | null>(null);
  const secondsRef = React.useRef(0);
  const cancelledRef = React.useRef(false);
  const mimeTypeRef = React.useRef<string>('audio/webm');

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    pickMimeType() !== null;

  const cleanupMedia = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  // Libération du micro si le composant est démonté en cours d'enregistrement
  React.useEffect(() => {
    return () => {
      cancelledRef.current = true;
      cleanupMedia();
    };
  }, [cleanupMedia]);

  const handleRecordingComplete = React.useCallback(async () => {
    const duration = secondsRef.current;
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    chunksRef.current = [];
    cleanupMedia();

    if (cancelledRef.current || blob.size === 0 || duration === 0) {
      setPhase('idle');
      setStatus('Dictée annulée.');
      return;
    }

    setPhase('transcribing');
    setStatus('Transcription en cours…');
    try {
      const text = await transcribeAudio(blob, duration, mimeTypeRef.current);
      onTranscript(text);
      setStatus('Texte ajouté au champ de contenu.');
      setPhase('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la transcription.');
      setStatus('La transcription a échoué.');
      setPhase('idle');
    }
  }, [cleanupMedia, onTranscript]);

  const startRecording = React.useCallback(async () => {
    setError(null);
    cancelledRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setError("Accès au micro refusé. Autorisez le micro dans votre navigateur, puis réessayez.");
      } else if (err?.name === 'NotFoundError') {
        setError('Aucun micro détecté sur cet appareil.');
      } else {
        setError("Impossible d'accéder au micro. Veuillez réessayer.");
      }
      return;
    }

    let recorder: MediaRecorder;
    const preferred = pickMimeType();
    try {
      recorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }

    mimeTypeRef.current = recorder.mimeType || preferred || 'audio/webm';
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = handleRecordingComplete;

    streamRef.current = stream;
    recorderRef.current = recorder;
    secondsRef.current = 0;
    setSeconds(0);
    setPhase('recording');
    setStatus('Enregistrement en cours.');

    recorder.start();
    timerRef.current = window.setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= MAX_SECONDS) {
        // Durée maximale atteinte : on termine proprement
        recorderRef.current?.stop();
      }
    }, 1000);
  }, [handleRecordingComplete]);

  const handleMicClick = () => {
    if (disabled || phase !== 'idle') return;
    if (!localStorage.getItem(NOTICE_ACK_KEY)) {
      setPhase('notice');
      return;
    }
    startRecording();
  };

  const acceptNoticeAndStart = () => {
    localStorage.setItem(NOTICE_ACK_KEY, new Date().toISOString());
    setPhase('idle');
    startRecording();
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
  };

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="La dictée vocale n'est pas prise en charge par ce navigateur"
        aria-label="Dictée vocale non prise en charge par ce navigateur"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed"
      >
        <Mic className="w-4 h-4" />
        Dicter
      </button>
    );
  }

  return (
    <div>
      {/* Annonce des changements d'état aux lecteurs d'écran */}
      <div className="sr-only" role="status" aria-live="polite">{status}</div>

      {/* Déclencheur */}
      {phase === 'idle' && (
        <button
          type="button"
          onClick={handleMicClick}
          disabled={disabled}
          title="Dicter le contenu au micro (1 000 crédits par minute entamée)"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Mic className="w-4 h-4" />
          Dicter
        </button>
      )}

      {/* Encart d'information au premier usage */}
      {phase === 'notice' && (
        <div className="mt-2 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <p>
                Votre enregistrement vocal est envoyé à <strong>Mistral AI</strong> (hébergement
                en Europe) pour être transcrit, puis il est supprimé — ProfAssist ne conserve
                jamais l'audio. Évitez de dicter des informations sensibles (santé, situation
                familiale…).
              </p>
              <p>
                <strong>Coût :</strong> 1 000 crédits par minute entamée
                (ex. : une dictée de 1 min 30 = 2 000 crédits). Durée maximale : 3 minutes.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={acceptNoticeAndStart}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Mic className="w-4 h-4" />
              Commencer la dictée
            </button>
          </div>
        </div>
      )}

      {/* Barre d'enregistrement */}
      {phase === 'recording' && (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 flex-wrap">
          <span className="relative flex h-3 w-3" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enregistrement… {formatSeconds(seconds)} / {formatSeconds(MAX_SECONDS)}
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Terminer
            </button>
            <button
              type="button"
              onClick={cancelRecording}
              title="Annuler la dictée (aucun crédit débité)"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Transcription en cours */}
      {phase === 'transcribing' && (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Transcription en cours…
          </span>
        </div>
      )}

      {/* Erreur */}
      {error && phase === 'idle' && (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Fermer le message d'erreur"
            className="text-red-400 hover:text-red-600 dark:hover:text-red-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default DictationRecorder;
