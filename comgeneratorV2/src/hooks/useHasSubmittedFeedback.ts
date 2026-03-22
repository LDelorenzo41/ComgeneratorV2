import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

/**
 * Vérifie si le user connecté a déjà soumis un feedback.
 * Retourne { hasSubmitted, isLoading }.
 */
export function useHasSubmittedFeedback() {
  const { user } = useAuthStore();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }

    const check = async () => {
      try {
        const { count, error } = await supabase
          .from('feedback_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('tester_email', user.email)
          .eq('completed', true);

        if (!error && count !== null && count > 0) {
          setHasSubmitted(true);
        }
      } catch {
        // En cas d'erreur, on ne bloque pas l'accès
      } finally {
        setIsLoading(false);
      }
    };

    check();
  }, [user?.email]);

  return { hasSubmitted, isLoading };
}