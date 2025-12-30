// src/pages/UnsubscribePage.tsx
// Page de désabonnement à la newsletter (accessible sans authentification)

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Mail, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type UnsubscribeStatus = 'loading' | 'success' | 'error' | 'invalid';

export function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<UnsubscribeStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const token = searchParams.get('token');

  useEffect(() => {
    const processUnsubscribe = async () => {
      if (!token) {
        setStatus('invalid');
        return;
      }

      try {
        // Appeler la fonction RPC de désabonnement
        const { data, error } = await supabase.rpc('unsubscribe_newsletter', {
          user_token: token,
        });

        if (error) {
          console.error('Unsubscribe error:', error);
          setStatus('error');
          setErrorMessage(error.message);
          return;
        }

        if (data?.success) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage(data?.message || 'Une erreur est survenue');
        }
      } catch (err: any) {
        console.error('Unsubscribe error:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Une erreur est survenue');
      }
    };

    processUnsubscribe();
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        
        {/* Loading */}
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Traitement en cours...
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Veuillez patienter pendant que nous traitons votre demande.
            </p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Désabonnement confirmé
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Vous avez été désabonné de la newsletter ProfAssist.
              Vous ne recevrez plus d'emails de notre part.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Vous pouvez vous réabonner à tout moment depuis les paramètres de votre compte.
              </p>
            </div>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Erreur
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Une erreur est survenue lors du désabonnement.
            </p>
            {errorMessage && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 dark:text-red-300">{errorMessage}</p>
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Contactez-nous à{' '}
              <a href="mailto:contact-profassist@teachtech.fr" className="text-blue-600 dark:text-blue-400 hover:underline">
                contact-profassist@teachtech.fr
              </a>
            </p>
          </>
        )}

        {/* Invalid token */}
        {status === 'invalid' && (
          <>
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Lien invalide
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Ce lien de désabonnement n'est pas valide ou a expiré.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Si vous souhaitez vous désabonner, connectez-vous à votre compte
              et modifiez vos préférences dans les paramètres.
            </p>
          </>
        )}

        {/* Lien retour */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Link
            to="/landing"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← Retour à l'accueil ProfAssist
          </Link>
        </div>
      </div>
    </div>
  );
}
