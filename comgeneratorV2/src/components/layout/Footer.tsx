// ✅ Modification du 23/08/2025 : adresse email corrigée dans le footer
import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Sparkles, Heart, ExternalLink, ArrowRight } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 text-white overflow-hidden">
      {/* Background decoratif */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10"></div>
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"></div>
      
      <div className="relative max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        
        {/* Header du footer */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              ProfAssist
            </span>
          </h2>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            L'intelligence artificielle au service des enseignants
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          
          {/* À propos */}
          <div className="md:col-span-2">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              À propos de ProfAssist
            </h3>
            <p className="text-blue-100 leading-relaxed mb-6">
              ProfAssist révolutionne la création d'appréciations scolaires avec une suite complète d'outils alimentés par l'IA. 
              Gagnez du temps tout en maintenant la qualité et la personnalisation de vos évaluations.
            </p>
            
            {/* Features highlights */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center text-sm text-blue-200">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                Appréciations personnalisées
              </div>
              <div className="flex items-center text-sm text-blue-200">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                Synthèses automatiques
              </div>
              <div className="flex items-center text-sm text-blue-200">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                Communications professionnelles
              </div>
              <div className="flex items-center text-sm text-blue-200">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                Séances pédagogiques
              </div>
            </div>
          </div>
          
          {/* Contact */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-3">
                <Mail className="w-3 h-3 text-white" />
              </div>
              Contact
            </h3>
            <ul className="space-y-4">
              <li>
                <a 
                  href="mailto:contact-profassist@teachtech.fr" 
                  className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
                >
                  <div className="w-8 h-8 bg-blue-800/50 rounded-lg flex items-center justify-center mr-3 group-hover:bg-blue-700/50 transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Email contact</div>
                    <div className="text-xs text-blue-300">contact-profassist@teachtech.fr</div>
                  </div>
                </a>
              </li>
              <li>
                <div className="flex items-center text-blue-100">
                  <div className="w-8 h-8 bg-blue-800/50 rounded-lg flex items-center justify-center mr-3">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Localisation</div>
                    <div className="text-xs text-blue-300">Busloup, France</div>
                  </div>
                </div>
              </li>
            </ul>
          </div>

          {/* Liens utiles */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
                <ExternalLink className="w-3 h-3 text-white" />
              </div>
              Accès rapide
            </h3>
            <ul className="space-y-3">
              <li>
                <Link 
                  to="/login" 
                  className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
                >
                  <ArrowRight className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />
                  Se connecter
                </Link>
              </li>
              <li>
                <Link 
                  to="/register" 
                  className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
                >
                  <ArrowRight className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />
                  Créer un compte
                </Link>
              </li>
              <li>
                <Link 
                  to="/dashboard" 
                  className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
                >
                  <ArrowRight className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />
                  Dashboard
                </Link>
              </li>
              <li>
                <Link 
                  to="/communication" 
                  className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
                >
                  <ArrowRight className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />
                  Communication
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Séparateur avec gradient */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>
          </div>
          <div className="relative flex justify-center">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-4">
              <div className="w-8 h-px bg-gradient-to-r from-blue-400 to-indigo-400"></div>
            </div>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <p className="text-blue-200 text-sm">
              © {new Date().getFullYear()} ProfAssist. Tous droits réservés.
            </p>
          </div>
          
          <div className="flex items-center text-blue-200 text-sm">
            <span>Développé avec</span>
            <Heart className="w-4 h-4 mx-1 text-red-400 animate-pulse" />
            <span>pour les enseignants</span>
          </div>
        </div>

        {/* Call to action subtil */}
        <div className="mt-8 text-center">
          <Link
            to="/register"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Commencer gratuitement
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
      
      {/* Effet de lueur en bas */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>
    </footer>
  );
}