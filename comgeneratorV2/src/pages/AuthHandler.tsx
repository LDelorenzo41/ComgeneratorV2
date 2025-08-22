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
        console.log('🔐 Traitement du callback d\'authentification...');
        console.log('URL actuelle:', window.location.href);
        console.log('📍 Pathname:', location.pathname);
        console.log('📍 Hash:', window.location.hash);

        // Vérifier si on est sur la route /auth/callback
        if (location.pathname !== '/auth/callback') {
          console.log('❌ Pas sur la route callback, redirection vers landing');
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

        console.log('📋 Paramètres trouvés:', { 
          accessToken: !!accessToken, 
          refreshToken: !!refreshToken, 
          type, 
          error,
          errorDescription 
        });

        // ✅ NOUVELLE LOGIQUE : Si pas de tokens, vérifier si l'utilisateur est déjà connecté
        if (!accessToken && !refreshToken) {
          console.log('🔍 Pas de tokens dans l\'URL, vérification de la session existante...');
          
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            console.log('✅ Utilisateur déjà connecté:', session.user.email);
            
            // Vérifier si l'email est confirmé
            if (session.user.email_confirmed_at) {
              console.log('✅ Email déjà confirmé, redirection vers dashboard');
              navigate('/dashboard');
              return;
            } else {
              console.log('❌ Email non confirmé');
              setStatus('error');
              setMessage('Votre email n\'est pas encore confirmé. Veuillez vérifier votre boîte de réception.');
              return;
            }
          } else {
            console.log('❌ Aucune session active, redirection vers landing');
            navigate('/landing');
            return;
          }
        }

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

        // Traitement avec tokens présents
        if (accessToken && refreshToken) {
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

          console.log('✅ Session définie avec succès:', data.user?.email);
          console.log('✅ Email confirmé le:', data.user?.email_confirmed_at);
          
          setStatus('success');
          setMessage(`Email confirmé avec succès pour ${data.user?.email} !`);

          // Nettoyer l'URL
          window.history.replaceState({}, document.title, '/dashboard');

          // Redirection robuste avec fallback
          setTimeout(() => {
            try {
              console.log('🔄 Tentative de redirection...');
              navigate('/dashboard');
            } catch (navError) {
              console.log('❌ Navigate échoué, utilisation de window.location');
              window.location.href = '/dashboard';
            }
          }, 2000);
        }

      } catch (error) {
        console.error('💥 Erreur inattendue:', error);
        setStatus('error');
        setMessage('Une erreur inattendue s\'est produite. Veuillez réessayer.');
      }
    };

    handleAuthCallback();
  }, [navigate, location.pathname]);

  // États d'affichage
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 text-blue-600 animate-spin mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Vérification de votre session...
          </h1>
          <p className="text-gray-600">
            Veuillez patienter pendant que nous vous redirigeons.
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
              🎉 Votre compte est maintenant actif !<br/>
              Redirection automatique vers votre tableau de bord...
            </p>
          </div>
          <button
            onClick={() => {
              try {
                navigate('/dashboard');
              } catch (error) {
                window.location.href = '/dashboard';
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Accéder maintenant au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <RefreshCw className="mx-auto h-16 w-16 text-orange-500 mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Lien expiré
          </h1>
          <p className="text-gray-600 mb-6">
            {message}
          </p>
          <div className="bg-orange-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-orange-700">
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
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors"
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Erreur de confirmation
        </h1>
        <p className="text-gray-600 mb-6">
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
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  );
}