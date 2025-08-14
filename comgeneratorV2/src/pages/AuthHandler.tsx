import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

export function AuthHandler() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Traitement du callback d\'authentification...');
        console.log('URL actuelle:', window.location.href);

        // Extraire les paramètres de l'URL (après le #)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        console.log('Tokens trouvés:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });

        if (accessToken && refreshToken) {
          // Définir la session avec les tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error('Erreur lors de la définition de la session:', error);
            setStatus('error');
            setMessage('Erreur lors de la confirmation de l\'email');
            return;
          }

          console.log('Session définie avec succès:', data.user?.email);
          setStatus('success');
          setMessage(`Email confirmé pour ${data.user?.email} !`);

          // Nettoyer l'URL
          window.history.replaceState({}, document.title, '/dashboard');

          // Rediriger après 2 secondes
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);

        } else {
          console.log('Aucun token trouvé dans l\'URL, redirection vers landing');
          // Pas de tokens, rediriger vers landing
          navigate('/landing');
        }

      } catch (error) {
        console.error('Erreur inattendue:', error);
        setStatus('error');
        setMessage('Une erreur inattendue s\'est produite');
      }
    };

    // Vérifier si nous sommes sur une page avec des tokens
    if (window.location.hash.includes('access_token')) {
      handleAuthCallback();
    } else {
      // Pas de tokens, rediriger vers landing
      navigate('/landing');
    }
  }, [navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 text-blue-600 animate-spin mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Confirmation de votre email...
          </h1>
          <p className="text-gray-600">
            Veuillez patienter pendant que nous traitons votre confirmation.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Email confirmé !
          </h1>
          <p className="text-gray-600 mb-6">
            {message}
          </p>
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-700">
              Redirection automatique vers votre tableau de bord...
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Accéder maintenant au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Erreur de confirmation
        </h1>
        <p className="text-gray-600 mb-6">
          {message}
        </p>
        <button
          onClick={() => navigate('/login')}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  );
}