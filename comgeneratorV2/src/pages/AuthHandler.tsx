import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, AlertCircle, Loader, RefreshCw } from 'lucide-react';

export function AuthHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Vérifier si on est sur la route /auth/callback
        if (location.pathname !== '/auth/callback') {
          navigate('/landing');
          return;
        }

        // Extraire les paramètres de l'URL (après le #)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        // Gérer les erreurs dans l'URL
        if (error) {
          console.error('❌ Erreur dans l\'URL:', error, errorDescription);
          
          if (error === 'access_denied') {
            setStatus('error');
            setMessage('Confirmation annulée. Vous pouvez fermer cet onglet et réessayer.');
            return;
          }
          
          if (error === 'expired_token' || errorDescription?.includes('expired')) {
            setStatus('expired');
            setMessage('Le lien de confirmation a expiré. Veuillez demander un nouveau lien.');
            return;
          }
          
          setStatus('error');
          setMessage('Erreur lors de la confirmation. Veuillez réessayer ou contacter le support.');
          return;
        }

        // Vérifier la présence des tokens
        if (!accessToken || !refreshToken) {
          navigate('/landing');
          return;
        }

        // Définir la session avec les tokens
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          console.error('❌ Erreur lors de la définition de la session:', sessionError);
          
          if (sessionError.message.includes('expired')) {
            setStatus('expired');
            setMessage('Le lien de confirmation a expiré. Veuillez vous inscrire à nouveau.');
            return;
          }
          
          setStatus('error');
          setMessage('Erreur lors de la confirmation de l\'email. Veuillez réessayer.');
          return;
        }

        // Vérifier que l'utilisateur est bien confirmé
        if (!data.user?.email_confirmed_at) {
          console.error('❌ Email non confirmé malgré la session');
          setStatus('error');
          setMessage('Votre email n\'a pas pu être confirmé. Veuillez réessayer.');
          return;
        }

        setStatus('success');
        setMessage(`Email confirmé avec succès pour ${data.user?.email} !`);

        // Nettoyer l'URL
        window.history.replaceState({}, document.title, '/mon-espace');

        // Redirection robuste avec fallback
        setTimeout(() => {
          try {
            navigate('/mon-espace');
          } catch (navError) {
            window.location.href = '/mon-espace';
          }
        }, 3000);

      } catch (error) {
        console.error('💥 Erreur inattendue:', error);
        setStatus('error');
        setMessage('Une erreur inattendue s\'est produite. Veuillez réessayer.');
      }
    };

    // Vérifier si nous sommes sur une page avec des tokens
    if (window.location.hash.includes('access_token') || location.pathname === '/auth/callback') {
      handleAuthCallback();
    } else {
      // Pas de tokens, rediriger vers landing
      navigate('/landing');
    }
  }, [navigate, location.pathname]);

  // États d'affichage
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 text-blue-600 animate-spin mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Confirmation de votre email...
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Veuillez patienter pendant que nous confirmons votre adresse email.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-green-900/10 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Email confirmé !
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {message}
          </p>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-700 dark:text-green-300">
              🎉 Votre compte est maintenant actif !<br/>
              Redirection automatique vers votre espace...
            </p>
          </div>
          <button
            onClick={() => {
              try {
                navigate('/mon-espace');
              } catch (error) {
                window.location.href = '/mon-espace';
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Accéder à mon espace
          </button>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-orange-900/10 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <RefreshCw className="mx-auto h-16 w-16 text-orange-500 mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Lien expiré
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {message}
          </p>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Les liens de confirmation expirent après 24 heures pour votre sécurité.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/register')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Créer un nouveau compte
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3 px-6 rounded-lg transition-colors"
            >
              J'ai déjà un compte
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Erreur
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-red-900/10 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Erreur de confirmation
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {message}
        </p>
        <div className="space-y-3">
          <button
            onClick={() => navigate('/register')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Réessayer l'inscription
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  );
}