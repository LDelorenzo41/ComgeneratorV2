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
  Bot,
  Layers,
  ClipboardList,
  Mail,
  CheckSquare,
  Send,
  Reply
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import useTokenBalance from '../../hooks/useTokenBalance';
import { FEATURES } from '../../lib/features';
import { checkIsAdmin } from '../../lib/ragApi';

// Event pour notifier les changements de tokens
export const tokenUpdateEvent = new EventTarget();
export const TOKEN_UPDATED = 'tokenUpdated';

export function Header() {
  const { user } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const tokenCount = useTokenBalance();
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const location = useLocation();

  // États pour les 4 menus déroulants
  const [isConcevoirOpen, setIsConcevoirOpen] = React.useState(false);
  const [isEvaluerOpen, setIsEvaluerOpen] = React.useState(false);
  const [isCommuniquerOpen, setIsCommuniquerOpen] = React.useState(false);
  const [isRessourcesOpen, setIsRessourcesOpen] = React.useState(false);

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

  React.useEffect(() => {
    if (user) {
      checkIsAdmin().then(setIsAdmin);
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  // Fermeture des dropdowns au clic extérieur
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-concevoir')) setIsConcevoirOpen(false);
      if (!target.closest('.dropdown-evaluer')) setIsEvaluerOpen(false);
      if (!target.closest('.dropdown-communiquer')) setIsCommuniquerOpen(false);
      if (!target.closest('.dropdown-ressources')) setIsRessourcesOpen(false);
      if (!target.closest('.dropdown-settings')) setIsSettingsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helpers pour vérifier si un menu est actif
  const isConcevoirActive = ['/scenario-pedagogique', '/generate-lesson', '/lessons-bank', '/scenarios-bank'].includes(location.pathname);
  const isEvaluerActive = ['/dashboard', '/appreciation-bank', '/synthese'].includes(location.pathname);
  const isCommuniquerActive = location.pathname === '/communication';
  const isRessourcesActive = ['/resources', '/chatbot', '/chatbot-answers'].includes(location.pathname);

  const menuButtonClass = (isActive: boolean) => 
    `flex items-center px-2 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
    }`;

  const menuItemClass = "flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700";
  const menuItemDisabledClass = "flex items-center px-4 py-2 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed";

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* ===== SECTION GAUCHE : Logo ===== */}
          <div className="flex items-center space-x-6 flex-shrink-0">
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

          {/* ===== SECTION CENTRE : Navigation principale (Desktop >= 1024px) ===== */}
          {user && !isLandingPage && (
            <nav className="hidden lg:flex items-center justify-center flex-1 px-4">
              <div className="flex items-center space-x-2">

                {/* ========== 🟦 CONCEVOIR ========== */}
                <div className="relative dropdown-concevoir">
                  <button
                    onClick={() => setIsConcevoirOpen(!isConcevoirOpen)}
                    className={menuButtonClass(isConcevoirActive)}
                  >
                    <Layers className="w-5 h-5" />
                    <span className="ml-2">Concevoir</span>
                  </button>
                  {isConcevoirOpen && (
                    <div className="absolute z-10 bg-white dark:bg-gray-800 shadow-md rounded-md mt-2 w-56">
                      <div className="flex flex-col py-2">
                        {/* Scénarios pédagogiques */}
                        {FEATURES.SCENARIO_ENABLED ? (
                          <Link 
                            to="/scenario-pedagogique" 
                            className={menuItemClass}
                            onClick={() => setIsConcevoirOpen(false)}
                          >
                            <ClipboardList className="w-4 h-4 mr-2" />
                            Scénarios pédagogiques
                          </Link>
                        ) : (
                          <span className={menuItemDisabledClass}>
                            <ClipboardList className="w-4 h-4 mr-2" />
                            Scénarios pédagogiques
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">à venir</span>
                          </span>
                        )}
                        
                        <Link 
                          to="/generate-lesson" 
                          className={menuItemClass}
                          onClick={() => setIsConcevoirOpen(false)}
                        >
                          <BookOpen className="w-4 h-4 mr-2" />
                          Séances pédagogiques
                        </Link>
                        <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                        
                        {/* Ma banque de scénarios */}
                        {FEATURES.SCENARIO_ENABLED ? (
                          <Link 
                            to="/scenarios-bank" 
                            className={menuItemClass}
                            onClick={() => setIsConcevoirOpen(false)}
                          >
                            <Database className="w-4 h-4 mr-2" />
                            Ma banque de scénarios
                          </Link>
                        ) : (
                          <span className={menuItemDisabledClass}>
                            <Database className="w-4 h-4 mr-2" />
                            Ma banque de scénarios
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">à venir</span>
                          </span>
                        )}
                        
                        <Link 
                          to="/lessons-bank" 
                          className={menuItemClass}
                          onClick={() => setIsConcevoirOpen(false)}
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Ma banque de séances
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* ========== 🟨 ÉVALUER ========== */}
                <div className="relative dropdown-evaluer">
                  <button
                    onClick={() => setIsEvaluerOpen(!isEvaluerOpen)}
                    className={menuButtonClass(isEvaluerActive)}
                  >
                    <CheckSquare className="w-5 h-5" />
                    <span className="ml-2">Évaluer</span>
                  </button>
                  {isEvaluerOpen && (
                    <div className="absolute z-10 bg-white dark:bg-gray-800 shadow-md rounded-md mt-2 w-56">
                      <div className="flex flex-col py-2">
                        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Appréciations</span>
                        </div>
                        <Link 
                          to="/dashboard" 
                          className={menuItemClass}
                          onClick={() => setIsEvaluerOpen(false)}
                        >
                          <PenTool className="w-4 h-4 mr-2" />
                          Générer une appréciation
                        </Link>
                        <Link 
                          to="/appreciation-bank" 
                          className={menuItemClass}
                          onClick={() => setIsEvaluerOpen(false)}
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Ma banque d'appréciations
                        </Link>
                        <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                        <Link 
                          to="/synthese" 
                          className={menuItemClass}
                          onClick={() => setIsEvaluerOpen(false)}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Synthèse
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* ========== 🟩 COMMUNIQUER ========== */}
                <div className="relative dropdown-communiquer">
                  <button
                    onClick={() => setIsCommuniquerOpen(!isCommuniquerOpen)}
                    className={menuButtonClass(isCommuniquerActive)}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="ml-2">Communiquer</span>
                  </button>
                  {isCommuniquerOpen && (
                    <div className="absolute z-10 bg-white dark:bg-gray-800 shadow-md rounded-md mt-2 w-60">
                      <div className="flex flex-col py-2">
                        <Link 
                          to="/communication?mode=create" 
                          className={menuItemClass}
                          onClick={() => setIsCommuniquerOpen(false)}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Créer une communication
                        </Link>
                        <Link 
                          to="/communication?mode=reply" 
                          className={menuItemClass}
                          onClick={() => setIsCommuniquerOpen(false)}
                        >
                          <Reply className="w-4 h-4 mr-2" />
                          Répondre à une communication
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* ========== 🟪 RESSOURCES ========== */}
                <div className="relative dropdown-ressources">
                  <button
                    onClick={() => setIsRessourcesOpen(!isRessourcesOpen)}
                    className={menuButtonClass(isRessourcesActive)}
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span className="ml-2">Ressources</span>
                  </button>
                  {isRessourcesOpen && (
                    <div className="absolute z-10 bg-white dark:bg-gray-800 shadow-md rounded-md mt-2 w-52">
                      <div className="flex flex-col py-2">
                        <Link 
                          to="/resources" 
                          className={menuItemClass}
                          onClick={() => setIsRessourcesOpen(false)}
                        >
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Flux RSS
                        </Link>
                        <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                        
                        {/* Mon Chatbot */}
                        {FEATURES.CHATBOT_ENABLED ? (
                          <Link 
                            to="/chatbot" 
                            className={menuItemClass}
                            onClick={() => setIsRessourcesOpen(false)}
                          >
                            <Bot className="w-4 h-4 mr-2" />
                            Mon chatbot
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded">Bêta</span>
                          </Link>
                        ) : (
                          <span className={menuItemDisabledClass}>
                            <Bot className="w-4 h-4 mr-2" />
                            Mon chatbot
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">à venir</span>
                          </span>
                        )}

                        {/* Ma banque de réponses */}
                        {FEATURES.CHATBOT_ENABLED ? (
                          <Link 
                            to="/chatbot-answers" 
                            className={menuItemClass}
                            onClick={() => setIsRessourcesOpen(false)}
                          >
                            <Database className="w-4 h-4 mr-2" />
                            Ma banque de réponses
                          </Link>
                        ) : (
                          <span className={menuItemDisabledClass}>
                            <Database className="w-4 h-4 mr-2" />
                            Ma banque de réponses
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">à venir</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </nav>
          )}

          {/* ===== SECTION DROITE : Actions utilisateur ===== */}
          <div className="flex items-center space-x-2 lg:space-x-3 flex-shrink-0">
            
            {/* Landing page - non connecté */}
            {isLandingPage && (
              <>
                {!user && (
                  <>
                    <Link
                      to="/login"
                      className="hidden md:block px-2 lg:px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <span className="hidden lg:inline">Se connecter</span>
                      <span className="lg:hidden">Connexion</span>
                    </Link>
                    <Link
                      to="/register"
                      className="hidden md:block px-2 lg:px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <span className="hidden lg:inline">S'inscrire</span>
                      <span className="lg:hidden">Inscription</span>
                    </Link>
                  </>
                )}
                {user && (
                  <Link
                    to="/dashboard"
                    className="hidden md:block px-2 lg:px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <span className="hidden lg:inline">Accéder à l'app</span>
                    <span className="lg:hidden">App</span>
                  </Link>
                )}
                <button
                  onClick={toggleTheme}
                  className="hidden md:block text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-md transition-colors"
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
              </>
            )}

            {/* Utilisateur connecté - hors landing */}
            {user && !isLandingPage && (
              <>
                {/* Tokens */}
                {tokenCount !== null && (
                  <div className="hidden md:flex items-center bg-blue-50 dark:bg-blue-900/30 px-1 lg:px-2 py-2 rounded-lg">
                    <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-1" />
                    <span className="text-xs lg:text-sm font-medium text-blue-700 dark:text-blue-300">
                      <span className="hidden xl:inline">{tokenCount.toLocaleString()} tokens</span>
                      <span className="xl:hidden">{(tokenCount / 1000).toFixed(0)}k</span>
                    </span>
                  </div>
                )}
                
                {/* Bouton Acheter */}
                <Link
                  to="/buy-tokens"
                  className="hidden md:block px-2 lg:px-3 py-2 rounded-md text-xs lg:text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <span className="hidden xl:inline">Acheter des tokens</span>
                  <span className="xl:hidden">Acheter</span>
                </Link>
                
                {/* Settings dropdown */}
                <div className="relative dropdown-settings hidden md:block">
                  <button
                    onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
                    className="flex items-center p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Settings className="w-4 lg:w-5 h-4 lg:h-5" />
                  </button>
                  {isSettingsDropdownOpen && (
                    <div className="absolute right-0 z-10 bg-white dark:bg-gray-800 shadow-md rounded-md mt-2 w-48">
                      <div className="flex flex-col py-2">
                        {/* Admin Newsletter */}
                        {isAdmin && (
                          <>
                            <Link
                              to="/admin/newsletter"
                              className="flex items-center px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => setIsSettingsDropdownOpen(false)}
                            >
                              <Mail className="w-4 h-4 mr-2" />
                              Gestion Newsletter
                            </Link>
                            <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                          </>
                        )}
                        
                        <Link
                          to="/settings"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setIsSettingsDropdownOpen(false)}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Paramètres du compte
                        </Link>
                        
                        <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                        
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
            
            {/* Bouton Menu Mobile (< 1024px) */}
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

      {/* ==================== MENU MOBILE ==================== */}
      {isMenuOpen && user && !isLandingPage && (
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            
            {/* Tokens */}
            {tokenCount !== null && (
              <div className="flex items-center justify-center px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg mx-3 mb-3">
                <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tokenCount.toLocaleString()} tokens
                </span>
              </div>
            )}

            {/* ========== 🟦 CONCEVOIR - Mobile ========== */}
            <div className="block px-3 py-2">
              <span className="text-gray-700 dark:text-gray-200 font-semibold flex items-center">
                <Layers className="w-4 h-4 mr-2" />
                Concevoir
              </span>
              <div className="ml-6 mt-1 space-y-1">
                {/* Scénarios pédagogiques - Mobile */}
                {FEATURES.SCENARIO_ENABLED ? (
                  <Link 
                    to="/scenario-pedagogique" 
                    className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Scénarios pédagogiques
                  </Link>
                ) : (
                  <span className="flex items-center px-3 py-1 text-base text-gray-400 dark:text-gray-500 cursor-not-allowed">
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Scénarios pédagogiques
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">à venir</span>
                  </span>
                )}
                
                <Link 
                  to="/generate-lesson" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Séances pédagogiques
                </Link>
                <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                
                {/* Ma banque de scénarios - Mobile */}
                {FEATURES.SCENARIO_ENABLED ? (
                  <Link 
                    to="/scenarios-bank" 
                    className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Ma banque de scénarios
                  </Link>
                ) : (
                  <span className="flex items-center px-3 py-1 text-base text-gray-400 dark:text-gray-500 cursor-not-allowed">
                    <Database className="w-4 h-4 mr-2" />
                    Ma banque de scénarios
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">à venir</span>
                  </span>
                )}
                
                <Link 
                  to="/lessons-bank" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Ma banque de séances
                </Link>
              </div>
            </div>

            {/* ========== 🟨 ÉVALUER - Mobile ========== */}
            <div className="block px-3 py-2">
              <span className="text-gray-700 dark:text-gray-200 font-semibold flex items-center">
                <CheckSquare className="w-4 h-4 mr-2" />
                Évaluer
              </span>
              <div className="ml-6 mt-1 space-y-1">
                <div className="py-1">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Appréciations</span>
                </div>
                <Link 
                  to="/dashboard" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <PenTool className="w-4 h-4 mr-2" />
                  Générer une appréciation
                </Link>
                <Link 
                  to="/appreciation-bank" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Ma banque d'appréciations
                </Link>
                <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                <Link 
                  to="/synthese" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Synthèse
                </Link>
              </div>
            </div>

            {/* ========== 🟩 COMMUNIQUER - Mobile ========== */}
            <div className="block px-3 py-2">
              <span className="text-gray-700 dark:text-gray-200 font-semibold flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Communiquer
              </span>
              <div className="ml-6 mt-1 space-y-1">
                <Link 
                  to="/communication?mode=create" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Créer une communication
                </Link>
                <Link 
                  to="/communication?mode=reply" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Reply className="w-4 h-4 mr-2" />
                  Répondre à une communication
                </Link>
              </div>
            </div>

            {/* ========== 🟪 RESSOURCES - Mobile ========== */}
            <div className="block px-3 py-2">
              <span className="text-gray-700 dark:text-gray-200 font-semibold flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Ressources
              </span>
              <div className="ml-6 mt-1 space-y-1">
                <Link 
                  to="/resources" 
                  className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Flux RSS
                </Link>
                <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                
                {/* Mon Chatbot - Mobile */}
                {FEATURES.CHATBOT_ENABLED ? (
                  <Link 
                    to="/chatbot" 
                    className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    Mon chatbot
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded">Bêta</span>
                  </Link>
                ) : (
                  <span className="flex items-center px-3 py-1 text-base text-gray-400 dark:text-gray-500 cursor-not-allowed">
                    <Bot className="w-4 h-4 mr-2" />
                    Mon chatbot
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">à venir</span>
                  </span>
                )}

                {/* Ma banque de réponses - Mobile */}
                {FEATURES.CHATBOT_ENABLED ? (
                  <Link 
                    to="/chatbot-answers" 
                    className="flex items-center px-3 py-1 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Ma banque de réponses
                  </Link>
                ) : (
                  <span className="flex items-center px-3 py-1 text-base text-gray-400 dark:text-gray-500 cursor-not-allowed">
                    <Database className="w-4 h-4 mr-2" />
                    Ma banque de réponses
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">à venir</span>
                  </span>
                )}
              </div>
            </div>

            {/* Acheter des tokens */}
            <Link
              to="/buy-tokens"
              className="block px-3 py-2 mx-3 mt-3 rounded-md text-center text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setIsMenuOpen(false)}
            >
              Acheter des tokens
            </Link>

            {/* Section paramètres mobile */}
            <div className="border-t border-gray-200 dark:border-gray-700 mt-3 pt-3">
              {/* Admin newsletter */}
              {isAdmin && (
                <Link
                  to="/admin/newsletter"
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-purple-600 dark:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Mail className="h-5 w-5 mr-2" />
                  <span>Gestion Newsletter</span>
                </Link>
              )}
              
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





