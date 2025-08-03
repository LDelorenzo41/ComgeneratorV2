import React from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

interface Appreciation {
  id: string;
  tag: string;
  created_at: string;
}

export function AppreciationBankPage() {
  const { user } = useAuthStore();
  const [appreciations, setAppreciations] = React.useState<Appreciation[]>([]);

  React.useEffect(() => {
    const fetchAppreciations = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('appreciations')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error("Erreur lors de la récupération des appréciations:", error);
        return;
      }

      setAppreciations(data || []);
    };

    fetchAppreciations();
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Mes appréciations
      </h1>
      {appreciations.length > 0 ? (
        <ul className="space-y-4">
          {appreciations.map((appreciation) => (
            <li
              key={appreciation.id}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"
            >
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {appreciation.tag}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(appreciation.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-700 dark:text-gray-300">
          Aucune appréciation trouvée.
        </p>
      )}
    </div>
  );
}
