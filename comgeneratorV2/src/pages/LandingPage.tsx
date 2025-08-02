import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Shield, Zap } from 'lucide-react';

export function LandingPage() {

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
            <span className="block">Générez des appréciations</span>
            <span className="block text-blue-600">personnalisées et pertinentes</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 dark:text-gray-400 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Simplifiez la rédaction de vos appréciations scolaires grâce à notre outil intelligent.
            Gagnez du temps tout en maintenant la qualité et la personnalisation.
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <div className="rounded-md shadow">
              <Link
                to="/register"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition-colors"
              >
                Commencer gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
            <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
              <Link
                to="/login"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
              >
                Se connecter
              </Link>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            <Link to="/register" className="text-blue-600 hover:text-blue-500">
              Créez un compte
            </Link>{' '}
            pour sauvegarder vos matières
          </p>
        </div>

        <div className="mt-24">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="pt-6">
              <div className="flow-root bg-white dark:bg-gray-800 rounded-lg px-6 pb-8">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg">
                      <Sparkles className="h-6 w-6 text-white" />
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 dark:text-white tracking-tight">Intelligent</h3>
                  <p className="mt-5 text-base text-gray-500 dark:text-gray-400">
                    Génération d'appréciations pertinentes basées sur vos critères d'évaluation personnalisés.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <div className="flow-root bg-white dark:bg-gray-800 rounded-lg px-6 pb-8">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg">
                      <Zap className="h-6 w-6 text-white" />
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 dark:text-white tracking-tight">Rapide</h3>
                  <p className="mt-5 text-base text-gray-500 dark:text-gray-400">
                    Gagnez un temps précieux dans la rédaction de vos appréciations tout en maintenant la qualité.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <div className="flow-root bg-white dark:bg-gray-800 rounded-lg px-6 pb-8">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg">
                      <Shield className="h-6 w-6 text-white" />
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 dark:text-white tracking-tight">Sécurisé</h3>
                  <p className="mt-5 text-base text-gray-500 dark:text-gray-400">
                    Vos données sont protégées et restent confidentielles grâce à notre système sécurisé.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24">
          <p className="text-center text-xl font-semibold text-gray-700 dark:text-gray-300 mb-8">
            Comgénérator propulsé par ChatGPT
          </p>
          <div className="rounded-lg overflow-hidden shadow-xl">
            <div className="relative w-full" style={{ height: 'calc(100% - 80px)' }}>
              <img 
                src="https://res.cloudinary.com/dhva6v5n8/image/upload/DALL_E_2024-11-20_08.22.33_-_A_split-screen_photographic-style_widescreen_image_in_shades_of_blue_showing_two_contrasting_scenes._On_the_left_a_frustrated_teacher_is_seated_at_th_dghgas.png"
                alt="Comparaison avant/après utilisation de Comgénérator"
                className="w-full object-cover object-center"
                style={{ clipPath: 'inset(40px 0)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}