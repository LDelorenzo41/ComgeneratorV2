import React from 'react';
import { X, Gift, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { tokenUpdateEvent, TOKEN_UPDATED } from './layout/Header';

export function SpecialOfferModal() {
  const { user } = useAuthStore();
  const [isVisible, setIsVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  // Vérifier si l'utilisateur est éligible à l'offre
  React.useEffect(() => {
    const checkEligibility = async () => {
      if (!user) {
        setChecking(false);
        return;
      }

      try {
        // Vérifier la date limite (10 décembre 2025)
        const currentDate = new Date();
        const deadlineDate = new Date('2025-12-10T23:59:59');
        
        if (currentDate > deadlineDate) {
          setIsVisible(false);
          setChecking(false);
          return;
        }

        // Vérifier si l'utilisateur a déjà réclamé l'offre
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('special_offer_claimed')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Erreur lors de la vérification de l\'éligibilité:', error);
          setChecking(false);
          return;
        }

        // Afficher la modale si l'offre n'a pas été réclamée
        if (!profile?.special_offer_claimed) {
          setIsVisible(true);
        }
      } catch (err) {
        console.error('Erreur dans checkEligibility:', err);
      } finally {
        setChecking(false);
      }
    };

    checkEligibility();
  }, [user]);

  const handleAccept = async () => {
    if (!user || loading) return;

    setLoading(true);

    try {
      // 1. Récupérer le nombre actuel de tokens
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      // 2. Ajouter 30 000 tokens et marquer l'offre comme réclamée
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          tokens: (profile?.tokens || 0) + 30000,
          special_offer_claimed: true
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // 3. Émettre l'événement de mise à jour des tokens
      tokenUpdateEvent.dispatchEvent(new CustomEvent(TOKEN_UPDATED));

      // 4. Afficher une notification de succès
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-[100] transition-all duration-300 transform translate-x-0';
      successDiv.innerHTML = '🎁 30 000 tokens ajoutés à votre compte !';
      document.body.appendChild(successDiv);
      
      setTimeout(() => {
        successDiv.style.transform = 'translateX(100%)';
        successDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(successDiv), 300);
      }, 3000);

      // 5. Fermer la modale
      setIsVisible(false);

    } catch (error) {
      console.error('Erreur lors de l\'acceptation de l\'offre:', error);
      alert('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  // Ne rien afficher si on vérifie encore ou si pas visible
  if (checking || !isVisible) return null;

  return (
    <>
      {/* Overlay avec flou */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Modale */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div 
          className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-8 transform transition-all duration-300 animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Bouton fermer (croix) */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Icône cadeau avec animation */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Gift className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          {/* Contenu */}
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
              <span>🎁</span>
              <span>Cadeau spécial période des bulletins !</span>
            </h2>
            
            <p className="text-lg text-gray-700 dark:text-gray-300">
              ProfAssist vous offre <strong className="text-blue-600 dark:text-blue-400">30 000 tokens</strong> pour vous accompagner dans cette période intense.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Offre limitée : une seule recharge gratuite possible jusqu'au <strong>10 décembre 2025</strong>
              </p>
            </div>

            {/* Bouton principal */}
            <button
              onClick={handleAccept}
              disabled={loading}
              className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-6 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Activation en cours...
                  </>
                ) : (
                  <>
                    <Gift className="w-5 h-5" />
                    Accepter et obtenir mes 30 000 tokens gratuits
                  </>
                )}
              </span>
            </button>

            {/* Bouton secondaire */}
            <button
              onClick={handleClose}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors underline"
            >
              Je verrai plus tard
            </button>
          </div>
        </div>
      </div>

      {/* Animation CSS */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
}