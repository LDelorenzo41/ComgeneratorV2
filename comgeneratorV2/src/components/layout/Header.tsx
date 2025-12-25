import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore, useThemeStore } from '../../lib/store';
import {
  LogOut,
  Moon,
  Sun,
  Menu,
  MessageSquare,
  PenTool,
  BookOpen,
  Database,
  Coins,
  FileText,
  TrendingUp,
  Settings,
  Bot
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import useTokenBalance from '../../hooks/useTokenBalance';

// Event pour notifier les changements de tokens ajout commentaire
export const tokenUpdateEvent = new EventTarget();
export const TOKEN_UPDATED = 'tokenUpdated';

export function Header() {
  const { user } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const tokenCount = useTokenBalance();
  const [isResourcesDropdownOpen, setIsResourcesDropdownOpen] = React.useState(false);
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = React.useState(false);
  const location = useLocation();

  const isLandingPage = location.pathname === '/landing' || 
                        location.pathname === '/' ||
                        (!user && location.pathname !== '/login' && location.pathname !== '/register');

  React.useEffect(() => {
    const handlePaymentUpdate = () => {
      console.log('💰 Payment completed, refreshing tokens...');
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    };

    window.addEventListener('tokensUpdated', handlePaymentUpdate);

    return () => {
      window.removeEventListener('tokensUpdated', handlePaymentUpdate);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-resources')) {
        setIsResourcesDropdownOpen(false);
      }
      if (!target.closest('.dropdown-settings')) {
        setIsSettingsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigationItems = [
    {
      name: 'Appréciations',
      path: '/dashboard',
      icon: <PenTool className="w-5 h-5" />
    },
    {
      name: 'Synthèse',
      path: '/synthese',
      icon: <FileText className="w-5 h-5" />
    },
    {
      name: 'Leçons',
      path: '/generate-lesson',
      icon: <BookOpen className="w-5 h-5" />
    }
  ];

  const isActivePath = (path: string) => location.pathname === path;

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          {/* Section gauche: Logo et nom */}
          <div className="flex items-center space-x-6">
            <Link to="/landing" className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                ProfAssist
              </span>
            </Link>
            <img 
              src="https://res.cloudinary.com/dhva6v5n8/image/upload/v1728059847/LOGO_T_T_zcdp8s.jpg"
              alt="Logo entreprise"
              className="h-12"
            />
          </div>

          {/* 🎯 Section droite: Contient la nav, les actions et le menu mobile pour un meilleur contrôle */}
          <div className="flex items-center space-x-2 md:space-x-4">

            {/* Navigation principale pour Desktop - Disparaît en dessous de 1024px */}
            {user && !isLandingPage && (
              <nav className="hidden lg:flex items-center space-x-4">
                {navigationItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center px-2 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActivePath(item.path)
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {item.icon}
                    <span className="ml-2">{item.name}</span>
                  </Link>
                ))}
                <Link
                  to="/communication"
                  className={`flex items-center px-2 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActivePath('/communication')
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="ml-2">Communication</span>
                </Link>
                <div className="relative dropdown-resources">
                  <button
                    onClick={() => setIsResourcesDropdownOpen(!isResourcesDropdownOpen)}
                    className="flex items-center px-2 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span className="ml-2">Ressources</span>
                  </button>
                  {isResourcesDropdownOpen && (
                    <div className="absolute z-10 bg-white dark:bg-gray-800 shadow-md rounded-md mt-2 w-56">
                      <div className="flex flex-col py-2">
                        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ma banque</span>
                        </div>
                        <Link 
                          to="/appreciation-bank" 
                          className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setIsResourcesDropdownOpen(false)}
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Ma banque d'appréciations
                        </Link>
                        <Link 
                          to="/lessons-bank" 
                          className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setIsResourcesDropdownOpen(false)}
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Ma banque de séances
                        </Link>
                        <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                        <Link 
                          to="/resources" 
                          className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setIsResourcesDropdownOpen(false)}
                        >
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Flux RSS
                        </Link>
                        <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                        <Link 
                          to="/chatbot" 
                          className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setIsResourcesDropdownOpen(false)}
                        >
                          <Bot className="w-4 h-4 mr-2" />
                          Mon Chatbot
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded">Bêta</span>
                        </Link>
                                                <Link 
                          to="/chatbot-answers" 
                          className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setIsResourcesDropdownOpen(false)}
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Ma banque de réponses
                        </Link>

                      </div>
                    </div>
                  )}
                </div>
              </nav>
            )}

            {/* Actions Utilisateur - 🎯 VISIBLE SUR TABLETTE ET DESKTOP (disparaît en dessous de 768px) */}
            <div className="hidden md:flex items-center space-x-2 lg:space-x-3">
              {isLandingPage && (
                <>
                  {!user && (
                    <>
                      <Link
                        to="/login"
                        className="px-2 lg:px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <span className="hidden lg:inline">Se connecter</span>
                        <span className="lg:hidden">Connexion</span>
                      </Link>
                      <Link
                        to="/register"
                        className="px-2 lg:px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        <span className="hidden lg:inline">S'inscrire</span>
                        <span className="lg:hidden">Inscription</span>
                      </Link>
                    </>
                  )}
                  {user && (
                    <Link
                      to="/dashboard"
                      className="px-2 lg:px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <span className="hidden lg:inline">Accéder à l'app</span>
                      <span className="lg:hidden">App</span>
                    </Link>
                  )}
                  <button
                    onClick={toggleTheme}
                    className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-md transition-colors"
                  >
                    {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </button>
                </>
              )}

              {user && !isLandingPage && (
                <>
                  {tokenCount !== null && (
                    <div className="flex items-center bg-blue-50 dark:bg-blue-900/30 px-1 lg:px-2 py-2 rounded-lg">
                      <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-1" />
                      <span className="text-xs lg:text-sm font-medium text-blue-700 dark:text-blue-300">
                        <span className="hidden xl:inline">{tokenCount.toLocaleString()} tokens</span>
                        <span className="xl:hidden">{(tokenCount / 1000).toFixed(0)}k</span>
                      </span>
                    </div>
                  )}
                  <Link
                    to="/buy-tokens"
                    className="px-2 lg:px-3 py-2 rounded-md text-xs lg:text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <span className="hidden xl:inline">Acheter des tokens</span>
                    <span className="xl:hidden">Acheter</span>
                  </Link>
                  <div className="relative dropdown-settings">
                    <button
                      onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
                      className="flex items-center p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Settings className="w-4 lg:w-5 h-4 lg:h-5" />
                    </button>
                    {isSettingsDropdownOpen && (
                      <div className="absolute right-0 z-10 bg-white dark:bg-gray-800 shadow-md rounded-md mt-2 w-48">
                        <div className="flex flex-col py-2">
                          {/* 🆕 NOUVEAU : Lien vers la page de paramètres */}
                          <Link
                            to="/settings"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => setIsSettingsDropdownOpen(false)}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Paramètres du compte
                          </Link>
                          
                          {/* Séparateur */}
                          <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                          
                          {/* Boutons existants */}
                          <button
                            onClick={() => { toggleTheme(); setIsSettingsDropdownOpen(false); }}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                            {isDark ? 'Mode clair' : 'Mode sombre'}
                          </button>
                          <button
                            onClick={() => { handleLogout(); setIsSettingsDropdownOpen(false); }}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <LogOut className="w-4 h-4 mr-2" />
                            Déconnexion
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            
            {/* Menu Mobile - 🎯 APPARAÎT QUAND LA NAV PRINCIPALE DISPARAÎT (en dessous de 1024px) */}
            {!isLandingPage && (
              <div className="lg:hidden flex items-center">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 p-2"
                >
                  <Menu className="h-6 w-6" />
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Menu déroulant Mobile */}
      {isMenuOpen && user && !isLandingPage && (
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {tokenCount !== null && (
              <div className="flex items-center justify-center px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg mx-3 mb-3">
                <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tokenCount.toLocaleString()} tokens
                </span>
              </div>
            )}
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2 rounded-md text-base font-medium ${
                  isActivePath(item.path)
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.icon}
                <span className="ml-2">{item.name}</span>
              </Link>
            ))}
            <Link
              to="/communication"
              className={`flex items-center px-3 py-2 rounded-md text-base font-medium ${
                isActivePath('/communication')
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              <span className="ml-2">Communication</span>
            </Link>
            <div className="block px-3 py-2">
              <span className="text-gray-700 dark:text-gray-200 font-semibold flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Ressources
              </span>
              <div className="ml-6 mt-1 space-y-1">
                <div className="py-1">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ma banque</span>
                </div>
                <Link 
                  to="/appreciation-bank" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Ma banque d'appréciations
                </Link>
                <Link 
                  to="/lessons-bank" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Ma banque de séances
                </Link>
                <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                <Link 
                  to="/resources" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Flux RSS
                </Link>
                <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                <Link 
                  to="/chatbot" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Bot className="w-4 h-4 mr-2" />
                  Mon Chatbot
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded">Bêta</span>
                </Link>
                                <Link 
                  to="/chatbot-answers" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Ma banque de réponses
                </Link>

              </div>
            </div>
            <Link
              to="/buy-tokens"
              className="block px-3 py-2 mx-3 mt-3 rounded-md text-center text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setIsMenuOpen(false)}
            >
              Acheter des tokens
            </Link>
            <div className="border-t border-gray-200 dark:border-gray-700 mt-3 pt-3">
              {/* 🆕 AJOUT : Lien Paramètres dans le menu mobile */}
              <Link
                to="/settings"
                className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                onClick={() => setIsMenuOpen(false)}
              >
                <Settings className="h-5 w-5 mr-2" />
                <span>Paramètres du compte</span>
              </Link>
              <button
                onClick={() => {
                  toggleTheme();
                  setIsMenuOpen(false);
                }}
                className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                {isDark ? <Sun className="h-5 w-5 mr-2" /> : <Moon className="h-5 w-5 mr-2" />}
                <span>{isDark ? 'Mode clair' : 'Mode sombre'}</span>
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
                className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <LogOut className="h-5 w-5 mr-2" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}