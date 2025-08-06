import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

const useTokenBalance = () => {
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const user = useAuthStore((state) => state.user);

  const fetchBalance = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setTokenBalance(data.tokens);
    }
  };

  useEffect(() => {
    fetchBalance();

    const handleUpdate = () => {
      fetchBalance();
    };

    window.addEventListener('TOKEN_UPDATED', handleUpdate);
    return () => {
      window.removeEventListener('TOKEN_UPDATED', handleUpdate);
    };
  }, [user]);

  return tokenBalance;
};

export default useTokenBalance;

