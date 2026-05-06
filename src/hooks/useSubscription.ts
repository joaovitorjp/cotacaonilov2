import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubStatus = 'loading' | 'active' | 'admin' | 'pending' | 'none';

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubStatus>('loading');

  const refresh = useCallback(async () => {
    if (!user) { setStatus('none'); return; }
    const { data } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data) setStatus('none');
    else if (data.status === 'admin') setStatus('admin');
    else if (data.status === 'active') setStatus('active');
    else setStatus('pending');
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: re-check when subscription updated (webhook ativará)
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`sub-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'subscriptions',
        filter: `user_id=eq.${user.id}`,
      }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  const hasAccess = status === 'active' || status === 'admin';
  return { status, hasAccess, refresh };
}
