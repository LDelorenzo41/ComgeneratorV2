import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore, useThemeStore } from '../../lib/store';
import { LogOut, Moon, Sun, Menu, MessageSquare, PenTool, BookOpen, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Event pour notifier les changements de tokens
export const tokenUpdateEvent = new EventTarget();
export const TOKEN_UPDATED = 'tokenUpdated';

export function Header() {
  const { user } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [tokenCount, setTokenCount] = React.useState<number | null>(null);
  const location = useLocation();

  // Récupérer le nombre de tokens
  const fetchTokens = React.useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Erreur lors de la récupération des tokens:', error);
        return;
      }
      
      setTokenCount(data?.tokens ?? 0);
    } catch (err) {
      console.error('Erreur:', err);
    }
  }, [user]);

  React.useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Écouter les événements de mise à jour des tokens
  React.useEffect(() => {
    const handleTokenUpdate = () => {
      fetchTokens();
    };

    tokenUpdateEvent.addEventListener(TOKEN_UPDATED, handleTokenUpdate);
    return () => {
      tokenUpdateEvent.removeEventListener(TOKEN_UPDATED, handleTokenUpdate);
    };
  }, [fetchTokens]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  const navigationItems = [
    {
      name: 'Appréciations',
      path: '/dashboard',
      icon: <PenTool className="w-5 h-5" />
    },
    {
      name: 'Communication',
      path: '/communication',
      icon: <MessageSquare className="w-5 h-5" />
    },
    {
      name: 'Ressources',
      path: '/resources',
      icon: <BookOpen className="w-5 h-5" />
    },
    {
      name: 'Ma banque',
      path: '/my-appreciations',
      icon: <Tag className="w-5 h-5" />
    }
  ];

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">Comgénérator</span>
            </Link>
            <span className="text-gray-600 dark:text-gray-300 flex items-center">
              un service web proposé par
              <img 
                src="https://res.cloudinary.com/dhva6v5n8/image/upload/v1728059847/LOGO_T_T_zcdp8s.jpg"
                alt="Logo entreprise"
                className="h-16 ml-3"
              />
            </span>
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
              {user && (
                <div className="flex items-center space-x-3">
                  {tokenCount !== null && (
                    <span className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                      {tokenCount.toLocaleString()} tokens
                    </span>
                  )}
                  <Link
                    to="/buy-tokens"
                    className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Acheter des tokens
                  </Link>
                </div>
              )}
            </nav>
          )}

          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
            {user && (
              <button
                onClick={handleLogout}
                className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium"
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={toggleTheme}
              className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-md"
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

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {user && navigationItems.map((item) => (
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
            {user && tokenCount !== null && (
              <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                Tokens: {tokenCount.toLocaleString()}
              </div>
            )}
            {user && (

              <button
                onClick={handleLogout}
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