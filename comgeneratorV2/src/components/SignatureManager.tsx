import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, Save, X, Star } from 'lucide-react';

interface Signature {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
}

interface SignatureManagerProps {
  onSignatureChange?: () => void;
}

export function SignatureManager({ onSignatureChange }: SignatureManagerProps) {
  const { user } = useAuthStore();
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', content: '', is_default: false });
  const [isLoading, setIsLoading] = useState(false);

  // Récupération des signatures
  const fetchSignatures = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('signatures')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setSignatures(data || []);
      onSignatureChange?.();
    } catch (error) {
      console.error('Erreur lors de la récupération des signatures:', error);
    }
  };

  useEffect(() => {
    fetchSignatures();
  }, [user]);

  // Création d'une nouvelle signature
  const handleCreate = async () => {
    if (!user || !editForm.name.trim() || !editForm.content.trim()) return;

    setIsLoading(true);
    try {
      // Si c'est marqué comme par défaut, on retire le défaut des autres
      if (editForm.is_default) {
        await supabase
          .from('signatures')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { error } = await supabase
        .from('signatures')
        .insert({
          user_id: user.id,
          name: editForm.name.trim(),
          content: editForm.content.trim(),
          is_default: editForm.is_default
        });

      if (error) throw error;

      setEditForm({ name: '', content: '', is_default: false });
      setIsCreating(false);
      await fetchSignatures();
    } catch (error) {
      console.error('Erreur lors de la création:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Modification d'une signature
  const handleUpdate = async (id: string) => {
    if (!user || !editForm.name.trim() || !editForm.content.trim()) return;

    setIsLoading(true);
    try {
      // Si c'est marqué comme par défaut, on retire le défaut des autres
      if (editForm.is_default) {
        await supabase
          .from('signatures')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', id);
      }

      const { error } = await supabase
        .from('signatures')
        .update({
          name: editForm.name.trim(),
          content: editForm.content.trim(),
          is_default: editForm.is_default
        })
        .eq('id', id);

      if (error) throw error;

      setIsEditing(null);
      setEditForm({ name: '', content: '', is_default: false });
      await fetchSignatures();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Suppression d'une signature
  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette signature ?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('signatures')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchSignatures();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Définir comme signature par défaut
  const setAsDefault = async (id: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Retirer le défaut de toutes les signatures
      await supabase
        .from('signatures')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Définir la nouvelle signature par défaut
      const { error } = await supabase
        .from('signatures')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      await fetchSignatures();
    } catch (error) {
      console.error('Erreur lors de la définition par défaut:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (signature: Signature) => {
    setEditForm({
      name: signature.name,
      content: signature.content,
      is_default: signature.is_default
    });
    setIsEditing(signature.id);
  };

  const startCreate = () => {
    setEditForm({ name: '', content: '', is_default: false });
    setIsCreating(true);
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setIsCreating(false);
    setEditForm({ name: '', content: '', is_default: false });
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Gestion des signatures
        </h3>
        <button
          onClick={startCreate}
          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isCreating || isLoading}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle signature
        </button>
      </div>

      {/* Formulaire de création */}
      {isCreating && (
        <div className="mb-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom de la signature
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                placeholder="Ex: Signature professionnelle"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contenu
              </label>
              <textarea
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                placeholder="Cordialement,&#10;[Votre nom]&#10;[Votre fonction]"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is-default-create"
                checked={editForm.is_default}
                onChange={(e) => setEditForm({ ...editForm, is_default: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is-default-create" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Définir comme signature par défaut
              </label>
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={cancelEdit}
              className="px-3 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-1 inline" />
              Annuler
            </button>
            <button
              onClick={handleCreate}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading || !editForm.name.trim() || !editForm.content.trim()}
            >
              <Save className="h-4 w-4 mr-1 inline" />
              Créer
            </button>
          </div>
        </div>
      )}

      {/* Liste des signatures */}
      <div className="space-y-4">
        {signatures.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Aucune signature créée. Créez votre première signature pour l'utiliser dans vos communications.
          </p>
        ) : (
          signatures.map((signature) => (
            <div
              key={signature.id}
              className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
            >
              {isEditing === signature.id ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nom de la signature
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contenu
                    </label>
                    <textarea
                      value={editForm.content}
                      onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`is-default-${signature.id}`}
                      checked={editForm.is_default}
                      onChange={(e) => setEditForm({ ...editForm, is_default: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`is-default-${signature.id}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Définir comme signature par défaut
                    </label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4 mr-1 inline" />
                      Annuler
                    </button>
                    <button
                      onClick={() => handleUpdate(signature.id)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoading || !editForm.name.trim() || !editForm.content.trim()}
                    >
                      <Save className="h-4 w-4 mr-1 inline" />
                      Sauvegarder
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {signature.name}
                      </h4>
                      {signature.is_default && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          <Star className="h-3 w-3 mr-1" />
                          Par défaut
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      {!signature.is_default && (
                        <button
                          onClick={() => setAsDefault(signature.id)}
                          className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                          title="Définir comme par défaut"
                          disabled={isLoading}
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(signature)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Modifier"
                        disabled={isLoading}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(signature.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Supprimer"
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                      {signature.content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}