import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = React.useState('Vérification du paiement en cours...');
  const [tokensAdded, setTokensAdded] = React.useState<number | null>(null);
  const [hasVerified, setHasVerified] = React.useState(false); // AJOUT: Flag pour éviter les doublons

  React.useEffect(() => {
    if (!sessionId || !user) {
      navigate('/buy-tokens');
      return;
    }

    // AJOUT: Vérifier si déjà en cours avec sessionStorage
    const verificationKey = `payment_verified_${sessionId}`;
    const isAlreadyVerified = sessionStorage.getItem(verificationKey);
    
    if (isAlreadyVerified) {
      console.log('⚠️ Payment already verified, redirecting...');
      setStatus('success');
      setMessage('Paiement déjà confirmé ! Redirection...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
      return;
    }

    if (hasVerified) {
      return;
    }

    // Marquer comme vérifié IMMÉDIATEMENT
    console.log('🔍 Starting payment verification for session:', sessionId);
    sessionStorage.setItem(verificationKey, 'true');
    setHasVerified(true);
    verifyPayment();
  }, [sessionId, user, hasVerified, navigate]);

  const verifyPayment = async () => {
    // Vérification supplémentaire
    const verificationKey = `payment_verified_${sessionId}`;
    if (sessionStorage.getItem(verificationKey) && hasVerified) {
      console.log('⚠️ Payment already being verified, skipping');
      return;
    }

    try {
      console.log('🔍 Verifying payment for session:', sessionId); // AJOUT: Log pour debug

      // Appel à notre fonction de vérification
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          sessionId,
          userId: user.id
        })
      });

      const result = await response.json();
      console.log('💰 Payment verification result:', result); // AJOUT: Log pour debug

      if (response.ok && result.success) {
        setStatus('success');
        if (result.alreadyProcessed) {
          setMessage('Paiement déjà confirmé ! Vos tokens sont disponibles.');
        } else {
          setMessage('Paiement confirmé ! Vos tokens ont été ajoutés.');
        }
        setTokensAdded(result.tokensAdded);
        
        // AJOUT: Notifier le Header de la mise à jour des tokens
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tokensUpdated'));
        }
        
        // Redirection après 3 secondes
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(result.error || 'Erreur lors de la vérification du paiement');
        setHasVerified(false); // AJOUT: Permettre de réessayer
      }
    } catch (error) {
      console.error('💥 Payment verification error:', error);
      setStatus('error');
      setMessage('Erreur lors de la vérification du paiement');
      setHasVerified(false); // AJOUT: Permettre de réessayer
    }
  };

  // MODIFICATION: Reset du flag hasVerified pour permettre de réessayer
  const handleRetry = () => {
    const verificationKey = `payment_verified_${sessionId}`;
    sessionStorage.removeItem(verificationKey); // AJOUT: Supprimer le flag sessionStorage
    setHasVerified(false);
    setStatus('loading');
    setMessage('Vérification du paiement en cours...');
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Session invalide
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Aucune session de paiement trouvée
          </p>
          <button
            onClick={() => navigate('/buy-tokens')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            Retour aux achats
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Vérification en cours
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {message}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Paiement réussi !
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {message}
              </p>
              {tokensAdded && (
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 mb-4">
                  <p className="text-green-800 dark:text-green-200 font-medium">
                    +{tokensAdded.toLocaleString()} tokens ajoutés
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Redirection vers le dashboard dans 3 secondes...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Erreur
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {message}
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleRetry}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                >
                  Réessayer
                </button>
                <button
                  onClick={() => navigate('/buy-tokens')}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium"
                >
                  Retour aux achats
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}