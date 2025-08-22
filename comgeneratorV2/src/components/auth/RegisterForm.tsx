import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Mail, CheckCircle, AlertCircle } from 'lucide-react';

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string(),
  newsletter: z.boolean().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  const [emailSent, setEmailSent] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string>('');
  
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      newsletter: false
    }
  });

  // Surveiller la valeur de newsletter
  const newsletterValue = watch('newsletter');

  // Fonction pour obtenir l'URL de redirection dynamique
  const getRedirectURL = () => {
    if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('app.github.dev')) {
      return `${window.location.origin}/auth/callback`;
    }
    return `${window.location.origin}/auth/callback`;
  };

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setError(null);
      console.log('📧 Valeur newsletter lors de la soumission:', data.newsletter);

      // ✅ Inscription avec confirmation d'email + newsletter
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: getRedirectURL(),
          data: {
            created_at: new Date().toISOString(),
            newsletter_subscription: data.newsletter === true // Conversion explicite
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          throw new Error('Un compte existe déjà avec cet email. Vérifiez votre boîte de réception pour confirmer votre email, ou connectez-vous.');
        }
        if (signUpError.name === 'AuthRetryableFetchError') {
          throw new Error('Problème de connexion au serveur. Veuillez réessayer.');
        }
        if (signUpError.message === 'Failed to fetch') {
          throw new Error('Impossible de se connecter au serveur. Veuillez vérifier votre connexion internet.');
        }
        throw signUpError;
      }

      // ✅ AJOUT : Mise à jour explicite du profil avec la newsletter
      if (signUpData.user) {
        console.log('🔄 Mise à jour du profil avec newsletter:', data.newsletter);
        
        // Attendre un peu que le trigger crée le profil
        setTimeout(async () => {
          try {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ newsletter_subscription: data.newsletter === true })
              .eq('user_id', signUpData.user.id);

            if (updateError) {
              console.error('Erreur mise à jour newsletter:', updateError);
            } else {
              console.log('✅ Newsletter mise à jour avec succès');
            }
          } catch (updateError) {
            console.error('Erreur lors de la mise à jour:', updateError);
          }
        }, 2000);
      }

      setUserEmail(data.email);
      setEmailSent(true);

    } catch (error: any) {
      console.error('Erreur d\'inscription:', error);
      setError(error.message || 'Une erreur est survenue lors de l\'inscription. Veuillez réessayer.');
    }
  };

  // Interface après envoi de l'email de confirmation
  if (emailSent) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          <Mail className="mx-auto h-16 w-16 text-blue-600 dark:text-blue-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Vérifiez votre email
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Nous avons envoyé un lien de confirmation à :
          </p>
          <p className="font-semibold text-blue-600 dark:text-blue-400 mt-1">
            {userEmail}
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Prochaines étapes :
              </h3>
              <ol className="mt-2 text-sm text-blue-700 dark:text-blue-300 list-decimal list-inside space-y-1">
                <li>Ouvrez votre boîte de réception email</li>
                <li>Trouvez l'email de ProfAssist</li>
                <li>Cliquez sur "Confirmer mon email"</li>
                <li>Vous serez automatiquement connecté</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Email non reçu ?
              </h3>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• Vérifiez votre dossier spam/courrier indésirable</li>
                <li>• Le lien expire dans 24 heures</li>
                <li>• Contactez-nous si le problème persiste</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/login')}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Aller à la page de connexion
          </button>
          
          <button
            onClick={() => {
              setEmailSent(false);
              setError(null);
            }}
            className="w-full text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← Modifier l'adresse email
          </button>
        </div>
      </div>
    );
  }

  // ✅ Formulaire d'inscription CENTRÉ avec option newsletter
  return (
    <div className="flex justify-center items-center min-h-full py-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full max-w-sm">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Email
          </label>
          <input
            {...register('email')}
            type="email"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="votre.email@exemple.com"
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

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Confirmer le mot de passe
          </label>
          <input
            {...register('confirmPassword')}
            type="password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* ✅ Option newsletter améliorée */}
        <div className="flex items-start space-x-3 py-2">
          <input
            {...register('newsletter')}
            type="checkbox"
            id="newsletter"
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <div className="flex-1">
            <label htmlFor="newsletter" className="text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
              <span className="font-medium">Newsletter ProfAssist</span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Recevez nos dernières actualités, nouveautés et conseils pédagogiques par email (optionnel)
              </p>
            </label>
          </div>
        </div>

        {/* Debug en développement */}
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-gray-400">
            Debug: Newsletter = {newsletterValue ? 'true' : 'false'}
          </p>
        )}

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <UserPlus className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Création du compte...
            </span>
          ) : (
            'Créer mon compte'
          )}
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Un email de confirmation sera envoyé à votre adresse
        </p>
      </form>
    </div>
  );
}