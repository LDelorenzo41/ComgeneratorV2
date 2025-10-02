// src/contexts/CookieConsentContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
// ✅ AJOUT : Import des fonctions RGPD
import { logConsent, getOrCreateSessionId } from '../lib/api/consent';
import { safeStorage } from '../lib/storage/safeStorage';
import { useAuthStore } from '../lib/store';

// Types pour Google Analytics/Ads
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export type CookieConsent = {
  necessary: boolean;      // Toujours true (obligatoires)
  analytics: boolean;      // Google Analytics
  advertising: boolean;    // Google Ads
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
  analytics: false,
  advertising: false,
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
          
          // ✅ AJOUT : Mettre à jour Consent Mode avec les préférences sauvegardées
          updateGoogleConsentMode(consentData.consent);
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
    const optionalCookies = currentConsent.analytics || currentConsent.advertising || currentConsent.functional;
    
    if (optionalCookies && currentConsent.analytics && currentConsent.advertising && currentConsent.functional) {
      setConsentStatus('given');
    } else if (optionalCookies) {
      setConsentStatus('partial');
    } else {
      setConsentStatus('denied');
    }
  };

  // ============================================
  // ✅ AJOUT : Fonction Google Consent Mode v2
  // ============================================
  /**
   * Met à jour Google Consent Mode v2 selon les préférences utilisateur
   */
  const updateGoogleConsentMode = (consentData: CookieConsent) => {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        'analytics_storage': consentData.analytics ? 'granted' : 'denied',
        'ad_storage': consentData.advertising ? 'granted' : 'denied',
        'ad_user_data': consentData.advertising ? 'granted' : 'denied',
        'ad_personalization': consentData.advertising ? 'granted' : 'denied',
        'functionality_storage': consentData.functional ? 'granted' : 'denied',
        'personalization_storage': consentData.functional ? 'granted' : 'denied',
      });

      console.log('✅ Google Consent Mode mis à jour:', {
        analytics: consentData.analytics ? 'granted' : 'denied',
        advertising: consentData.advertising ? 'granted' : 'denied',
        functional: consentData.functional ? 'granted' : 'denied',
      });
    }
  };
  // ============================================
  // FIN AJOUT
  // ============================================

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
      
      // ✅ AJOUT : Mettre à jour Google Consent Mode
      updateGoogleConsentMode(newConsent);
      
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
    // Google Analytics
    if (currentConsent.analytics) {
      loadGoogleAnalytics();
    }
    
    // Google Ads
    if (currentConsent.advertising) {
      loadGoogleAds();
    }
    
    // Autres scripts fonctionnels
    if (currentConsent.functional) {
      loadFunctionalScripts();
    }
  };

  // Chargement Google Analytics
  const loadGoogleAnalytics = () => {
    if (window.gtag) return; // Déjà chargé
    
    const GA_ID = 'G-47T63MYM3K'; // Remplacez par votre ID GA4
    
    // Charger le script GA4
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
    
    // Initialiser gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      anonymize_ip: true,
      cookie_flags: 'max-age=7200;secure;samesite=none'
    });
    
    console.log('✅ Google Analytics chargé');
  };

  // Chargement Google Ads
  const loadGoogleAds = () => {
    const ADS_ID = 'AW-7580889075'; // Remplacez par votre ID Google Ads
    
    if (window.gtag) {
      // Si gtag existe déjà (via Analytics), ajouter juste la config Ads
      window.gtag('config', ADS_ID);
    } else {
      // Charger gtag pour Ads seulement
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`;
      document.head.appendChild(script);
      
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', ADS_ID);
    }
    
    console.log('✅ Google Ads chargé');
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
      analytics: true,
      advertising: true,
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