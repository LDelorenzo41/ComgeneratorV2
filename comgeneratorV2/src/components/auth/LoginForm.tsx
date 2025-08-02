import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase, checkProjectStatus, isSupabaseConfigured } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, Wifi, WifiOff } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères')
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  // Monitor online status
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getDetailedErrorMessage = (error: any): string => {
    console.error('Detailed error:', error);

    // Check if user is offline
    if (!navigator.onLine) {
      return 'Vous êtes hors ligne. Veuillez vérifier votre connexion internet.';
    }

    // Check Supabase configuration
    if (!isSupabaseConfigured()) {
      return 'Configuration Supabase manquante. Veuillez contacter l\'administrateur.';
    }

    // Handle specific error types
    if (error.message === 'Failed to fetch') {
      return 'Impossible de se connecter au serveur. Cela peut être dû à :\n• Votre projet Supabase est en pause (réactivez-le depuis votre tableau de bord)\n• Problème de connexion internet\n• Pare-feu ou VPN bloquant la connexion';
    }

    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return 'La connexion a expiré. Veuillez vérifier votre connexion internet et réessayer.';
    }

    if (error.message === 'Invalid login credentials') {
      return 'Email ou mot de passe incorrect.';
    }

    if (error.message === 'Email not confirmed') {
      return 'Votre email n\'a pas été confirmé. Veuillez vérifier votre boîte de réception pour le lien de confirmation.';
    }

    if (error.name === 'AuthRetryableFetchError') {
      return 'Problème de connexion au serveur d\'authentification. Veuillez réessayer dans quelques instants.';
    }

    if (error.message.includes('en pause')) {
      return error.message;
    }

    // Generic network errors
    if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
      return 'Erreur de réseau. Vérifiez votre connexion internet et que votre projet Supabase est actif.';
    }

    return error.message || 'Une erreur inattendue est survenue. Veuillez réessayer.';
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);

      // Check if user is online
      if (!navigator.onLine) {
        throw new Error('offline');
      }

      // Check project status first
      try {
        await checkProjectStatus();
      } catch (statusError: any) {
        throw statusError;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      
      if (signInError) {
        throw signInError;
      }

      navigate('/dashboard');
    } catch (error: any) {
      const errorMessage = getDetailedErrorMessage(error);
      setError(errorMessage);
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Connection status indicator */}
      <div className="mb-4 flex items-center justify-center">
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs ${
          isOnline 
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
        }`}>
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span>{isOnline ? 'En ligne' : 'Hors ligne'}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Email
          </label>
          <input
            {...register('email')}
            type="email"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Mot de passe
          </label>
          <input
            {...register('password')}
            type="password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Erreur de connexion
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <pre className="whitespace-pre-wrap font-sans">{error}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !isOnline}
          className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <LogIn className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Connexion...
            </span>
          ) : (
            'Se connecter'
          )}
        </button>

        {!isOnline && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Connexion internet requise pour se connecter
          </p>
        )}
      </form>
    </div>
  );
}