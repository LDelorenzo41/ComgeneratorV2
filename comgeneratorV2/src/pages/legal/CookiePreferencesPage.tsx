// src/pages/legal/CookiePreferencesPage.tsx
import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';
import { useCookieConsent } from '../../contexts/CookieConsentContext';
import { Settings, Shield, BarChart3, Target, Sliders, RefreshCw, Trash2 } from 'lucide-react';

export function CookiePreferencesPage() {
  const {
    consent,
    consentStatus,
    updateConsent,
    acceptAll,
    acceptNecessaryOnly,
    hasConsented
  } = useCookieConsent();

  const [localConsent, setLocalConsent] = React.useState(consent);
  const [showSuccess, setShowSuccess] = React.useState(false);

  const handleToggle = (key: keyof typeof consent) => {
    if (key === 'necessary') return;
    
    setLocalConsent(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    updateConsent(localConsent);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleReset = () => {
    setLocalConsent(consent);
  };

  const cookieCategories = [
    {
      key: 'necessary' as keyof typeof consent,
      title: 'Cookies strictement nécessaires',
      description: 'Ces cookies sont indispensables au bon fonctionnement de ProfAssist. Ils ne peuvent pas être désactivés.',
      icon: Shield,
      color: 'green',
      details: [
        'Authentification et session utilisateur',
        'Sécurité et protection contre les attaques',
        'Préférences de navigation essentielles',
        'Fonctionnement du système de tokens'
      ]
    },
    {
      key: 'analytics' as keyof typeof consent,
      title: 'Cookies analytiques',
      description: 'Ces cookies nous aident à comprendre comment vous utilisez notre site pour l\'améliorer.',
      icon: BarChart3,
      color: 'blue',
      details: [
        'Google Analytics pour les statistiques d\'usage',
        'Mesures d\'audience anonymes',
        'Analyse des parcours utilisateurs',
        'Optimisation des performances du site'
      ]
    },
    {
      key: 'advertising' as keyof typeof consent,
      title: 'Cookies publicitaires',
      description: 'Ces cookies permettent de personnaliser les publicités et mesurer leur efficacité.',
      icon: Target,
      color: 'purple',
      details: [
        'Google Ads pour le remarketing',
        'Mesure des conversions publicitaires',
        'Personnalisation des annonces',
        'Suivi des campagnes marketing'
      ]
    },
    {
      key: 'functional' as keyof typeof consent,
      title: 'Cookies fonctionnels',
      description: 'Ces cookies améliorent votre expérience avec des fonctionnalités supplémentaires.',
      icon: Sliders,
      color: 'indigo',
      details: [
        'Préférences d\'affichage personnalisées',
        'Widgets et intégrations tierces',
        'Fonctionnalités sociales',
        'Cartes et contenus interactifs'
      ]
    }
  ];

  const getStatusInfo = () => {
    switch (consentStatus) {
      case 'given':
        return { text: 'Tous les cookies acceptés', color: 'green' };
      case 'partial':
        return { text: 'Consentement partiel', color: 'yellow' };
      case 'denied':
        return { text: 'Cookies essentiels uniquement', color: 'red' };
      default:
        return { text: 'Aucun consentement', color: 'gray' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <LegalLayout 
      title="Gestion des cookies" 
      lastUpdated="2 septembre 2025"
    >
      <div className="space-y-8">
        
        {/* En-tête avec statut */}
        <section className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Gestion de vos cookies
              </h1>
              <p className="text-gray-600 text-lg leading-relaxed">
                Personnalisez vos préférences de confidentialité et contrôlez les données que vous souhaitez partager.
              </p>
            </div>
            
            <div className="flex items-center space-x-2 text-sm">
              <div className={`w-3 h-3 rounded-full bg-${statusInfo.color}-500`}></div>
              <span className="font-medium text-gray-700">{statusInfo.text}</span>
            </div>
          </div>

          {/* Message de succès */}
          {showSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <div className="w-5 h-5 text-green-600 mr-3">
                  ✅
                </div>
                <span className="text-green-800 font-medium">
                  Vos préférences ont été sauvegardées avec succès !
                </span>
              </div>
            </div>
          )}

          {/* Actions rapides */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={acceptAll}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
            >
              Tout accepter
            </button>
            
            <button
              onClick={acceptNecessaryOnly}
              className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-medium py-2 px-4 rounded-lg transition-all duration-200"
            >
              Cookies essentiels uniquement
            </button>
            
            <button
              onClick={handleReset}
              className="text-gray-600 hover:text-gray-800 font-medium py-2 px-4 flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Réinitialiser
            </button>
          </div>
        </section>

        {/* Liste détaillée des catégories */}
        <section className="space-y-6">
          {cookieCategories.map((category) => {
            const Icon = category.icon;
            const isEnabled = localConsent[category.key];
            const hasChanged = localConsent[category.key] !== consent[category.key];
            
            return (
              <div key={category.key} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-6">
                  
                  {/* Header de la catégorie */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`w-12 h-12 bg-${category.color}-100 rounded-full flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-6 h-6 text-${category.color}-600`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {category.title}
                          </h3>
                          
                          {category.key === 'necessary' && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                              Obligatoire
                            </span>
                          )}
                          
                          {hasChanged && category.key !== 'necessary' && (
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-medium">
                              Modifié
                            </span>
                          )}
                        </div>
                        
                        <p className="text-gray-600 leading-relaxed">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    
                    {/* Toggle Switch */}
                    <div className="ml-6">
                      {category.key === 'necessary' ? (
                        <div className="w-14 h-7 bg-green-500 rounded-full flex items-center justify-end px-1">
                          <div className="w-5 h-5 bg-white rounded-full shadow-md"></div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleToggle(category.key)}
                          className={`
                            w-14 h-7 rounded-full flex items-center px-1 transition-all duration-300
                            ${isEnabled 
                              ? `bg-${category.color}-500 justify-end` 
                              : 'bg-gray-300 justify-start'
                            }
                          `}
                        >
                          <div className="w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300"></div>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Détails */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Ce que cela inclut :</h4>
                    <ul className="space-y-2">
                      {category.details.map((detail, index) => (
                        <li key={index} className="flex items-start text-sm text-gray-600">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                {/* Status bar */}
                <div className={`px-6 py-3 bg-${isEnabled ? category.color : 'gray'}-50 border-t border-gray-100`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium text-${isEnabled ? category.color : 'gray'}-700`}>
                      {isEnabled ? '✅ Activé' : '❌ Désactivé'}
                    </span>
                    
                    {category.key !== 'necessary' && (
                      <span className="text-gray-500">
                        Cliquez sur le bouton pour {isEnabled ? 'désactiver' : 'activer'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Actions de sauvegarde */}
        <section className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Sauvegarder vos préférences
              </h3>
              <p className="text-sm text-gray-600">
                {hasConsented ? 'Vos préférences actuelles sont sauvegardées.' : 'Vous devez sauvegarder vos préférences.'}
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleReset}
                className="text-gray-600 hover:text-gray-800 font-medium py-2 px-4 border border-gray-300 rounded-lg transition-colors"
              >
                Annuler les modifications
              </button>
              
              <button
                onClick={handleSave}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200"
              >
                Enregistrer mes préférences
              </button>
            </div>
          </div>
        </section>

        {/* Informations supplémentaires */}
        <section className="bg-blue-50 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            💡 Bon à savoir
          </h3>
          
          <div className="space-y-3 text-sm text-gray-700">
            <p>• Vos préférences sont conservées 30 jours, puis nous vous redemanderons votre consentement.</p>
            <p>• Vous pouvez modifier vos choix à tout moment depuis cette page ou depuis vos paramètres de compte.</p>
            <p>• Les cookies strictement nécessaires ne peuvent pas être désactivés car ils sont essentiels au fonctionnement du site.</p>
            <p>• Refuser certains cookies peut limiter certaines fonctionnalités mais n'affecte pas les fonctions principales de ProfAssist.</p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}