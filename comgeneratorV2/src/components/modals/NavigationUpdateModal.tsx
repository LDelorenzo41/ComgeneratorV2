import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Layers, 
  CheckSquare, 
  MessageSquare, 
  TrendingUp,
  Bot,
  Map,
  Sparkles,
  ArrowRight,
  BookOpen,
  Copy
} from 'lucide-react';

const MODAL_STORAGE_KEY = 'profassist_nav_update_v2_seen';

export function NavigationUpdateModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Vérifier si l'utilisateur a déjà vu cette modale
    const hasSeen = localStorage.getItem(MODAL_STORAGE_KEY);
    if (!hasSeen) {
      // Petit délai pour laisser l'app se charger
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(MODAL_STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
        
        {/* Header avec gradient */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-8 text-white">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <RefreshCw className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                ProfAssist évolue
              </h2>
              <p className="text-blue-100">
                Une navigation plus claire, pensée pour votre métier
              </p>
            </div>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          
          {/* Introduction */}
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Pour mieux vous accompagner au quotidien, nous avons fait évoluer l'organisation du menu de ProfAssist.
          </p>

          {/* Pourquoi ce changement */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-2">
              <span className="text-lg">👉</span> Pourquoi ce changement ?
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              Parce qu'un enseignant ne travaille pas par "fonctionnalités", mais par <strong>moments clés de son métier</strong>.
            </p>
          </div>

          {/* Logique métier */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <span className="text-lg">🎯</span> Une logique métier plus naturelle
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Le menu est désormais structuré autour de 4 grands usages :
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Concevoir */}
              <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <div className="p-2 bg-indigo-500 rounded-lg flex-shrink-0">
                  <Layers className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-indigo-800 dark:text-indigo-300 text-sm">Concevoir</h4>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">
                    Préparer ses cours, ses séances et ses progressions.
                  </p>
                </div>
              </div>

              {/* Évaluer */}
              <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                <div className="p-2 bg-amber-500 rounded-lg flex-shrink-0">
                  <CheckSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Évaluer</h4>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Travailler les appréciations, bilans et synthèses de fin de période.
                  </p>
                </div>
              </div>

              {/* Communiquer */}
              <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-100 dark:border-green-800">
                <div className="p-2 bg-green-500 rounded-lg flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-800 dark:text-green-300 text-sm">Communiquer</h4>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Créer ou répondre rapidement à des messages professionnels.
                  </p>
                </div>
              </div>

              {/* Ressources */}
              <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                <div className="p-2 bg-purple-500 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-purple-800 dark:text-purple-300 text-sm">Ressources</h4>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    Accéder à une veille pédagogique utile et ciblée.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-sm mt-4">
              Cette nouvelle organisation rend la navigation plus fluide, plus intuitive et plus cohérente avec votre pratique.
            </p>
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200 dark:border-gray-700"></div>

          {/* Ce n'est que le début */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <span className="text-lg">🚀</span> Et ce n'est que le début
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Cette évolution nous permet aussi d'intégrer naturellement de nouvelles fonctionnalités :
            </p>

            <div className="space-y-3">
              {/* Chatbot */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-xl border border-blue-200 dark:border-blue-700">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                    Votre chatbot pédagogique personnalisé
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">Bêta</span>
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Connecté aux ressources officielles
                  </p>
                </div>
              </div>

              {/* Scénarios */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 rounded-xl border border-amber-200 dark:border-amber-700">
                <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                  <Map className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                    Création de scénarios pédagogiques
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full">Nouveau</span>
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Concevez vos séquences de manière structurée
                  </p>
                </div>
              </div>

              {/* Génération de supports et exercices */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 rounded-xl border border-purple-200 dark:border-purple-700">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                    Génération de supports et exercices
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full">Nouveau</span>
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Créez QCM, textes à trous, fiches élèves et plus pour chaque phase de vos séances
                  </p>
                </div>
              </div>

              {/* Copie du thème vers séance */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20 rounded-xl border border-green-200 dark:border-green-700">
                <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                  <Copy className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                    Copie du thème vers une séance
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full">Nouveau</span>
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Copiez le thème d'une séance depuis votre banque de scénarios pour lancer la génération en un clic
                  </p>
                </div>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-sm mt-4 italic">
              Des outils pensés pour vous faire gagner du temps, tout en restant fidèles aux exigences du métier.
            </p>
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200 dark:border-gray-700"></div>

          {/* Merci */}
          <div className="text-center">
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              Merci pour votre confiance et vos retours :
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              ProfAssist évolue <strong>avec vous</strong>, <strong>pour vous</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
          >
            <Sparkles className="w-5 h-5" />
            Découvrir la nouvelle navigation
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default NavigationUpdateModal;
