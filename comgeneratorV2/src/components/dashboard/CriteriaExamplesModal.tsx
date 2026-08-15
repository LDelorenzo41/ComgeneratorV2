import React from 'react';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { X, Lightbulb, Info } from 'lucide-react';

interface CriteriaExamplesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CriteriaExamplesModal({ isOpen, onClose }: CriteriaExamplesModalProps) {
  // Avant le retour anticipé : l'ordre des hooks doit rester constant.
  const dialogRef = useModalBehavior({ isOpen, onClose });

  if (!isOpen) return null;

  const examples = [
    {
      icon: '📊',
      title: 'Niveau et performances',
      items: [
        'Niveau général',
        'Résultats',
        'Maîtrise des attendus',
        'Réussite aux évaluations',
        'Progrès réalisés',
        'Stabilité des performances',
        'Niveau d\'acquisition des compétences'
      ]
    },
    {
      icon: '🧠',
      title: 'Compétences travaillées',
      items: [
        'Compétences disciplinaires',
        'Compétences méthodologiques',
        'Mobilisation des acquis',
        'Transfert des connaissances',
        'Capacité à réinvestir',
        'Adaptation aux situations proposées'
      ]
    },
    {
      icon: '👀',
      title: 'Attitude et posture en classe',
      items: [
        'Attitude générale',
        'Attention',
        'Concentration',
        'Comportement',
        'Respect du cadre',
        'Écoute',
        'Implication en classe',
        'Posture d\'élève'
      ]
    },
    {
      icon: '✅',
      title: 'Compréhension et application des consignes',
      items: [
        'Compréhension des consignes',
        'Application des consignes',
        'Précision dans l\'exécution',
        'Respect des consignes',
        'Capacité à demander des précisions',
        'Autonomie face aux consignes'
      ]
    },
    {
      icon: '🔥',
      title: 'Participation et investissement',
      items: [
        'Participation',
        'Investissement',
        'Engagement',
        'Implication personnelle',
        'Régularité dans l\'effort',
        'Motivation',
        'Dynamisme'
      ]
    },
    {
      icon: '🗣️',
      title: 'Expression orale',
      items: [
        'Participation orale',
        'Qualité de l\'oral',
        'Clarté du propos',
        'Fluidité',
        'Pertinence des interventions',
        'Argumentation',
        'Prise de parole'
      ]
    },
    {
      icon: '✍️',
      title: 'Expression écrite',
      items: [
        'Qualité des productions écrites',
        'Application',
        'Graphie',
        'Lisibilité',
        'Organisation des idées',
        'Structuration du texte',
        'Richesse du vocabulaire'
      ]
    },
    {
      icon: '📚',
      title: 'Maîtrise de la langue',
      items: [
        'Orthographe',
        'Conjugaison',
        'Grammaire',
        'Syntaxe',
        'Vocabulaire',
        'Respect des règles linguistiques'
      ]
    },
    {
      icon: '🔢',
      title: 'Compétences numériques',
      items: [
        'Calcul mental',
        'Exactitude des calculs',
        'Rapidité',
        'Raisonnement logique',
        'Résolution de problèmes',
        'Utilisation des outils mathématiques'
      ]
    },
    {
      icon: '🧩',
      title: 'Méthodologie et organisation',
      items: [
        'Organisation du travail',
        'Gestion du temps',
        'Méthode de travail',
        'Rigueur',
        'Planification',
        'Capacité à structurer son travail'
      ]
    },
    {
      icon: '🤝',
      title: 'Travail collectif et savoir-être',
      items: [
        'Travail en groupe',
        'Coopération',
        'Respect des autres',
        'Esprit d\'équipe',
        'Communication avec les pairs',
        'Aide apportée aux camarades'
      ]
    },
    {
      icon: '🚀',
      title: 'Implication personnelle et posture d\'apprentissage',
      items: [
        'Autonomie',
        'Initiative',
        'Persévérance',
        'Curiosité',
        'Volonté de progresser',
        'Capacité à se remettre en question'
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="criteria-examples-title"
          tabIndex={-1}
          className="inline-block transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Lightbulb className="w-6 h-6 text-white" />
                </div>
                <h3 id="criteria-examples-title" className="text-2xl font-bold text-white">
                  Quelques exemples de critères
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg text-white/80 hover:text-white hover:bg-white/10 p-2 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Info box */}
          <div className="px-6 pt-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-2">💡 Conseils d'utilisation :</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Ces exemples sont des suggestions, adaptez-les à vos besoins</li>
                    <li>N'hésitez pas à créer des critères que vous sélectionnerez ou non selon l'élève (case "NE - Non évalué")</li>
                    <li><strong>Recommandé :</strong> Ne validez pas plus de 4 à 5 critères max pour générer une appréciation</li>
                    <li>N'hésitez pas à tester différentes configurations</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {examples.map((category, idx) => (
                <div 
                  key={idx}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600"
                >
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <span className="text-xl">{category.icon}</span>
                    {category.title}
                  </h4>
                  <ul className="space-y-1.5">
                    {category.items.map((item, itemIdx) => (
                      <li 
                        key={itemIdx}
                        className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"
                      >
                        <span className="text-blue-500 mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}