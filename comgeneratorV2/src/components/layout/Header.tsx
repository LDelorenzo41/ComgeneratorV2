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
  TrendingUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import useTokenBalance from '../../hooks/useTokenBalance';

// Event pour notifier les changements de tokens
export const tokenUpdateEvent = new EventTarget();
export const TOKEN_UPDATED = 'tokenUpdated';

export function Header() {
  const { user } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const tokenCount = useTokenBalance();
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [isBankDropdownOpen, setIsBankDropdownOpen] = React.useState(false);
  const location = useLocation();

  // AJOUT: Écouter les mises à jour de paiement
  React.useEffect(() => {
    const handlePaymentUpdate = () => {
      console.log('💰 Payment completed, refreshing tokens...');
      // Force refresh de la page après un petit délai
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    };

    // Écouter les événements de paiement
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

  // Ferme les menus déroulants si on clique ailleurs
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-autres')) {
        setIsDropdownOpen(false);
      }
      if (!target.closest('.dropdown-bank')) {
        setIsBankDropdownOpen(false);
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
          <div className="flex items-center space-x-4">
            {/* Lien vers la landing page au clic sur ProfAssist */}
            <Link to="/landing" className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                ProfAssist
              </span>
            </Link>
            <img 
              src="https://res.cloudinary.com/dhva6v5n8/image/upload/v1728059847/LOGO_T_T_zcdp8s.jpg"
              alt="Logo entreprise"
              className="h-16"
            />
          </div>

          {user && (
            <nav className="hidden md:flex items-center space-x-4">
              {navigationItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActivePath(item.path)
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {item.icon}
                  <span className="ml-2">{item.name}</span>
                </Link>
              ))}

              {/* Menu déroulant "Ma banque" */}
              <div className="relative dropdown-bank">
                <button
                  onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Database className="w-5 h-5" />
                  <span className="ml-2">Ma banque</span>
                </button>

                {isBankDropdownOpen && (
                  <div className="absolute z-10 bg-white dark:bg-gray-800 shadow-md rounded-md mt-2 w-56">
                    <div className="flex flex-col py-2">
                      <Link 
                        to="/appreciation-bank" 
                        className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => setIsBankDropdownOpen(false)}
                      >
                        Ma banque d'appréciations
                      </Link>
                      <Link 
                        to="/lessons-bank" 
                        className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => setIsBankDropdownOpen(false)}
                      >
                        Ma banque de séances
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Menu déroulant "Autres" au clic */}
              <div className="relative dropdown-autres">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="ml-2">Autres</span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-10 bg-white dark:bg-gray-800 shadow-md rounded-md mt-2 w-48">
                    <div className="flex flex-col py-2">
                      <Link 
                        to="/communication" 
                        className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Communication
                      </Link>
                      <Link 
                        to="/resources" 
                        className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Ressources
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          )}

          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
            {/* Affichage du compteur de tokens */}
            {user && tokenCount !== null && (
              <div className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tokenCount.toLocaleString()} tokens
                </span>
              </div>
            )}

            {/* Bouton Acheter des tokens */}
            {user && (
              <Link
                to="/buy-tokens"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Acheter des tokens
              </Link>
            )}

            {user && (
              <button
                onClick={handleLogout}
                className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={toggleTheme}
              className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-md transition-colors"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 p-2"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile simplifié */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {/* Compteur de tokens mobile */}
            {user && tokenCount !== null && (
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

            {/* Menu Ma banque mobile */}
            <div className="block px-3 py-2">
              <span className="text-gray-700 dark:text-gray-200 font-semibold flex items-center">
                <Database className="w-4 h-4 mr-2" />
                Ma banque
              </span>
              <div className="ml-6 mt-1 space-y-1">
                <Link 
                  to="/appreciation-bank" 
                  className="block px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Ma banque d'appréciations
                </Link>
                <Link 
                  to="/lessons-bank" 
                  className="block px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Ma banque de séances
                </Link>
              </div>
            </div>

            <Link 
              to="/communication" 
              className="flex items-center px-3 py-2 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Communication
            </Link>
            <Link 
              to="/resources" 
              className="flex items-center px-3 py-2 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Ressources
            </Link>

            {/* Bouton Acheter des tokens mobile */}
            {user && (
              <Link
                to="/buy-tokens"
                className="block px-3 py-2 mx-3 mt-3 rounded-md text-center text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Acheter des tokens
              </Link>
            )}

            {user && (
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
            )}
          </div>
        </div>
      )}
    </header>
  );
}
