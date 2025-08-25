import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { AuthLayout } from './components/auth/AuthLayout';
import { EmailConfirmationGuard } from './components/auth/EmailConfirmationGuard';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { CommunicationPage } from './pages/CommunicationPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { BuyTokensPage } from './pages/BuyTokensPage';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';
import { AppreciationBankPage } from './pages/AppreciationBankPage';
import { LandingPage } from './pages/LandingPage';
import { SynthesePage } from './pages/SynthesePage';
import { LessonGeneratorPage } from './pages/LessonGeneratorPage';
import { AuthHandler } from './pages/AuthHandler';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

// Import de la nouvelle page banque de séances
import LessonsBankPage from './pages/LessonsBankPage';

// 🆕 Import des routes légales
import { LegalRoutes } from './routes/LegalRoutes';

// 🆕 Import de la page de paramètres
import { SettingsPage } from './pages/SettingsPage';

import { useAuthStore, useThemeStore } from './lib/store';
import { supabase } from './lib/supabase';

function App() {
  const { setUser, setLoading, user, signOut } = useAuthStore();
  const { isDark } = useThemeStore();
  const [connectionError, setConnectionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token rafraîchi avec succès');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'USER_DELETED') {
        await signOut();
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading, signOut]);

  React.useEffect(() => {
    const handleAuthError = async (error: any) => {
      if (error?.__isAuthError) {
        console.log('Erreur d\'authentification détectée:', error);

        if (error.message.includes('refresh_token_not_found')) {
          console.log('Token de rafraîchissement non trouvé, déconnexion...');
          await signOut();
          setConnectionError('Votre session a expiré. Veuillez vous reconnecter.');
        }
      }
    };

    const unsubscribe = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        setConnectionError(null);
      }
    });

    return () => {
      unsubscribe.data.subscription.unsubscribe();
    };
  }, [signOut]);

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600 mb-4">Erreur de connexion</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">{connectionError}</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Se reconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            {/* Route racine redirige vers landing */}
            <Route path="/" element={<Navigate to="/landing" replace />} />
            
            {/* Route pour traiter l'authentification et confirmation d'email */}
            <Route path="/auth/callback" element={<AuthHandler />} />
            
            {/* Routes publiques */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* 🆕 Nouvelle route pour reset password */}
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/landing" element={<LandingPage />} />
            
            {/* 🆕 Routes légales (publiques - accessibles sans connexion) */}
            <Route path="/legal/*" element={<LegalRoutes />} />
            
            {/* Routes protégées avec garde de confirmation d'email OBLIGATOIRE */}
            <Route element={<AuthLayout />}>
              <Route path="/dashboard" element={
                <EmailConfirmationGuard>
                  <DashboardPage />
                </EmailConfirmationGuard>
              } />
              <Route path="/communication" element={
                <EmailConfirmationGuard>
                  <CommunicationPage />
                </EmailConfirmationGuard>
              } />
              <Route path="/resources" element={
                <EmailConfirmationGuard>
                  <ResourcesPage />
                </EmailConfirmationGuard>
              } />
              <Route path="/buy-tokens" element={
                <EmailConfirmationGuard>
                  <BuyTokensPage />
                </EmailConfirmationGuard>
              } />
              <Route path="/buy-tokens/success" element={
                <EmailConfirmationGuard>
                  <PaymentSuccessPage />
                </EmailConfirmationGuard>
              } />
              <Route path="/my-appreciations" element={
                <EmailConfirmationGuard>
                  <AppreciationBankPage />
                </EmailConfirmationGuard>
              } />
              <Route path="/appreciation-bank" element={
                <EmailConfirmationGuard>
                  <AppreciationBankPage />
                </EmailConfirmationGuard>
              } />
              <Route path="/lessons-bank" element={
                <EmailConfirmationGuard>
                  <LessonsBankPage />
                </EmailConfirmationGuard>
              } />
              <Route path="/synthese" element={
                <EmailConfirmationGuard>
                  <SynthesePage />
                </EmailConfirmationGuard>
              } />
              <Route path="/generate-lesson" element={
                <EmailConfirmationGuard>
                  <LessonGeneratorPage />
                </EmailConfirmationGuard>
              } />
              {/* 🆕 Route pour la page de paramètres avec suppression de compte */}
              <Route path="/settings" element={
                <EmailConfirmationGuard>
                  <SettingsPage />
                </EmailConfirmationGuard>
              } />
            </Route>
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;