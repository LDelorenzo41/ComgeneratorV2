import React from 'react';
import { Link } from 'react-router-dom';
import { RegisterForm } from '../components/auth/RegisterForm';
import { Sparkles, Brain, Zap, Shield, Users, ArrowRight, CheckCircle } from 'lucide-react';

export function RegisterPage() {
  const features = [
    { text: "Génération d'appréciations personnalisées", icon: Brain },
    { text: "Synthèses automatiques de bulletins", icon: Zap },
    { text: "Communications professionnelles", icon: Users },
    { text: "Données sécurisées et privées", icon: Shield }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Hero Section avec image */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 mix-blend-multiply"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
          <div className="text-center mb-12">
            {/* Badge */}
            <div className="mb-6">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <Sparkles className="w-4 h-4 mr-2" />
                Propulsé par ChatGPT
              </span>
            </div>
            
            {/* Image héro */}
            <div className="mb-8">
              <div className="relative inline-block">
                <img 
                  src="https://res.cloudinary.com/dhva6v5n8/image/upload/ChatGPT_Image_10_aou%CC%82t_2025_09_55_17_twwjmd.png"
                  alt="ProfAssist - L'IA au service des enseignants"
                  className="max-w-md mx-auto h-auto rounded-2xl shadow-2xl transform hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
              </div>
            </div>
            
            {/* Titre */}
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
              <span className="block mb-2">Rejoignez</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                ProfAssist
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              L'intelligence artificielle au service des enseignants. 
              Automatisez vos tâches administratives et gagnez un temps précieux.
            </p>
          </div>
        </div>
      </div>

      {/* Section principale avec formulaire */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Colonne gauche - Avantages */}
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                Pourquoi choisir ProfAssist ?
              </h2>
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div key={index} className="group flex items-center p-4 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      <feature.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats rapides */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-2xl border border-green-100 dark:border-green-800">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">75%</div>
                <div className="text-sm text-green-700 dark:text-green-300">Temps économisé</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl border border-purple-100 dark:border-purple-800">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">6</div>
                <div className="text-sm text-purple-700 dark:text-purple-300">Outils intégrés</div>
              </div>
            </div>

            {/* Témoignage personnel */}
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl border border-blue-100 dark:border-blue-800">
              <div className="flex items-center mb-3">
                {[...Array(5)].map((_, i) => (
                  <CheckCircle key={i} className="w-5 h-5 text-yellow-400 mr-1" />
                ))}
              </div>
              <p className="text-gray-700 dark:text-gray-300 italic mb-3">
                "ProfAssist a révolutionné ma façon de travailler. Je gagne des heures, en particulier chaque fin de trimestre !"
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                - Lionel D - Professeur d'EPS
              </p>
            </div>
          </div>

          {/* Colonne droite - Formulaire */}
          <div className="lg:sticky lg:top-8">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header du formulaire */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center">
                <h2 className="text-2xl font-bold mb-2">
                  Créer un compte
                </h2>
                <p className="text-blue-100">
                  Commencez gratuitement dès maintenant
                </p>
              </div>

              {/* Formulaire */}
              <div className="p-8">
                <RegisterForm />
                
                {/* Lien de connexion */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Vous avez déjà un compte ?{' '}
                    <Link 
                      to="/login" 
                      className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      Connectez-vous
                    </Link>
                  </p>
                </div>

                {/* Garanties */}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <Shield className="w-4 h-4 mx-auto mb-1 text-green-500" />
                      <div>Données sécurisées</div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <Zap className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                      <div>Accès immédiat</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
                    Aucune carte de crédit requise
                  </p>
                </div>
              </div>
            </div>

            {/* CTA supplémentaire */}
            <div className="mt-6 text-center">
              <Link 
                to="/login"
                className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Déjà membre ? Connectez-vous
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}