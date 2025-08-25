import React from 'react';
import { SubjectList } from '../components/dashboard/SubjectList';
import { AppreciationForm } from '../components/dashboard/AppreciationForm';
import { useAuthStore } from '../lib/store';
import useTokenBalance from '../hooks/useTokenBalance'; // MODIFICATION : Remplacement de la logique locale
import { AlertCircle, Sparkles, User, Target, PenTool, Settings, CreditCard, AlertTriangle } from 'lucide-react'; // AJOUT : AlertTriangle
import { Link } from 'react-router-dom';
import { AIDisclaimer } from '../components/ui/AIDisclaimer'; // AJOUT : Import du disclaimer

export function DashboardPage() {
  const { user } = useAuthStore();
  const tokenCount = useTokenBalance(); // MODIFICATION : Utilisation du hook au lieu de l'état local
  
  // SUPPRESSION : fetchTokenCount et useEffect - remplacés par useTokenBalance

  // Extraire le prénom de l'email si possible, sinon utiliser l'email
  const getDisplayName = (email: string) => {
    const name = email.split('@')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // ✅ AJOUT : Variable pour simplifier les vérifications de tokens
  const hasTokens = (tokenCount ?? 0) > 0;
  const isOutOfTokens = (tokenCount ?? 0) === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header avec accueil personnalisé */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                <User className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Bonjour {user?.email ? getDisplayName(user.email) : 'Utilisateur'} !
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Bienvenue dans votre espace de génération d'appréciations personnalisées
          </p>
          
          {/* Compteur de tokens stylisé avec alerte si 0 tokens */}
          {tokenCount !== null && (
            <div className="space-y-2">
              <div className={`inline-flex items-center px-6 py-3 rounded-xl shadow-lg border ${
                isOutOfTokens 
                  ? 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}>
                {isOutOfTokens ? (
                  <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
                ) : (
                  <Sparkles className="w-5 h-5 text-blue-500 mr-3" />
                )}
                <span className={`text-sm font-medium ${
                  isOutOfTokens 
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {isOutOfTokens ? (
                    <>
                      <span className="font-bold">Crédits épuisés !</span>
                      <Link 
                        to="/buy-tokens" 
                        className="ml-2 underline hover:no-underline"
                      >
                        Recharger →
                      </Link>
                    </>
                  ) : (
                    <>
                      Crédits restants : <span className="font-bold text-blue-600 dark:text-blue-400">{(tokenCount ?? 0).toLocaleString()}</span> tokens
                    </>
                  )}
                </span>
              </div>
              
              {/* AJOUT : Explication discrète des tokens */}
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                Les tokens sont des crédits qui permettent d'utiliser l'IA. Un token correspond à environ 4 caractères générés.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-12">
          
          {/* AJOUT : Alerte tokens épuisés */}
          {isOutOfTokens && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-3xl p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-4">
                  Crédits épuisés
                </h2>
                <p className="text-red-600 dark:text-red-400 mb-6 max-w-2xl mx-auto">
                  Vous avez utilisé tous vos tokens. Pour continuer à générer des appréciations, veuillez recharger votre compte.
                </p>
                <Link
                  to="/buy-tokens"
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  <CreditCard className="w-5 h-5 mr-3" />
                  Recharger mes crédits
                </Link>
              </div>
            </div>
          )}

          {/* Section Gestion des matières */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Gestion des matières et critères
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Configurez vos matières et définissez les critères d'évaluation pour vos appréciations
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 rounded-2xl p-6">
              <SubjectList />
            </div>
          </div>

          {/* Section Génération d'appréciations */}
          <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 ${
            isOutOfTokens ? 'opacity-50' : ''
          }`}>
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                  <PenTool className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Générer une appréciation
                </h2>
                {/* AJOUT : Badge "Indisponible" si 0 tokens */}
                {isOutOfTokens && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Indisponible
                  </span>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                {isOutOfTokens 
                  ? 'Rechargez vos crédits pour créer des appréciations personnalisées'
                  : 'Créez des appréciations personnalisées basées sur vos critères d\'évaluation'
                }
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 rounded-2xl p-6">
              {/* AJOUT : Disclaimer IA - seulement si tokens > 0 */}
              {hasTokens && <AIDisclaimer />}
              
              <AppreciationForm 
                onTokensUpdated={() => {}} // MODIFICATION : Suppression car useTokenBalance gère automatiquement
                tokensAvailable={tokenCount ?? 0} // AJOUT : Passage du nombre de tokens au composant
              />
            </div>
          </div>

          {/* Section d'aide/conseils */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-3xl border border-blue-200 dark:border-blue-800 p-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Optimisez vos appréciations
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
                Pour des résultats optimaux, assurez-vous d'avoir configuré vos matières avec des critères précis et d'évaluer au moins un critère avant la génération.
              </p>
              
              {/* Liens utiles */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/appreciation-bank"
                  className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-semibold rounded-xl border border-blue-200 dark:border-blue-700 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Ma banque d'appréciations
                </Link>
                
                <Link
                  to="/communication"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  <PenTool className="w-4 h-4 mr-2" />
                  Outils communication
                </Link>
              </div>
            </div>
          </div>

          {/* Stats et informations */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                IA Avancée
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Propulsé par GPT pour des appréciations pertinentes
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Personnalisable
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Adaptez les critères selon vos besoins
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Gain de temps
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Générez des appréciations en quelques clics
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}