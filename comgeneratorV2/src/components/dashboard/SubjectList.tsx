import React from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { Plus, Book, Trash2, AlertCircle } from 'lucide-react';
import { SubjectModal } from './SubjectModal';

interface Subject {
  id: string;
  name: string;
  criteria: Array<{
    id: string;
    name: string;
    importance: number;
  }>;
}

export const subjectUpdateEvent = new EventTarget();
export const SUBJECT_UPDATED = 'subjectUpdated';

export function SubjectList() {
  const { user } = useAuthStore();
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedSubject, setSelectedSubject] = React.useState<Subject | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);

  const fetchSubjects = React.useCallback(async () => {

    if (!user) {
      setLoading(false);
      setError("Vous devez être connecté pour accéder à vos matières");
      return;
    }
    
    setError(null);
    try {
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select(`
          id,
          name,
          criteria (
            id,
            name,
            importance
          )
        `)
        .eq('user_id', user.id);

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);
    } catch (error: any) {
      console.error('Erreur lors de la récupération des matières:', error);
      setError("Une erreur est survenue lors de la récupération des matières");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  React.useEffect(() => {
    const handleSubjectUpdate = () => {
      fetchSubjects();
    };

    subjectUpdateEvent.addEventListener(SUBJECT_UPDATED, handleSubjectUpdate);
    return () => {
      subjectUpdateEvent.removeEventListener(SUBJECT_UPDATED, handleSubjectUpdate);
    };
  }, [fetchSubjects]);

  const handleAddSubject = async (data: { name: string; criteria: Array<{ name: string; importance: number }> }) => {

    if (!user) {
      setError("Vous devez être connecté pour ajouter une matière");
      return;
    }

    setError(null);
    try {
      if (selectedSubject) {
        const { error: updateError } = await supabase
          .from('subjects')
          .update({
            name: data.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedSubject.id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        // Mettre à jour les critères
        const { error: deleteCriteriaError } = await supabase
          .from('criteria')
          .delete()
          .eq('subject_id', selectedSubject.id);

        if (deleteCriteriaError) throw deleteCriteriaError;

        const { error: insertCriteriaError } = await supabase
          .from('criteria')
          .insert(
            data.criteria.map(criterion => ({
              subject_id: selectedSubject.id,
              name: criterion.name,
              importance: criterion.importance
            }))
          );

        if (insertCriteriaError) throw insertCriteriaError;
      } else {
        const { data: newSubject, error: insertError } = await supabase
          .from('subjects')
          .insert({
            user_id: user.id,
            name: data.name
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const { error: criteriaError } = await supabase
          .from('criteria')
          .insert(
            data.criteria.map(criterion => ({
              subject_id: newSubject.id,
              name: criterion.name,
              importance: criterion.importance
            }))
          );

        if (criteriaError) throw criteriaError;
      }

      await fetchSubjects();
      handleCloseModal();
      subjectUpdateEvent.dispatchEvent(new CustomEvent(SUBJECT_UPDATED));
    } catch (error: any) {
      console.error('Erreur lors de l\'opération sur la matière:', error);
      setError("Une erreur est survenue lors de l'opération");
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSubject(null);
    setError(null);
  };

  const handleDeleteSubject = async (subjectId: string) => {

    if (!user) {
      setError("Vous devez être connecté pour supprimer une matière");
      return;
    }

    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      await fetchSubjects();
      setShowDeleteConfirm(null);
      subjectUpdateEvent.dispatchEvent(new CustomEvent(SUBJECT_UPDATED));
    } catch (error: any) {
      console.error('Erreur lors de la suppression de la matière:', error);
      setError("Une erreur est survenue lors de la suppression");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mes matières</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Ajouter une matière
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center">
          <Book className="mx-auto h-12 w-12 text-gray-400 animate-pulse" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Chargement...</h3>
        </div>
      ) : subjects.length === 0 && !error ? (
        <div className="text-center">
          <Book className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Aucune matière</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Commencez par ajouter une matière pour générer des appréciations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700"
            >
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{subject.name}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {subject.criteria.length} critères définis
                </p>
              </div>
              <div className="px-4 py-4 sm:px-6 flex justify-between items-center">
                <button 
                  onClick={() => handleEditSubject(subject)}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
                >
                  Modifier les critères
                </button>
                {showDeleteConfirm === subject.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteSubject(subject.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-500"
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="text-sm font-medium text-gray-600 hover:text-gray-500"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(subject.id)}
                    className="text-gray-500 hover:text-red-600 transition-colors"
                    title="Supprimer la matière"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <SubjectModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSubmit={handleAddSubject}
        initialData={selectedSubject ? {
          name: selectedSubject.name,
          criteria: selectedSubject.criteria
        } : undefined}
        mode={selectedSubject ? 'edit' : 'create'}
      />
    </div>
  );
}