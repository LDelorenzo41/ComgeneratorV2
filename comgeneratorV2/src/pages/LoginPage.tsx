import React from 'react';
import { Link } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { LogIn, ArrowRight, Shield, Zap, Clock } from 'lucide-react';

export function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%234F46E5' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="relative flex min-h-screen">
        {/* Colonne gauche - Informations */}
        <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-center lg:px-12">
          <div className="max-w-md">
            {/* Logo/Titre */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  ProfAssist
                </span>
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Bon retour ! Accédez à vos outils pédagogiques.
              </p>
            </div>

            {/* Avantages rapides */}
            <div className="space-y-4">
              <div className="flex items-center p-3 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">Génération instantanée d'appréciations</span>
              </div>
              
              <div className="flex items-center p-3 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-3">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">Gain de temps considérable</span>
              </div>
              
              <div className="flex items-center p-3 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">Données sécurisées et privées</span>
              </div>
            </div>

            {/* Quote discrète */}
            <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-100/50 dark:border-blue-800/50">
              <p className="text-gray-600 dark:text-gray-400 text-sm italic">
                "Un outil indispensable pour tout enseignant moderne."
              </p>
            </div>
          </div>
        </div>

        {/* Colonne droite - Formulaire */}
        <div className="flex-1 flex flex-col justify-center px-6 lg:px-12">
          <div className="w-full max-w-md mx-auto">
            {/* Header du formulaire */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl mb-6 shadow-lg">
                <LogIn className="w-8 h-8 text-white" />
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Bon retour !
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Connectez-vous à votre compte ProfAssist
              </p>
            </div>

            {/* Formulaire de connexion */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-8">
              <LoginForm />
              
              {/* Lien d'inscription */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pas encore de compte ?{' '}
                  <Link 
                    to="/register" 
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors inline-flex items-center"
                  >
                    Créez-en un
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </p>
              </div>

              {/* Sécurité */}
              <div className="mt-6 pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                  <Shield className="w-3 h-3 mr-1 text-green-500" />
                  Connexion sécurisée SSL
                </div>
              </div>
            </div>

            {/* Version mobile - Avantages rapides */}
            <div className="lg:hidden mt-8 grid grid-cols-1 gap-3">
              <div className="flex items-center p-3 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
                <Zap className="w-5 h-5 text-blue-600 mr-3" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Outils pédagogiques IA</span>
              </div>
              <div className="flex items-center p-3 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
                <Clock className="w-5 h-5 text-green-600 mr-3" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Gain de temps garanti</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}