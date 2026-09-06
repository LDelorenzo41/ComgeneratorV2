// src/contexts/CookieConsentContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
// ✅ AJOUT : Import des fonctions RGPD
import { logConsent, getOrCreateSessionId } from '../lib/api/consent';
import { safeStorage } from '../lib/storage/safeStorage';
import { useAuthStore } from '../lib/store';

export type CookieConsent = {
  necessary: boolean;      // Toujours true (obligatoires)
  functional: boolean;     // Préférences utilisateur
};

export type ConsentStatus = 'pending' | 'given' | 'denied' | 'partial';

interface CookieConsentContextType {
  consent: CookieConsent;
  consentStatus: ConsentStatus;
  showBanner: boolean;
  updateConsent: (newConsent: Partial<CookieConsent>) => void;
  acceptAll: () => void;
  acceptNecessaryOnly: () => void;
  openPreferences: () => void;
  closeBanner: () => void;
  hasConsented: boolean;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

// Valeurs par défaut
const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  functional: false,
};

// Clé de stockage
const CONSENT_STORAGE_KEY = 'profassist_cookie_consent';
const CONSENT_DATE_KEY = 'profassist_consent_date';
const CONSENT_VERSION = '1.0'; // Incrémenter pour forcer une nouvelle demande

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent>(DEFAULT_CONSENT);
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('pending');
  const [showBanner, setShowBanner] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  
  // ✅ AJOUT : Récupération de l'utilisateur connecté et session ID
  const { user } = useAuthStore();
  const sessionId = getOrCreateSessionId();

  // Charger le consentement sauvegardé au démarrage
  useEffect(() => {
    try {
      // ✅ MODIFIÉ : Utilisation de safeStorage au lieu de localStorage
      const savedConsent = safeStorage.getItem(CONSENT_STORAGE_KEY);
      const savedDate = safeStorage.getItem(CONSENT_DATE_KEY);
      
      if (savedConsent && savedDate) {
        const consentData = JSON.parse(savedConsent);
        const consentDate = new Date(savedDate);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        // Vérifier si le consentement n'est pas trop ancien (30 jours)
        if (consentDate > thirtyDaysAgo && consentData.version === CONSENT_VERSION) {
          setConsent(consentData.consent);
          setHasConsented(true);
          updateConsentStatus(consentData.consent);
          setShowBanner(false);
          
          // Charger les scripts autorisés
          loadAuthorizedScripts(consentData.consent);
          return;
        }
      }
      
      // Aucun consentement valide trouvé, afficher la bannière
      setShowBanner(true);
      setHasConsented(false);
      
    } catch (error) {
      console.error('Erreur lors du chargement du consentement:', error);
      setShowBanner(true);
      setHasConsented(false);
    }
  }, []);

  // Mettre à jour le statut basé sur le consentement
  const updateConsentStatus = (currentConsent: CookieConsent) => {
    // Une seule catégorie optionnelle subsiste : le statut est donc binaire.
    // 'partial' n'est plus atteignable, mais reste dans le type ConsentStatus
    // pour les enregistrements historiques de consent_logs.
    setConsentStatus(currentConsent.functional ? 'given' : 'denied');
  };

  // ✅ MODIFIÉ : Fonction saveConsent avec logging RGPD
  const saveConsent = async (newConsent: CookieConsent) => {
    try {
      const now = new Date().toISOString();
      const consentData = {
        consent: newConsent,
        date: now,
        version: CONSENT_VERSION
      };
      
      // ✅ MODIFIÉ : Utilisation de safeStorage
      safeStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentData));
      safeStorage.setItem(CONSENT_DATE_KEY, now);
      
      setConsent(newConsent);
      setHasConsented(true);
      updateConsentStatus(newConsent);
      setShowBanner(false);
      
      // Charger ou décharger les scripts selon le consentement
      loadAuthorizedScripts(newConsent);
      
      // ✅ AJOUT : Logging RGPD asynchrone (ne bloque pas l'UX)
      const action = !hasConsented ? 'grant' : 'update';
      
      logConsent({
        userId: user?.id || null,
        sessionId,
        consentData: newConsent,
        consentVersion: CONSENT_VERSION,
        action,
      }).catch(err => {
        // Log silencieux pour ne pas perturber l'utilisateur
        console.error('Échec du logging RGPD (non bloquant):', err);
      });
      
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du consentement:', error);
    }
  };

  // Charger les scripts autorisés
  const loadAuthorizedScripts = (currentConsent: CookieConsent) => {
    if (currentConsent.functional) {
      loadFunctionalScripts();
    }
  };

  // Scripts fonctionnels (optionnel)
  const loadFunctionalScripts = () => {
    // Ici vous pouvez ajouter d'autres scripts comme :
    // - Chatbots
    // - Cartes interactives
    // - Widgets sociaux
    console.log('✅ Scripts fonctionnels chargés');
  };

  // Actions publiques
  const updateConsent = (newConsent: Partial<CookieConsent>) => {
    const updatedConsent = { ...consent, ...newConsent };
    saveConsent(updatedConsent);
  };

  const acceptAll = () => {
    const fullConsent: CookieConsent = {
      necessary: true,
      functional: true,
    };
    saveConsent(fullConsent);
  };

  const acceptNecessaryOnly = () => {
    saveConsent(DEFAULT_CONSENT);
  };

  const openPreferences = () => {
    setShowBanner(true);
  };

  const closeBanner = () => {
    setShowBanner(false);
  };

  const value: CookieConsentContextType = {
    consent,
    consentStatus,
    showBanner,
    updateConsent,
    acceptAll,
    acceptNecessaryOnly,
    openPreferences,
    closeBanner,
    hasConsented,
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

// Hook pour utiliser le contexte
export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error('useCookieConsent doit être utilisé dans un CookieConsentProvider');
  }
  return context;
}