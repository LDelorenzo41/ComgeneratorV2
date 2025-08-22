import React from 'react';
import { useAuthStore } from '../../lib/store';
import { Mail, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmailConfirmationGuardProps {
  children: React.ReactNode;
}

export function EmailConfirmationGuard({ children }: EmailConfirmationGuardProps) {
  const { user } = useAuthStore();
  const [isResending, setIsResending] = React.useState(false);
  const [resendSuccess, setResendSuccess] = React.useState(false);

  // Vérifier si l'email est confirmé
  const isEmailConfirmed = user?.email_confirmed_at != null;

  // Fonction pour renvoyer l'email de confirmation
  const resendConfirmation = async () => {
    if (!user?.email) return;
    
    try {
      setIsResending(true);
      
      // Fonction pour obtenir l'URL de redirection dynamique
      const getRedirectURL = () => {
        if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('app.github.dev')) {
          return `${window.location.origin}/auth/callback`;
        }
        return `${window.location.origin}/auth/callback`;
      };

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: getRedirectURL()
        }
      });

      if (error) throw error;
      
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
      
    } catch (error) {
      console.error('Erreur lors du renvoi:', error);
    } finally {
      setIsResending(false);
    }
  };

  // Si l'email n'est pas confirmé, bloquer l'accès
  if (!isEmailConfirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <Mail className="mx-auto h-16 w-16 text-amber-500 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Confirmez votre email
            </h1>
            <p className="text-gray-600">
              Votre adresse email <span className="font-semibold text-blue-600">{user?.email}</span> doit être confirmée avant d'accéder à ProfAssist.
            </p>
          </div>

          <div className="bg-amber-50 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">
                  Accès temporairement bloqué
                </h3>
                <p className="mt-1 text-sm text-amber-700">
                  Toutes les fonctionnalités sont inaccessibles jusqu'à la confirmation de votre email.
                </p>
              </div>
            </div>
          </div>

          {resendSuccess && (
            <div className="bg-green-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-700 text-center">
                ✅ Email de confirmation renvoyé ! Vérifiez votre boîte de réception.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={resendConfirmation}
              disabled={isResending}
              className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              {isResending ? (
                <>
                  <Mail className="animate-pulse -ml-1 mr-2 h-4 w-4" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Mail className="-ml-1 mr-2 h-4 w-4" />
                  Renvoyer l'email de confirmation
                </>
              )}
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              Se déconnecter
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Email non reçu ? Vérifiez vos spams ou contactez le support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Email confirmé : accès autorisé (le système de tokens existant prend le relais)
  return <>{children}</>;
}