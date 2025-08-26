import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, CheckCircle, AlertCircle, Scale, Shield } from 'lucide-react';

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string(),
  newsletter: z.boolean().optional(),
  // 🆕 Ajout de l'acceptation des conditions légales
  legalAccepted: z.boolean().refine(val => val === true, {
    message: 'Vous devez accepter les conditions générales pour créer votre compte'
  })
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
      newsletter: false,
      legalAccepted: false // 🆕 Valeur par défaut
    }
  });

  // Surveiller les valeurs
  const newsletterValue = watch('newsletter');
  const legalAcceptedValue = watch('legalAccepted'); // 🆕 Surveillance

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
      console.log('⚖️ Acceptation légale lors de la soumission:', data.legalAccepted);

      // ✅ Vérification supplémentaire côté client
      if (!data.legalAccepted) {
        setError('Vous devez accepter les conditions générales pour créer votre compte');
        return;
      }

      // ✅ Inscription avec confirmation d'email OBLIGATOIRE + newsletter + acceptation légale
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: getRedirectURL(),
          data: {
            created_at: new Date().toISOString(),
            newsletter_subscription: data.newsletter === true,
            legal_accepted_at: new Date().toISOString(), // 🆕 Horodatage acceptation
            legal_accepted: true // 🆕 Confirmation acceptation
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
        throw new Error(signUpError.message || 'Erreur lors de la création du compte');
      }

      if (signUpData.user) {
        console.log('✅ Compte créé avec succès ! ID utilisateur:', signUpData.user.id);
        setUserEmail(data.email);
        setEmailSent(true);
      } else {
        throw new Error('Erreur lors de la création du compte');
      }

    } catch (error: any) {
      console.error('❌ Erreur inscription:', error);
      setError(error.message);
    }
  };

  // ✅ Si l'email a été envoyé, afficher le message de confirmation
  if (emailSent) {
    return (
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Compte créé avec succès !
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Un email de confirmation de <strong>Supabase Auth</strong> a été envoyé à <strong>{userEmail}</strong>
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-400 mb-1">
                  Prochaine étape importante
                </h4>
                <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <li>• Vérifiez votre dossier spam/courrier indésirable</li>
                  <li>• Le lien expire dans 24 heures</li>
                  <li>• Contactez-nous si le problème persiste</li>
                </ul>
              </div>
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

  // ✅ Formulaire d'inscription avec acceptation des CGU
  return (
    <div className="flex justify-center items-center min-h-full py-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full max-w-md">
        
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Adresse email <span className="text-red-500">*</span>
          </label>
          <input
            {...register('email')}
            type="email"
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            placeholder="votre.email@exemple.com"
          />
          {errors.email && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
          )}
        </div>

        {/* Mot de passe */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Mot de passe <span className="text-red-500">*</span>
          </label>
          <input
            {...register('password')}
            type="password"
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            placeholder="Minimum 6 caractères"
          />
          {errors.password && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
          )}
        </div>

        {/* Confirmation mot de passe */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Confirmer le mot de passe <span className="text-red-500">*</span>
          </label>
          <input
            {...register('confirmPassword')}
            type="password"
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            placeholder="Répétez votre mot de passe"
          />
          {errors.confirmPassword && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* 🆕 SECTION LÉGALE - Acceptation des CGU/CGV (OBLIGATOIRE) */}
        <div className="space-y-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-gray-900 dark:text-white flex items-center">
            <Scale className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Acceptation des conditions (obligatoire)
          </h4>
          
          {/* Checkbox principal CGU + CGV */}
          <div className="flex items-start">
            <input
              {...register('legalAccepted')}
              id="accept-legal"
              type="checkbox"
              className="h-5 w-5 text-blue-600 border-2 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 mt-1"
            />
            <label htmlFor="accept-legal" className="ml-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <span className="font-medium text-gray-900 dark:text-white">
                J'accepte les conditions d'utilisation <span className="text-red-500">*</span>
              </span>
              <div className="mt-2 space-y-2">
                <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                  <Scale className="w-3 h-3 mr-1" />
                  <Link 
                    to="/legal/cgu" 
                    target="_blank"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline mr-2 font-medium"
                  >
                    Conditions générales d'utilisation (CGU)
                  </Link>
                  <span>et</span>
                  <Link 
                    to="/legal/cgv" 
                    target="_blank"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline ml-2 font-medium"
                  >
                    Conditions générales de vente (CGV)
                  </Link>
                </div>
              </div>
            </label>
          </div>

          {/* Information sur la politique de confidentialité */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
            <div className="flex items-start">
              <Shield className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Protection de vos données personnelles</p>
                <p>
                  En créant votre compte, vous acceptez notre{' '}
                  <Link 
                    to="/legal/politique-confidentialite" 
                    target="_blank"
                    className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    politique de confidentialité
                  </Link>
                  {' '}conforme au RGPD. Vos données sont protégées et ne seront jamais vendues.
                </p>
              </div>
            </div>
          </div>

          {/* Erreur de validation légale */}
          {errors.legalAccepted && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
                <span className="text-red-700 dark:text-red-300 text-sm font-medium">{errors.legalAccepted.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Option newsletter */}
        <div className="flex items-start space-x-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <input
            {...register('newsletter')}
            type="checkbox"
            id="newsletter"
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
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

        {/* Note importante */}
        <div className="text-xs text-gray-500 dark:text-gray-400 italic bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
          <p>
            💡 <strong>Obligatoire :</strong> L'acceptation des conditions est requise pour créer votre compte ProfAssist 
            et utiliser nos services d'intelligence artificielle.
          </p>
        </div>

        {/* Debug en développement */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-400 space-y-1 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            <p>Debug Newsletter: {newsletterValue ? 'true' : 'false'}</p>
            <p>Debug CGU acceptées: {legalAcceptedValue ? 'true' : 'false'}</p>
          </div>
        )}

        {/* Erreur générale */}
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" />
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Bouton de soumission */}
        <button
          type="submit"
          disabled={isSubmitting || !legalAcceptedValue} // 🆕 Désactivé si CGU non acceptées
          className="w-full flex items-center justify-center py-4 px-6 border border-transparent rounded-xl shadow-sm text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <UserPlus className="animate-spin -ml-1 mr-3 h-5 w-5" />
              Création du compte...
            </span>
          ) : (
            <span className="flex items-center">
              <UserPlus className="mr-3 h-5 w-5" />
              Créer mon compte ProfAssist
            </span>
          )}
        </button>

        {/* Information de confirmation email */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Un email de confirmation sera envoyé à votre adresse
          </p>
        </div>

        {/* Liens vers les mentions légales en bas */}
        <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            <Link 
              to="/legal/mentions-legales" 
              target="_blank"
              className="hover:text-blue-600 dark:hover:text-blue-400 underline"
            >
              Mentions légales
            </Link>
            <span>•</span>
            <Link 
              to="/legal/politique-confidentialite" 
              target="_blank"
              className="hover:text-blue-600 dark:hover:text-blue-400 underline"
            >
              Confidentialité
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}