import React, { useEffect } from 'react';
import { useFeedbackStore } from '../../lib/feedbackStore';
import { useAuthStore } from '../../lib/store';
import { User, Mail, BookOpen, GraduationCap, Clock, Coins, Gift } from 'lucide-react';

export function FeedbackProfileSection() {
  const { profile, setProfile } = useFeedbackStore();
  const { user } = useAuthStore();

  // Pré-remplir l'email avec celui du compte connecté (uniquement si le champ est vide)
  useEffect(() => {
    if (user?.email && !profile.tester_email) {
      setProfile({ tester_email: user.email });
    }
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Votre profil</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Les champs marqués d'un <span className="text-red-500">*</span> sont obligatoires.
        </p>
      </div>

      {/* Bandeau récompense */}
      <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <Gift className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
            Merci pour votre aide !
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-0.5">
            En remerciement, <strong>30 000 tokens gratuits</strong> seront automatiquement crédités sur votre compte à l'envoi du questionnaire.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nom */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <User className="w-4 h-4" /> Votre nom <span className="text-gray-400 text-xs">(optionnel)</span>
          </label>
          <input
            type="text"
            value={profile.tester_name}
            onChange={(e) => setProfile({ tester_name: e.target.value })}
            placeholder="Prénom Nom"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Email */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Mail className="w-4 h-4" /> Votre email <span className="text-red-500 text-xs">*</span>
          </label>
          <input
            type="email"
            required
            value={profile.tester_email}
            onChange={(e) => setProfile({ tester_email: e.target.value })}
            placeholder="exemple@email.com"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Utilisez l'email de votre compte ProfAssist pour recevoir vos tokens de récompense.
          </p>
        </div>

        {/* Matière */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <BookOpen className="w-4 h-4" /> Matière enseignée <span className="text-red-500 text-xs">*</span>
          </label>
          <input
            type="text"
            value={profile.matiere}
            onChange={(e) => setProfile({ matiere: e.target.value })}
            placeholder="Ex : Mathématiques, Français, SVT..."
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Niveau */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <GraduationCap className="w-4 h-4" /> Niveau d'enseignement <span className="text-red-500 text-xs">*</span>
          </label>
          <select
            value={profile.niveau}
            onChange={(e) => setProfile({ niveau: e.target.value })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Sélectionnez...</option>
            <option value="maternelle">Maternelle</option>
            <option value="elementaire">Élémentaire</option>
            <option value="college">Collège</option>
            <option value="lycee">Lycée</option>
            <option value="superieur">Supérieur</option>
            <option value="autre">Autre</option>
          </select>
        </div>

        {/* Ancienneté */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Clock className="w-4 h-4" /> Années d'expérience <span className="text-red-500 text-xs">*</span>
          </label>
          <input
            type="number"
            min={0}
            max={50}
            value={profile.anciennete ?? ''}
            onChange={(e) => setProfile({ anciennete: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="Ex : 5"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Section Tokens */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <h3 className="flex items-center gap-1.5 text-md font-semibold text-gray-800 dark:text-white mb-3">
          <Coins className="w-5 h-5 text-yellow-500" /> À propos des tokens
        </h3>

        <div className="space-y-4">
          {/* A acheté */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Avez-vous déjà acheté une recharge de tokens ?
            </label>
            <div className="flex gap-4">
              {[
                { value: true, label: 'Oui' },
                { value: false, label: 'Non' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setProfile({ a_achete_tokens: opt.value })}
                  className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                    profile.a_achete_tokens === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prévoit d'acheter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Prévoyez-vous d'en acheter ?
            </label>
            <div className="flex gap-3">
              {['Oui', 'Non', 'Peut-être'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setProfile({ prevoit_acheter: opt })}
                  className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                    profile.prevoit_acheter === opt
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Raison */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pourquoi ?
            </label>
            <textarea
              value={profile.raison_achat}
              onChange={(e) => setProfile({ raison_achat: e.target.value })}
              placeholder="Qu'est-ce qui motive votre choix ? (prix, utilité, fréquence d'utilisation...)"
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
