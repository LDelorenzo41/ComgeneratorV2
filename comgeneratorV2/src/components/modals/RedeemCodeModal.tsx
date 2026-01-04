// src/components/modals/RedeemCodeModal.tsx
// Modal pour permettre aux utilisateurs d'entrer un code promo

import React, { useState } from 'react';
import {
  Gift,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Coins
} from 'lucide-react';
import { redeemPromoCode } from '../../lib/promoApi';

interface RedeemCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RedeemCodeModal({ isOpen, onClose }: RedeemCodeModalProps) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    tokensAdded?: number;
    description?: string;
    error?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) return;
    
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await redeemPromoCode(code.trim());
      
      if (response.success) {
        setResult({
          success: true,
          tokensAdded: response.tokens_added,
          description: response.campaign_description,
        });
      } else {
        setResult({
          success: false,
          error: response.error,
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: 'Une erreur est survenue. Veuillez réessayer.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Si un code a été utilisé avec succès, recharger la page pour mettre à jour les tokens
    if (result?.success) {
      window.location.reload();
    }
    setCode('');
    setResult(null);
    onClose();
  };

  const handleNewCode = () => {
    setCode('');
    setResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">J'ai un code !</h3>
                <p className="text-green-100 text-sm">Entrez votre code promo</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Affichage du résultat succès */}
          {result?.success ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              
              <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Félicitations !
              </h4>
              
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-center text-green-700 dark:text-green-300">
                  <Coins className="w-6 h-6 text-yellow-500 mr-2" />
                  <span className="text-2xl font-bold">
                    +{result.tokensAdded?.toLocaleString()}
                  </span>
                  <span className="ml-2 text-lg">tokens</span>
                </div>
                <p className="text-green-600 dark:text-green-400 text-sm mt-2">
                  ont été ajoutés à votre compte
                </p>
              </div>

              {result.description && (
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
                  {result.description}
                </p>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleNewCode}
                  className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Autre code
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : result?.error ? (
            /* Affichage du résultat erreur */
            <div className="text-center">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Code invalide
              </h4>
              
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                <p className="text-red-700 dark:text-red-300">
                  {result.error}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleNewCode}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Réessayer
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            /* Formulaire de saisie du code */
            <form onSubmit={handleSubmit}>
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                Vous avez reçu un code promotionnel ? Entrez-le ci-dessous pour 
                recevoir des tokens bonus sur votre compte.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Code promo
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Entrez votre code"
                  autoFocus
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-lg text-center tracking-wider"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Le code est sensible à la casse
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !code.trim()}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Valider le code
                  </>
                )}
              </button>

              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
                Chaque code ne peut être utilisé qu'une seule fois par compte.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

