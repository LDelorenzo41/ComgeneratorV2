import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Minus } from 'lucide-react';

const subjectSchema = z.object({
  name: z.string().min(1, 'Le nom de la matière est requis'),
  criteria: z.array(z.object({
    name: z.string().min(1, 'Le nom du critère est requis'),
    importance: z.number().min(1).max(3)
  })).min(1, 'Au moins un critère est requis')
});

type SubjectFormData = z.infer<typeof subjectSchema>;

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SubjectFormData) => void;
  initialData?: {
    name: string;
    criteria: Array<{ name: string; importance: number }>;
  };
  mode?: 'create' | 'edit';
}

export function SubjectModal({ isOpen, onClose, onSubmit, initialData, mode = 'create' }: SubjectModalProps) {
  const { register, control, handleSubmit, formState: { errors }, reset } = useForm<SubjectFormData>({
    resolver: zodResolver(subjectSchema),
    defaultValues: initialData || {
      name: '',
      criteria: [{ name: '', importance: 1 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'criteria'
  });

  React.useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Nom de la matière
              </label>
              <input
                type="text"
                {...register('name')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Critères d'évaluation
                </label>
                <button
                  type="button"
                  onClick={() => append({ name: '', importance: 1 })}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 dark:text-blue-400 hover:text-blue-500"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-4">
                  <div className="flex-1">
                    <input
                      {...register(`criteria.${index}.name`)}
                      placeholder="Nom du critère"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    {errors.criteria?.[index]?.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.criteria[index]?.name?.message}</p>
                    )}
                  </div>
                  <div className="w-32">
                    <select
                      {...register(`criteria.${index}.importance`, { valueAsNumber: true })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value={1}>Normal</option>
                      <option value={2}>Important</option>
                      <option value={3}>Crucial</option>
                    </select>
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="inline-flex items-center text-red-600 hover:text-red-500"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
              {errors.criteria && (
                <p className="mt-1 text-sm text-red-600">{errors.criteria.message}</p>
              )}
            </div>

            <div className="mt-5 sm:mt-6">
              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm"
              >
                {mode === 'create' ? 'Ajouter la matière' : 'Modifier la matière'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}