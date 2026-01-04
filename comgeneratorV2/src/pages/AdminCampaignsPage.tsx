// src/pages/AdminCampaignsPage.tsx
// Page d'administration pour gérer les campagnes promotionnelles

import React, { useState, useEffect } from 'react';
import {
  Gift,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
  Calendar,
  Coins,
  Users,
  ToggleLeft,
  ToggleRight,
  Info
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { checkIsAdmin } from '../lib/ragApi';
import {
  getAllCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleCampaignStatus,
  getCampaignStatus,
  formatDate,
  PromoCampaign
} from '../lib/promoApi';

interface CampaignFormData {
  code: string;
  description: string;
  tokens_amount: number;
  max_redemptions: number | null;
  expires_at: string;
  has_max_redemptions: boolean;
}

const initialFormData: CampaignFormData = {
  code: '',
  description: '',
  tokens_amount: 10000,
  max_redemptions: null,
  expires_at: '',
  has_max_redemptions: false,
};

export function AdminCampaignsPage() {
  const { user } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<PromoCampaign[]>([]);
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<PromoCampaign | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Vérifier si l'utilisateur est admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsLoading(true);
      const adminStatus = await checkIsAdmin();
      setIsAdmin(adminStatus);
      if (adminStatus) {
        await loadCampaigns();
      }
      setIsLoading(false);
    };
    checkAdminStatus();
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await getAllCampaigns();
      setCampaigns(data);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleOpenModal = (campaign?: PromoCampaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData({
        code: campaign.code,
        description: campaign.description,
        tokens_amount: campaign.tokens_amount,
        max_redemptions: campaign.max_redemptions,
        expires_at: campaign.expires_at.slice(0, 16), // Format pour datetime-local
        has_max_redemptions: campaign.max_redemptions !== null,
      });
    } else {
      setEditingCampaign(null);
      // Date par défaut : dans 30 jours
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setFormData({
        ...initialFormData,
        expires_at: defaultDate.toISOString().slice(0, 16),
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCampaign(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const campaignData = {
        code: formData.code.trim(),
        description: formData.description.trim(),
        tokens_amount: formData.tokens_amount,
        max_redemptions: formData.has_max_redemptions ? formData.max_redemptions : null,
        expires_at: new Date(formData.expires_at).toISOString(),
      };

      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, campaignData);
        setMessage({ type: 'success', text: 'Campagne mise à jour avec succès' });
      } else {
        await createCampaign(campaignData);
        setMessage({ type: 'success', text: 'Campagne créée avec succès' });
      }

      await loadCampaigns();
      handleCloseModal();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (campaign: PromoCampaign) => {
    try {
      await toggleCampaignStatus(campaign.id, !campaign.is_active);
      await loadCampaigns();
      setMessage({
        type: 'success',
        text: `Campagne ${campaign.is_active ? 'désactivée' : 'activée'} avec succès`,
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCampaign(id);
      await loadCampaigns();
      setDeleteConfirm(null);
      setMessage({ type: 'success', text: 'Campagne supprimée avec succès' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const getStatusBadge = (campaign: PromoCampaign) => {
    const status = getCampaignStatus(campaign);
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Expirée
          </span>
        );
      case 'maxed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Users className="w-3 h-3 mr-1" />
            Quota atteint
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
            <ToggleLeft className="w-3 h-3 mr-1" />
            Inactive
          </span>
        );
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Accès refusé
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Accès refusé</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Cette page est réservée aux administrateurs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center mr-4">
                <Gift className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Campagnes promotionnelles</h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Gérez vos codes promo et offres de tokens
                </p>
              </div>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouvelle campagne
            </button>
          </div>
          
          {/* Info box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-blue-800 dark:text-blue-300 text-sm">
                Les codes promo sont <strong>sensibles à la casse</strong>. Un utilisateur ne peut utiliser 
                un même code qu'une seule fois. Les tokens sont ajoutés automatiquement à son compte.
              </p>
            </div>
          </div>
        </div>

        {/* Message de feedback */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            {message.type === 'success' 
              ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3" />
              : <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" />
            }
            <span className={message.type === 'success' 
              ? 'text-green-800 dark:text-green-300' 
              : 'text-red-800 dark:text-red-300'
            }>
              {message.text}
            </span>
            <button
              onClick={() => setMessage(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Liste des campagnes */}
        {campaigns.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
            <Gift className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Aucune campagne
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Créez votre première campagne promotionnelle pour offrir des tokens à vos utilisateurs.
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Créer une campagne
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tokens
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Utilisations
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Expire le
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-900 dark:text-white">
                          {campaign.code}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900 dark:text-white line-clamp-2">
                          {campaign.description}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900 dark:text-white">
                          <Coins className="w-4 h-4 text-yellow-500 mr-1" />
                          {campaign.tokens_amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900 dark:text-white">
                          <Users className="w-4 h-4 text-blue-500 mr-1" />
                          {campaign.current_redemptions}
                          {campaign.max_redemptions !== null && (
                            <span className="text-gray-500 dark:text-gray-400">
                              /{campaign.max_redemptions}
                            </span>
                          )}
                          {campaign.max_redemptions === null && (
                            <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                              (illimité)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900 dark:text-white">
                          <Calendar className="w-4 h-4 text-gray-400 mr-1" />
                          {formatDate(campaign.expires_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(campaign)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Toggle actif/inactif */}
                          <button
                            onClick={() => handleToggleStatus(campaign)}
                            className={`p-2 rounded-lg transition-colors ${
                              campaign.is_active
                                ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            title={campaign.is_active ? 'Désactiver' : 'Activer'}
                          >
                            {campaign.is_active ? (
                              <ToggleRight className="w-5 h-5" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                          
                          {/* Modifier */}
                          <button
                            onClick={() => handleOpenModal(campaign)}
                            className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          
                          {/* Supprimer */}
                          <button
                            onClick={() => setDeleteConfirm(campaign.id)}
                            className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal de création/édition */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mr-3">
                      <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {editingCampaign ? 'Modifier la campagne' : 'Nouvelle campagne'}
                    </h3>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Code promo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Code promo *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="Ex: NOEL2025"
                      required
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono uppercase"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Le code sera automatiquement en majuscules. Sensible à la casse.
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Ex: Offre spéciale fêtes de fin d'année"
                      required
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Nombre de tokens */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tokens à offrir *
                    </label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-yellow-500" />
                      <input
                        type="number"
                        value={formData.tokens_amount}
                        onChange={(e) => setFormData({ ...formData, tokens_amount: parseInt(e.target.value) || 0 })}
                        min={1}
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Limite d'utilisations */}
                  <div>
                    <label className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={formData.has_max_redemptions}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          has_max_redemptions: e.target.checked,
                          max_redemptions: e.target.checked ? 100 : null
                        })}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Limiter le nombre d'utilisations
                      </span>
                    </label>
                    
                    {formData.has_max_redemptions && (
                      <div className="relative mt-2">
                        <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-500" />
                        <input
                          type="number"
                          value={formData.max_redemptions || ''}
                          onChange={(e) => setFormData({ ...formData, max_redemptions: parseInt(e.target.value) || null })}
                          min={1}
                          placeholder="Nombre max d'utilisations"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Date d'expiration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date d'expiration *
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="datetime-local"
                        value={formData.expires_at}
                        onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Boutons */}
                  <div className="flex space-x-4 pt-4">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                      disabled={isSubmitting}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          {editingCampaign ? 'Mettre à jour' : 'Créer la campagne'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmation de suppression */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mr-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Supprimer la campagne ?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Cette action est irréversible
                  </p>
                </div>
              </div>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Êtes-vous sûr de vouloir supprimer cette campagne ? 
                Toutes les données d'utilisation associées seront également supprimées.
              </p>

              <div className="flex space-x-4">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
