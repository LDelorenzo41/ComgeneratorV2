import React from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { ClipboardCopy, Trash2 } from 'lucide-react';

interface Appreciation {
  id: string;
  tag: string;
  created_at: string;
  detailed: string;
}

const tagToTitle: Record<string, string> = {
  tres_bien: 'Très bien',
  bien: 'Bien',
  moyen: 'Moyen',
  insuffisant: 'Insuffisant',
};

export function AppreciationBankPage() {
  const { user } = useAuthStore();
  const [appreciations, setAppreciations] = React.useState<Appreciation[]>([]);

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

  React.useEffect(() => {
    fetchAppreciations();
  }, [user]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('appreciations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erreur lors de la suppression:", error);
      return;
    }

    setAppreciations((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Erreur lors de la copie:", err);
    }
  };

  const grouped = {
    tres_bien: [],
    bien: [],
    moyen: [],
    insuffisant: [],
  } as Record<string, Appreciation[]>;

  appreciations.forEach((app) => {
    if (grouped[app.tag]) {
      grouped[app.tag].push(app);
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
        Ma banque d’appréciations
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(grouped).map(([tag, items]) => (
          <div key={tag}>
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              {tagToTitle[tag]}
            </h2>
            {items.length > 0 ? (
              <ul className="space-y-4">
                {items.map((app) => (
                  <li
                    key={app.id}
                    className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow relative"
                  >
                    <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap mb-4">
                      {app.detailed}
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleCopy(app.detailed)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Copier"
                      >
                        <ClipboardCopy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(app.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucune</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

