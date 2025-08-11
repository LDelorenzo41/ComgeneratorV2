import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';

export interface Signature {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useSignatures() {
  const { user } = useAuthStore();
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Récupération des signatures
  const fetchSignatures = useCallback(async () => {
    if (!user) {
      setSignatures([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('signatures')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setSignatures(data || []);
    } catch (err) {
      console.error('Erreur lors de la récupération des signatures:', err);
      setError('Erreur lors de la récupération des signatures');
      setSignatures([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Obtenir la signature par défaut
  const getDefaultSignature = useCallback((): Signature | null => {
    return signatures.find(sig => sig.is_default) || null;
  }, [signatures]);

  // Obtenir une signature par ID
  const getSignatureById = useCallback((id: string): Signature | null => {
    return signatures.find(sig => sig.id === id) || null;
  }, [signatures]);

  // Créer une nouvelle signature
  const createSignature = useCallback(async (
    name: string, 
    content: string, 
    isDefault: boolean = false
  ): Promise<boolean> => {
    if (!user || !name.trim() || !content.trim()) return false;

    setIsLoading(true);
    setError(null);

    try {
      // Si c'est marqué comme par défaut, on retire le défaut des autres
      if (isDefault) {
        await supabase
          .from('signatures')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { error } = await supabase
        .from('signatures')
        .insert({
          user_id: user.id,
          name: name.trim(),
          content: content.trim(),
          is_default: isDefault
        });

      if (error) throw error;

      await fetchSignatures();
      return true;
    } catch (err) {
      console.error('Erreur lors de la création:', err);
      setError('Erreur lors de la création de la signature');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchSignatures]);

  // Mettre à jour une signature
  const updateSignature = useCallback(async (
    id: string,
    name: string,
    content: string,
    isDefault: boolean = false
  ): Promise<boolean> => {
    if (!user || !name.trim() || !content.trim()) return false;

    setIsLoading(true);
    setError(null);

    try {
      // Si c'est marqué comme par défaut, on retire le défaut des autres
      if (isDefault) {
        await supabase
          .from('signatures')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', id);
      }

      const { error } = await supabase
        .from('signatures')
        .update({
          name: name.trim(),
          content: content.trim(),
          is_default: isDefault
        })
        .eq('id', id);

      if (error) throw error;

      await fetchSignatures();
      return true;
    } catch (err) {
      console.error('Erreur lors de la modification:', err);
      setError('Erreur lors de la modification de la signature');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchSignatures]);

  // Supprimer une signature
  const deleteSignature = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('signatures')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchSignatures();
      return true;
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression de la signature');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchSignatures]);

  // Définir une signature comme par défaut
  const setAsDefault = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    setError(null);

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
      return true;
    } catch (err) {
      console.error('Erreur lors de la définition par défaut:', err);
      setError('Erreur lors de la définition de la signature par défaut');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchSignatures]);

  // Charger les signatures au montage du composant
  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  return {
    signatures,
    isLoading,
    error,
    fetchSignatures,
    getDefaultSignature,
    getSignatureById,
    createSignature,
    updateSignature,
    deleteSignature,
    setAsDefault
  };
}