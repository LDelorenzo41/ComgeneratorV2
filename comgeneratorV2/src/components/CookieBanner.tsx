// src/components/CookieBanner.tsx
import React, { useState } from 'react';
import { X, Settings, Shield, BarChart3, Target, Sliders, RotateCcw } from 'lucide-react';
import { useCookieConsent, CookieConsent } from '../contexts/CookieConsentContext';
import { Link } from 'react-router-dom';

export function CookieBanner() {
  const {
    consent,
    showBanner,
    acceptAll,
    acceptNecessaryOnly,
    updateConsent,
    closeBanner,
  } = useCookieConsent();

  const [showDetails, setShowDetails] = useState(true);
  const [localConsent, setLocalConsent] = useState<CookieConsent>(consent);
  const [buttonText, setButtonText] = useState('Enregistrer mes préférences');

  if (!showBanner) return null;

  const handleToggleConsent = (key: keyof CookieConsent) => {
    if (key === 'necessary') return; // Les cookies nécessaires ne peuvent pas être désactivés
    
    setLocalConsent(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSavePreferences = () => {
    updateConsent(localConsent);
    
    // Scroll vers le haut de la page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Changer le texte du bouton pour confirmation
    setButtonText('✅ Enregistré !');
    
    setTimeout(() => {
      setButtonText('Enregistrer mes préférences');
      closeBanner();
    }, 2000);
  };

  // Réinitialiser aux valeurs par défaut
  const handleReset = () => {
    const defaultConsent: CookieConsent = {
      necessary: true,
      analytics: false,
      advertising: false,
      functional: false,
    };
    setLocalConsent(defaultConsent);
  };

  // Handlers pour les boutons rapides - fermeture immédiate
  const handleAcceptAll = () => {
    const fullConsent: CookieConsent = {
      necessary: true,
      analytics: true,
      advertising: true,
      functional: true,
    };
    updateConsent(fullConsent);
  };

  const handleAcceptNecessaryOnly = () => {
    const minimalConsent: CookieConsent = {
      necessary: true,
      analytics: false,
      advertising: false,
      functional: false,
    };
    updateConsent(minimalConsent);
  };

  // Handlers pour les boutons rapides DANS la vue détaillée - mise à jour des switchs
  const handleAcceptAllDetailed = () => {
    const fullConsent: CookieConsent = {
      necessary: true,
      analytics: true,
      advertising: true,
      functional: true,
    };
    setLocalConsent(fullConsent);
  };

  const handleAcceptNecessaryOnlyDetailed = () => {
    const minimalConsent: CookieConsent = {
      necessary: true,
      analytics: false,
      advertising: false,
      functional: false,
    };
    setLocalConsent(minimalConsent);
  };

  const cookieCategories = [
    {
      key: 'necessary' as keyof CookieConsent,
      title: 'Cookies strictement nécessaires',
      description: 'Essentiels pour le fonctionnement du site (authentification, panier, sécurité)',
      icon: Shield,
      required: true,
      examples: 'Session utilisateur, préférences de sécurité, tokens d\'authentification'
    },
    {
      key: 'analytics' as keyof CookieConsent,
      title: 'Cookies analytiques',
      description: 'Nous aident à comprendre comment vous utilisez notre site pour l\'améliorer',
      icon: BarChart3,
      required: false,
      examples: 'Google Analytics, mesures d\'audience anonymes, statistiques de navigation'
    },
    {
      key: 'advertising' as keyof CookieConsent,
      title: 'Cookies publicitaires',
      description: 'Permettent de personnaliser les publicités et mesurer leur efficacité',
      icon: Target,
      required: false,
      examples: 'Google Ads, remarketing, mesure des conversions publicitaires'
    },
    {
      key: 'functional' as keyof CookieConsent,
      title: 'Cookies fonctionnels',
      description: 'Améliorent votre expérience avec des fonctionnalités supplémentaires',
      icon: Sliders,
      required: false,
      examples: 'Préférences d\'affichage, widgets sociaux, cartes interactives'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Gestion des cookies
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choisissez vos préférences de confidentialité
              </p>
            </div>
          </div>
          <button
            onClick={() => showDetails ? setShowDetails(false) : closeBanner()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Contenu principal */}
        <div className="p-6">
          
          {!showDetails ? (
            // Vue simplifiée
            <div className="space-y-6">
              <div>
                <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                  Nous utilisons des cookies pour améliorer votre expérience sur ProfAssist, 
                  analyser l'utilisation du site et vous proposer des contenus personnalisés.
                </p>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                        Vos données sont protégées
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Conformité RGPD • Données chiffrées • Jamais vendues
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions rapides */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAcceptAll}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Accepter tous les cookies
                </button>
                
                <button
                  onClick={() => setShowDetails(true)}
                  className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 font-medium py-3 px-6 rounded-xl transition-all duration-200"
                >
                  Personnaliser mes choix
                </button>
                
                <button
                  onClick={handleAcceptNecessaryOnly}
                  className="flex-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium py-3 px-6 transition-colors"
                >
                  Cookies essentiels uniquement
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                En continuant, vous acceptez notre{' '}
                <Link to="/legal/politique-confidentialite" className="text-blue-600 hover:text-blue-700 underline">
                  politique de confidentialité
                </Link>{' '}
                et l'utilisation de cookies essentiels.
              </p>
            </div>
          ) : (
            // Vue détaillée
            <div className="space-y-6">
              <div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 flex items-center"
                >
                  ← Retour à la vue simple
                </button>
                
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Vous pouvez personnaliser vos préférences pour chaque type de cookies. 
                  Les cookies nécessaires ne peuvent pas être désactivés.
                </p>
              </div>

              {/* Actions rapides dans la vue détaillée */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={handleAcceptAllDetailed}
                  className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm rounded-lg transition-colors"
                >
                  Tout accepter
                </button>
                <button
                  onClick={handleAcceptNecessaryOnlyDetailed}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
                >
                  Essentiels uniquement
                </button>
              </div>

              {/* Barre d'actions supérieure - NOUVELLE */}
              <div className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-lg border">
                <button
                  onClick={handleReset}
                  className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Réinitialiser
                </button>
                
                <button
                  onClick={handleSavePreferences}
                  className={`font-medium py-2 px-4 rounded-lg transition-all duration-200 ${
                    buttonText === '✅ Enregistré !' 
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                  }`}
                  disabled={buttonText === '✅ Enregistré !'}
                >
                  {buttonText}
                </button>
              </div>

              {/* Liste des catégories */}
              <div className="space-y-4">
                {cookieCategories.map((category) => {
                  const Icon = category.icon;
                  const isEnabled = localConsent[category.key];
                  
                  return (
                    <div key={category.key} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                            ${category.required 
                              ? 'bg-green-100 dark:bg-green-900' 
                              : isEnabled 
                                ? 'bg-blue-100 dark:bg-blue-900' 
                                : 'bg-gray-100 dark:bg-gray-700'
                            }
                          `}>
                            <Icon className={`
                              w-5 h-5 
                              ${category.required 
                                ? 'text-green-600 dark:text-green-400' 
                                : isEnabled 
                                  ? 'text-blue-600 dark:text-blue-400' 
                                  : 'text-gray-500 dark:text-gray-400'
                              }
                            `} />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                {category.title}
                              </h3>
                              {category.required && (
                                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
                                  Obligatoire
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {category.description}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              <strong>Exemples:</strong> {category.examples}
                            </p>
                          </div>
                        </div>
                        
                        {/* Toggle */}
                        <div className="ml-4">
                          {category.required ? (
                            <div className="w-12 h-6 bg-green-500 rounded-full flex items-center justify-end px-1">
                              <div className="w-4 h-4 bg-white rounded-full"></div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleToggleConsent(category.key)}
                              className={`
                                w-12 h-6 rounded-full flex items-center px-1 transition-all duration-200
                                ${isEnabled 
                                  ? 'bg-blue-500 justify-end' 
                                  : 'bg-gray-300 dark:bg-gray-600 justify-start'
                                }
                              `}
                            >
                              <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions du bas - gardées pour cohérence */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleSavePreferences}
                  className={`flex-1 font-medium py-3 px-6 rounded-xl transition-all duration-200 ${
                    buttonText === '✅ Enregistré !' 
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                  }`}
                  disabled={buttonText === '✅ Enregistré !'}
                >
                  {buttonText}
                </button>
                
                <button
                  onClick={handleAcceptNecessaryOnly}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium py-3 px-6"
                >
                  Refuser tous les cookies optionnels
                </button>
              </div>
            </div>
          )}

          {/* Informations légales */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
              <Link to="/legal/politique-confidentialite" className="hover:text-blue-600 underline">
                Politique de confidentialité
              </Link>
              <Link to="/legal/cgu" className="hover:text-blue-600 underline">
                Conditions d'utilisation
              </Link>
              <Link to="/legal/mentions-legales" className="hover:text-blue-600 underline">
                Mentions légales
              </Link>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Vous pouvez modifier vos préférences à tout moment depuis les paramètres de votre compte.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}