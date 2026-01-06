// ✅ Modification du 24/08/2025 : ajout des liens légaux obligatoires
// ✅ Modification du 09/09/2025 : ajout des réseaux sociaux
// ✅ Modification du 06/01/2026 : ajout de TikTok
import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Sparkles, Heart, ExternalLink, ArrowRight, FileText, Shield, Scale, Instagram, Linkedin } from 'lucide-react';

// Composant icône TikTok (non disponible dans lucide-react)
const TikTokIcon = () => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className="w-4 h-4"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

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
          <div className="md:col-span-1">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              À propos
            </h3>
            <p className="text-blue-100 leading-relaxed mb-6">
              ProfAssist révolutionne la création d'appréciations scolaires avec une suite complète d'outils alimentés par l'IA.
            </p>
            
            {/* Features highlights */}
            <div className="space-y-2">
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
                    <div className="text-sm font-medium">Email</div>
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

          {/* Accès rapide */}
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
                  to="/buy-tokens" 
                  className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
                >
                  <ArrowRight className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />
                  Acheter des tokens
                </Link>
              </li>
            </ul>
          </div>

          {/* Section Légal */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center mr-3">
                <Scale className="w-3 h-3 text-white" />
              </div>
              Informations légales
            </h3>
            <ul className="space-y-3">
              <li>
                <Link 
                  to="/legal/mentions-legales" 
                  className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  <span className="text-sm">Mentions légales</span>
                </Link>
              </li>
              <li>
                <Link 
                  to="/legal/politique-confidentialite" 
                  className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  <span className="text-sm">Politique de confidentialité</span>
                </Link>
              </li>
              <li>
                <Link 
                  to="/legal/cgu" 
                  className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  <span className="text-sm">CGU</span>
                </Link>
              </li>
              <li>
                <Link 
                  to="/legal/cgv" 
                  className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
                >
                  <Scale className="w-4 h-4 mr-2" />
                  <span className="text-sm">CGV</span>
                </Link>
              </li>
              <li>
                <Link 
                  to="/legal/cookies" 
                className="group flex items-center text-blue-100 hover:text-white transition-all duration-200"
              >
                <Shield className="w-4 h-4 mr-2" />
                <span className="text-sm">Gestion des cookies</span>
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

        {/* Footer bottom avec mentions légales condensées et réseaux sociaux */}
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex flex-col md:flex-row items-center mb-4 md:mb-0">
            <p className="text-blue-200 text-sm mb-2 md:mb-0 md:mr-4">
              © {new Date().getFullYear()} ProfAssist. Tous droits réservés.
            </p>
            <div className="flex items-center space-x-4 text-xs text-blue-300">
              <Link to="/legal/mentions-legales" className="hover:text-white transition-colors">
                Mentions légales
              </Link>
              <span>•</span>
              <Link to="/legal/politique-confidentialite" className="hover:text-white transition-colors">
                Confidentialité
              </Link>
              <span>•</span>
              <Link to="/legal/cgv" className="hover:text-white transition-colors">
                CGV
              </Link>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="flex items-center text-blue-200 text-sm mb-3">
              <span>Développé avec</span>
              <Heart className="w-4 h-4 mx-1 text-red-400 animate-pulse" />
              <span>pour les enseignants</span>
            </div>
            
            {/* Réseaux sociaux */}
            <div className="flex items-center space-x-3">
              <a 
                href="https://www.instagram.com/ldteachtech/" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
                title="Suivez-moi sur Instagram"
              >
                <Instagram className="w-4 h-4 text-white" />
              </a>
              <a 
                href="https://www.tiktok.com/@teachtech41" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
                title="Suivez-moi sur TikTok"
              >
                <TikTokIcon />
              </a>
              <a 
                href="https://www.linkedin.com/in/lionel-delorenzo-194a16330/" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
                title="Connectez-vous sur LinkedIn"
              >
                <Linkedin className="w-4 h-4 text-white" />
              </a>
              <a 
                href="https://bsky.app/profile/ldteachtech.bsky.social" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gradient-to-br from-sky-400 to-blue-500 rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
                title="Suivez-moi sur Bluesky"
              >
                <span className="text-xs font-bold text-white">BS</span>
              </a>
            </div>
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
