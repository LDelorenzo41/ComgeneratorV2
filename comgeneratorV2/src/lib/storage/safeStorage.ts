// src/lib/storage/safeStorage.ts
/**
 * Wrapper sécurisé pour localStorage avec fallback en mémoire
 * Gère les cas où localStorage est désactivé/indisponible
 */

class SafeStorage {
  private memoryStorage: Map<string, string> = new Map();
  private isLocalStorageAvailable: boolean;

  constructor() {
    this.isLocalStorageAvailable = this.checkLocalStorage();
    
    if (!this.isLocalStorageAvailable) {
      console.warn('⚠️ localStorage indisponible, utilisation du fallback mémoire');
    }
  }

  /**
   * Vérifie si localStorage est disponible
   */
  private checkLocalStorage(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Stocke une valeur (avec fallback mémoire)
   */
  setItem(key: string, value: string): void {
    if (this.isLocalStorageAvailable) {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (e) {
        console.error('❌ Erreur localStorage.setItem:', e);
        // Fallback vers mémoire en cas d'erreur
      }
    }
    
    // Utilisation du fallback mémoire
    this.memoryStorage.set(key, value);
  }

  /**
   * Récupère une valeur (avec fallback mémoire)
   */
  getItem(key: string): string | null {
    if (this.isLocalStorageAvailable) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.error('❌ Erreur localStorage.getItem:', e);
        // Fallback vers mémoire
      }
    }
    
    return this.memoryStorage.get(key) || null;
  }

  /**
   * Supprime une valeur (avec fallback mémoire)
   */
  removeItem(key: string): void {
    if (this.isLocalStorageAvailable) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error('❌ Erreur localStorage.removeItem:', e);
      }
    }
    
    this.memoryStorage.delete(key);
  }

  /**
   * Efface tout le storage
   */
  clear(): void {
    if (this.isLocalStorageAvailable) {
      try {
        localStorage.clear();
      } catch (e) {
        console.error('❌ Erreur localStorage.clear:', e);
      }
    }
    
    this.memoryStorage.clear();
  }

  /**
   * Vérifie si une clé existe
   */
  hasItem(key: string): boolean {
    if (this.isLocalStorageAvailable) {
      try {
        return localStorage.getItem(key) !== null;
      } catch (e) {
        // Fallback vers mémoire
      }
    }
    
    return this.memoryStorage.has(key);
  }

  /**
   * Retourne toutes les clés
   */
  keys(): string[] {
    if (this.isLocalStorageAvailable) {
      try {
        return Object.keys(localStorage);
      } catch (e) {
        console.error('❌ Erreur localStorage.keys:', e);
      }
    }
    
    return Array.from(this.memoryStorage.keys());
  }

  /**
   * Vérifie si localStorage est disponible
   */
  isAvailable(): boolean {
    return this.isLocalStorageAvailable;
  }

  /**
   * Retourne le mode actuel (localStorage ou memory)
   */
  getStorageMode(): 'localStorage' | 'memory' {
    return this.isLocalStorageAvailable ? 'localStorage' : 'memory';
  }
}

// Export d'une instance singleton
export const safeStorage = new SafeStorage();

// Export de la classe pour les tests
export { SafeStorage };