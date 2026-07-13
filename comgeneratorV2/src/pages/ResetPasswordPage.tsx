// src/pages/ResetPasswordPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { Key, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  
  // 🔐 SÉCURITÉ: Stocker les tokens SANS les utiliser pour la session
  const [storedTokens, setStoredTokens] = useState<{accessToken: string, refreshToken: string} | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema)
  });

  // 🔒 SÉCURITÉ: NE PAS forcer la déconnexion au début car cela invalide les tokens
  // La déconnexion se fera après le changement de mot de passe réussi
  /* 
  useEffect(() => {
    const forceSignOut = async () => {
      await supabase.auth.signOut();
      console.log('🔒 Déconnexion sécurisée forcée sur la page reset password');
    };
    
    forceSignOut();
  }, []);
  */

  // Vérifier la validité du token au chargement SANS créer de session
  useEffect(() => {
    const checkTokenValidity = async () => {
      // 🔧 FIX: Lire les tokens depuis le fragment (#) au lieu des query params (?)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      let accessToken = hashParams.get('access_token');
      let refreshToken = hashParams.get('refresh_token');

      // Fallback: essayer aussi les query parameters au cas où
      if (!accessToken || !refreshToken) {
        accessToken = searchParams.get('access_token');
        refreshToken = searchParams.get('refresh_token');
      }

      if (!accessToken || !refreshToken) {
        setIsValidToken(false);
        setError('Lien invalide ou expiré. Veuillez demander un nouveau lien de réinitialisation.');
        return;
      }

      // 🔒 SÉCURITÉ: Stocker les tokens SANS créer de session
      // L'utilisateur ne sera authentifié qu'APRÈS avoir changé son mot de passe
      setStoredTokens({ accessToken, refreshToken });
      setIsValidToken(true);
    };

    checkTokenValidity();
  }, [searchParams]);

  // 🧹 Nettoyer l'URL après avoir lu les tokens (sécurité)
  useEffect(() => {
    if (storedTokens) {
      // Supprimer les tokens de l'URL pour éviter qu'ils restent visibles
      window.history.replaceState({}, document.title, '/reset-password');
    }
  }, [storedTokens]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      setError(null);

      if (!storedTokens) {
        throw new Error('Tokens manquants. Veuillez utiliser un nouveau lien.');
      }

      // 🔐 OPTION 1: Utiliser directement updateUser sans setSession
      // Car les tokens sont peut-être déjà actifs dans la session courante
      let updateError = null;
      
      try {
        const { error } = await supabase.auth.updateUser({
          password: data.password
        });
        updateError = error;
      } catch (err: any) {
        updateError = err;
      }

      // Si ça ne marche pas, essayer avec setSession d'abord
      if (updateError) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: storedTokens.accessToken,
          refresh_token: storedTokens.refreshToken
        });

        if (sessionError) {
          console.error('❌ Erreur setSession:', sessionError);
          throw new Error('Lien expiré ou invalide. Veuillez demander un nouveau lien.');
        }

        // Réessayer updateUser après setSession
        const { error: updateError2 } = await supabase.auth.updateUser({
          password: data.password
        });

        if (updateError2) {
          console.error('❌ Erreur updateUser après setSession:', updateError2);
          throw updateError2;
        }
      }

      // 🔒 SÉCURITÉ: Déconnecter après le changement réussi
      await supabase.auth.signOut();

      setSuccess(true);

      // Redirection après 3 secondes
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (error: any) {
      console.error('❌ Erreur lors du reset:', error);
      setError(error.message || 'Une erreur est survenue lors de la mise à jour du mot de passe.');
      
      // En cas d'erreur, s'assurer qu'on est déconnecté
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('Erreur lors de la déconnexion:', signOutError);
      }
    }
  };

  // Lien invalide
  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Lien invalide
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {error || 'Ce lien de réinitialisation est invalide ou a expiré.'}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Succès
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Mot de passe mis à jour !
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Votre mot de passe a été modifié avec succès. Vous allez être redirigé vers la page de connexion.
            </p>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-700 dark:text-green-300">
                Redirection automatique dans quelques secondes...
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Se connecter maintenant
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Chargement
  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Vérification du lien...</p>
          </div>
        </div>
      </div>
    );
  }

  // Formulaire de réinitialisation
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Nouveau mot de passe
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Définissez un nouveau mot de passe pour votre compte ProfAssist
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Nouveau mot de passe */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                {...register('password')}
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Minimum 6 caractères"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          {/* Confirmer mot de passe */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative">
              <input
                {...register('confirmPassword')}
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Répétez le mot de passe"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Bouton */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <Key className="animate-spin w-5 h-5 mr-2" />
                Mise à jour...
              </span>
            ) : (
              'Mettre à jour le mot de passe'
            )}
          </button>
        </form>

        {/* Lien retour */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
          >
            ← Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  );
}