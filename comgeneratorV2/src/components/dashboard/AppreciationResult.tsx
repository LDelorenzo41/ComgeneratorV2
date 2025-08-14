import React from 'react';
import { Copy, Check, Lock, ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

interface AppreciationResultProps {
  detailed: string;
  summary: string;
  setDetailed: React.Dispatch<React.SetStateAction<string>>;
  setSummary: React.Dispatch<React.SetStateAction<string>>;
}

export function AppreciationResult({
  detailed,
  summary,
  setDetailed,
  setSummary
}: AppreciationResultProps) {
  const [copiedDetailed, setCopiedDetailed] = React.useState(false);
  const [copiedSummary, setCopiedSummary] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const { user } = useAuthStore();

  // ✅ AJOUT : États pour vérifier l'accès banque
  const [hasBankAccess, setHasBankAccess] = React.useState<boolean | null>(null);
  const [bankAccessLoading, setBankAccessLoading] = React.useState(true);

  const tagOptions = [
    { label: 'Très bien', value: 'tres_bien' },
    { label: 'Bien', value: 'bien' },
    { label: 'Moyen', value: 'moyen' },
    { label: 'Insuffisant', value: 'insuffisant' },
  ];

  // ✅ AJOUT : Vérification de l'accès banque au chargement
  React.useEffect(() => {
    const checkBankAccess = async () => {
      if (!user) {
        setHasBankAccess(null);
        setBankAccessLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('has_bank_access')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Erreur lors de la vérification de l\'accès banque:', error);
          setHasBankAccess(false);
        } else {
          setHasBankAccess(profile?.has_bank_access || false);
        }
      } catch (err) {
        console.error('Erreur dans checkBankAccess:', err);
        setHasBankAccess(false);
      } finally {
        setBankAccessLoading(false);
      }
    };

    checkBankAccess();
  }, [user]);

  const copyToClipboard = async (text: string, type: 'detailed' | 'summary') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'detailed') {
        setCopiedDetailed(true);
        setTimeout(() => setCopiedDetailed(false), 2000);
      } else {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2000);
      }
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  // ✅ MODIFICATION : Vérification de l'accès banque avant ouverture du menu
  const handleTagClick = () => {
    if (!user) return;

    // Vérifier l'accès banque
    if (!hasBankAccess) {
      const userConfirmed = confirm(
        '⚠️ Accès banque requis\n\n' +
        'Pour sauvegarder vos appréciations, vous devez disposer d\'un plan avec accès banque.\n\n' +
        'Souhaitez-vous consulter nos plans ?'
      );
      
      if (userConfirmed) {
        window.location.href = '/buy-tokens';
      }
      return;
    }

    setMenuOpen((prev) => !prev);
  };

  const handleSelectTag = (tag: string) => {
    setSelectedTag(tag);
    setMenuOpen(false);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!user || !selectedTag) return;
    
    // Double vérification de l'accès banque
    if (!hasBankAccess) {
      alert('Erreur : Accès banque requis pour sauvegarder');
      setConfirmOpen(false);
      setSelectedTag(null);
      return;
    }

    try {
      const { error } = await supabase.from('appreciations').insert({
        user_id: user.id,
        detailed,
        summary,
        tag: selectedTag,
      });
      
      if (error) throw error;

      // ✅ AJOUT : Animation de succès
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 transform translate-x-0';
      successDiv.innerHTML = '✅ Appréciation ajoutée à votre banque !';
      document.body.appendChild(successDiv);
      
      setTimeout(() => {
        successDiv.style.transform = 'translateX(100%)';
        successDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(successDiv), 300);
      }, 3000);

    } catch (error) {
      console.error("Erreur lors de l'enregistrement de l'appréciation:", error);
      alert('Erreur lors de la sauvegarde de l\'appréciation. Veuillez réessayer.');
    } finally {
      setConfirmOpen(false);
      setSelectedTag(null);
    }
  };

  const selectedLabel = tagOptions.find(t => t.value === selectedTag)?.label || selectedTag;

  // ✅ AJOUT : Fonction pour rendre le bouton conditionnel
  const renderTagButton = () => {
    if (bankAccessLoading) {
      return (
        <button 
          disabled 
          className="mt-4 px-4 py-2 bg-gray-400 text-gray-600 rounded-md cursor-not-allowed opacity-60 flex items-center"
        >
          <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin mr-2"></div>
          Vérification...
        </button>
      );
    }

    if (!hasBankAccess) {
      return (
        <div className="relative group">
          <button
            disabled
            className="mt-4 px-4 py-2 bg-gray-400 text-gray-600 rounded-md cursor-not-allowed opacity-60 flex items-center"
            title="Accès banque requis"
          >
            <Lock className="w-4 h-4 mr-2" />
            Taguer et enregistrer (accès requis)
          </button>
          
          {/* ✅ TOOLTIP EXPLICATIF */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
            <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 whitespace-nowrap">
              Achetez un plan avec banque pour sauvegarder
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <button
        onClick={handleTagClick}
        disabled={!user}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 hover:bg-blue-700 transition-colors"
      >
        Taguer et enregistrer
      </button>
    );
  };

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Version détaillée</h3>
        <div className="mt-2 p-4 bg-white dark:bg-gray-800 rounded-md shadow relative">
          <textarea
            value={detailed}
            onChange={(e) => setDetailed(e.target.value)}
            rows={6}
            className="w-full resize-y rounded-md border border-gray-300 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => copyToClipboard(detailed, 'detailed')}
            className="absolute bottom-4 right-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title="Copier le texte"
          >
            {copiedDetailed ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Version synthétique</h3>
        <div className="mt-2 p-4 bg-white dark:bg-gray-800 rounded-md shadow relative">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-md border border-gray-300 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => copyToClipboard(summary, 'summary')}
            className="absolute bottom-4 right-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title="Copier le texte"
          >
            {copiedSummary ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ✅ BOUTON CONDITIONNEL */}
      <div className="relative">
        {renderTagButton()}
        
        {menuOpen && hasBankAccess && (
          <div className="absolute z-10 mt-2 w-40 rounded-md shadow-lg bg-white dark:bg-gray-800">
            {tagOptions.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handleSelectTag(value)}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ✅ ALERTE POUR UTILISATEURS SANS ACCÈS BANQUE */}
      {!bankAccessLoading && !hasBankAccess && (
        <div className="bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Lock className="w-6 h-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">
                Sauvegarde non disponible
              </h5>
              <p className="text-orange-700 dark:text-orange-300 text-sm">
                Votre plan actuel ne permet pas de sauvegarder les appréciations. 
                <button 
                  onClick={() => window.location.href = '/buy-tokens'}
                  className="underline hover:no-underline font-medium ml-1"
                >
                  Upgrader vers un plan avec banque
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && selectedTag && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-sm w-full">
            <p className="mb-4 text-gray-800 dark:text-gray-200">
              Confirmer l'enregistrement de cette appréciation avec le tag <strong>{selectedLabel}</strong> ?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 dark:text-gray-300"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded-md bg-blue-600 text-white"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
