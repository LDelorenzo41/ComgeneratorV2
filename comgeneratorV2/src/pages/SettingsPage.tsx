// src/pages/SettingsPage.tsx
import React, { useState } from 'react';
import { Settings, User, Shield, AlertTriangle, Trash2 } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';

export function SettingsPage() {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, signOut } = useAuthStore();

  const handleDeleteAccount = async () => {
    if (!user || confirmText !== 'SUPPRIMER') {
      setError('Veuillez taper "SUPPRIMER" pour confirmer');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Appeler la fonction SQL que nous avons créée
      const { error: deleteError } = await supabase.rpc('delete_user_account');
      
      if (deleteError) {
        throw deleteError;
      }

      // Déconnexion et redirection
      await signOut();
      
      // Message de confirmation et redirection
      alert('Votre compte a été supprimé avec succès.');
      window.location.href = '/';
      
    } catch (error: any) {
      console.error('Erreur lors de la suppression du compte:', error);
      setError('Une erreur est survenue lors de la suppression. Contactez le support.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mr-4">
              <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Paramètres du compte</h1>
              <p className="text-gray-600 dark:text-gray-300">Gérez votre compte ProfAssist</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          
          {/* Informations du compte */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mr-4">
                <User className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Informations du compte</h3>
                <p className="text-gray-600 dark:text-gray-300">Détails de votre compte ProfAssist</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Email</h4>
                <p className="text-gray-700 dark:text-gray-300">{user.email}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Compte créé le</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  {new Date(user.created_at).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Sécurité et confidentialité */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mr-4">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Sécurité et confidentialité</h3>
                <p className="text-gray-600 dark:text-gray-300">Vos droits et la protection de vos données</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-medium text-green-800 dark:text-green-400 mb-2">🔒 Données protégées</h4>
                <p className="text-green-700 dark:text-green-300 text-sm">
                  Vos données sont chiffrées et hébergées sur des serveurs sécurisés conformes au RGPD.
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-400 mb-2">📋 Vos droits</h4>
                <p className="text-blue-700 dark:text-blue-300 text-sm">
                  Accès, rectification, portabilité et suppression de vos données personnelles.
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                💡 Pour exercer vos droits RGPD ou toute question sur vos données, contactez-nous à{' '}
                <a href="mailto:contact-profassist@teachtech.fr" className="text-blue-600 dark:text-blue-400 hover:underline">
                  contact-profassist@teachtech.fr
                </a>
              </p>
            </div>
          </div>

          {/* Zone dangereuse - Suppression de compte */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mr-4">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Zone dangereuse</h3>
                <p className="text-gray-600 dark:text-gray-300">Actions irréversibles sur votre compte</p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-4 flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Supprimer définitivement mon compte
              </h4>
              
              <div className="space-y-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-2">⚠️ Cette action supprimera :</h5>
                  <ul className="text-gray-700 dark:text-gray-300 space-y-1 text-sm">
                    <li>• Votre compte et toutes vos informations personnelles</li>
                    <li>• Tous vos tokens restants (aucun remboursement)</li>
                    <li>• Toutes vos appréciations générées</li>
                    <li>• Vos communications et synthèses sauvegardées</li>
                    <li>• Vos séances pédagogiques archivées</li>
                    <li>• Votre historique d'utilisation</li>
                  </ul>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h5 className="font-medium text-amber-800 dark:text-amber-400 mb-2">📋 Avant de supprimer :</h5>
                  <ul className="text-amber-700 dark:text-amber-300 space-y-1 text-sm">
                    <li>• Sauvegardez vos contenus importants</li>
                    <li>• Cette action est définitive et irréversible</li>
                    <li>• Vous ne pourrez pas récupérer vos données</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => setIsConfirmModalOpen(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer définitivement mon compte
              </button>
            </div>
          </div>
        </div>

        {/* Modal de confirmation */}
        {isConfirmModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mr-4">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirmer la suppression</h3>
                  <p className="text-gray-600 dark:text-gray-300">Cette action est irréversible</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-800 dark:text-red-400 text-sm font-medium mb-2">
                    ⚠️ Vous êtes sur le point de supprimer définitivement votre compte ProfAssist.
                  </p>
                  <p className="text-red-700 dark:text-red-300 text-sm">
                    Toutes vos données seront perdues et vous ne pourrez pas les récupérer.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pour confirmer, tapez <strong>"SUPPRIMER"</strong> dans le champ ci-dessous :
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => {
                      setConfirmText(e.target.value);
                      setError(null);
                    }}
                    placeholder="Tapez SUPPRIMER"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {error && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-2">{error}</p>
                  )}
                </div>
              </div>

              <div className="flex space-x-4 mt-6">
                <button
                  onClick={() => {
                    setIsConfirmModalOpen(false);
                    setConfirmText('');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  disabled={isDeleting}
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== 'SUPPRIMER' || isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}