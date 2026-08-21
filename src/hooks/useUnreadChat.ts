import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const LS_KEY = 'chat_global_last_seen';

/** Conta mensagens novas do chat global desde a última visualização. */
export const useUnreadChat = (chatOpen: boolean) => {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  // Ao abrir o chat, zera e marca como lido
  useEffect(() => {
    if (chatOpen) {
      localStorage.setItem(LS_KEY, new Date().toISOString());
      setUnread(0);
    }
  }, [chatOpen]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const lastSeen = localStorage.getItem(LS_KEY) ?? new Date(0).toISOString();

    (async () => {
      if (chatOpen) return;
      const { count } = await supabase
        .from('mensagens_globais')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', lastSeen)
        .neq('user_id', user.id);
      if (active) setUnread(count ?? 0);
    })();

    const channel = supabase
      .channel('mensagens-globais-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_globais' },
        payload => {
          const msg = payload.new as { user_id: string };
          if (msg.user_id === user.id) return;
          if (chatOpen) {
            localStorage.setItem(LS_KEY, new Date().toISOString());
            return;
          }
          setUnread(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user, chatOpen]);

  return unread;
};
