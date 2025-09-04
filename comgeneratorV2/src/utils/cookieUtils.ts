// src/utils/cookieUtils.ts

/**
 * Utilitaires pour la gestion des cookies et du consentement
 */

// Vérifier si un script est déjà chargé
export function isScriptLoaded(src: string): boolean {
  return Boolean(document.querySelector(`script[src="${src}"]`));
}

// Charger un script de manière dynamique
export function loadScript(src: string, onLoad?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isScriptLoaded(src)) {
      onLoad?.();
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    
    script.onload = () => {
      onLoad?.();
      resolve();
    };
    
    script.onerror = () => {
      reject(new Error(`Impossible de charger le script: ${src}`));
    };
    
    document.head.appendChild(script);
  });
}

// Supprimer tous les scripts d'un domaine
export function removeScriptsByDomain(domain: string): void {
  const scripts = document.querySelectorAll(`script[src*="${domain}"]`);
  scripts.forEach(script => script.remove());
}

// Nettoyer les cookies d'un domaine spécifique
export function clearCookiesByDomain(domain: string): void {
  const cookies = document.cookie.split(';');
  
  cookies.forEach(cookie => {
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    
    // Supprimer le cookie pour différents domaines et chemins
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${domain}`;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${domain}`;
  });
}

// Nettoyer le localStorage lié aux trackers
export function clearTrackingStorage(): void {
  const keysToRemove = [
    '_ga', '_gid', '_gat', '_gtag', // Google Analytics
    '_gcl_au', '_gcl_aw', // Google Ads
    '_fbp', '_fbc', // Facebook
    '__utma', '__utmb', '__utmc', '__utmz' // Google Analytics classique
  ];
  
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (e) {
      // Ignorer les erreurs de stockage
    }
  });
}

// Vérifier si le consentement est encore valide
export function isConsentValid(consentDate: string, maxAgeDays = 30): boolean {
  try {
    const consent = new Date(consentDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - consent.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= maxAgeDays;
  } catch {
    return false;
  }
}

// Obtenir les informations sur les cookies actuels
export function getCookieInfo(): { name: string; value: string; size: number }[] {
  return document.cookie
    .split(';')
    .map(cookie => cookie.trim())
    .filter(cookie => cookie.length > 0)
    .map(cookie => {
      const [name, ...valueParts] = cookie.split('=');
      const value = valueParts.join('=');
      return {
        name: name.trim(),
        value: value || '',
        size: cookie.length
      };
    });
}

// Logger pour le debugging (en développement uniquement)
export function logCookieActivity(action: string, details?: any): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🍪 Cookie Activity: ${action}`, details);
  }
}

// Configuration des IDs de tracking (à personnaliser)
export const TRACKING_IDS = {
  GOOGLE_ANALYTICS: 'G-47T63MYM3K', // Remplacez par votre ID GA4
  GOOGLE_ADS: 'AW-7580889075',      // Remplacez par votre ID Google Ads
  GTM: 'GTM-XXXXXXX'               // Si vous utilisez Google Tag Manager
} as const;

// Vérifier si on est en mode développement
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
}

// Générer un ID de session unique pour l'anonymisation
export function generateSessionId(): string {
  return 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Vérifier si l'utilisateur est dans l'UE (approximatif)
export function isLikelyEUUser(): boolean {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const euTimezones = [
    'Europe/', 'Atlantic/Azores', 'Atlantic/Madeira', 'Atlantic/Canary'
  ];
  return euTimezones.some(tz => timezone.startsWith(tz));
}

// Obtenir le statut du consentement de manière sécurisée
export function getConsentStatus(): {
  hasConsent: boolean;
  consentData: any;
  isExpired: boolean;
} {
  try {
    const consentString = localStorage.getItem('profassist_cookie_consent');
    const consentDate = localStorage.getItem('profassist_consent_date');
    
    if (!consentString || !consentDate) {
      return { hasConsent: false, consentData: null, isExpired: false };
    }
    
    const consentData = JSON.parse(consentString);
    const isExpired = !isConsentValid(consentDate);
    
    return {
      hasConsent: true,
      consentData,
      isExpired
    };
  } catch (error) {
    logCookieActivity('Error reading consent status', error);
    return { hasConsent: false, consentData: null, isExpired: false };
  }
}