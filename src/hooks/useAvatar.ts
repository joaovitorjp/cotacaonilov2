import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Loads the current user's avatar (private bucket -> signed URL). */
export const useAvatar = () => {
  const { user } = useAuth();
  const [path, setPath] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setPath(null);
      setUrl(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    const p = ((data as any)?.avatar_url ?? '') as string;
    setPath(p || null);
    if (!p) {
      setUrl(null);
      return;
    }
    const { data: signed } = await supabase.storage
      .from('profiles')
      .createSignedUrl(p, 60 * 60);
    setUrl(signed?.signedUrl ?? null);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => void refresh();
    window.addEventListener('avatar-updated', handler);
    return () => window.removeEventListener('avatar-updated', handler);
  }, [refresh]);

  return { avatarUrl: url, avatarPath: path, refresh };
};

export const notifyAvatarUpdated = () =>
  window.dispatchEvent(new Event('avatar-updated'));
