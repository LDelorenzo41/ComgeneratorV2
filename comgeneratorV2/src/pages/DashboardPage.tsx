import React from 'react';
import { SubjectList } from '../components/dashboard/SubjectList';
import { AppreciationForm } from '../components/dashboard/AppreciationForm';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { user } = useAuthStore();
  const [tokenCount, setTokenCount] = React.useState<number | null>(null);
  const fetchTokenCount = React.useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        // If profile doesn't exist (PGRST116 error), create it
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({ user_id: user.id, tokens: 100000 })
            .select('tokens')
            .single();
          
          if (insertError) throw insertError;
          setTokenCount(newProfile?.tokens ?? 100000);
          return;
        }
        throw error;
      }

      setTokenCount(data?.tokens ?? 0);
    } catch (err) {
      console.error('Erreur lors de la récupération du solde de tokens:', err);
    }
  }, [user]);

  React.useEffect(() => {
    fetchTokenCount();
  }, [fetchTokenCount]);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Bonjour {user?.email}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Bienvenue dans votre espace de génération d'appréciations
          </p>
        </div>


        {tokenCount !== null && (
          <p className="text-right font-semibold text-gray-900 dark:text-gray-100">
            Crédits restants : {tokenCount.toLocaleString()} tokens
          </p>
        )}

        <SubjectList />
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Générer une appréciation
          </h2>
          <AppreciationForm onTokensUpdated={fetchTokenCount} />
        </div>
      </div>
    </div>
  );
}