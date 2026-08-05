import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  network: any | null;
  empresa: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  network: null,
  empresa: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [network, setNetwork] = useState<any | null>(null);
  const [empresa, setEmpresa] = useState<any | null>(null);

  const fetchData = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('network_id, empresa_id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (profile?.network_id) {
      const { data: net } = await supabase
        .from('networks')
        .select('*')
        .eq('id', profile.network_id)
        .maybeSingle();
      setNetwork(net);
    } else {
      setNetwork(null);
    }

    if (profile?.empresa_id) {
      const { data: emp } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', profile.empresa_id)
        .maybeSingle();
      setEmpresa(emp);
    } else {
      setEmpresa(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchData(session.user.id);
      } else {
        setNetwork(null);
        setEmpresa(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, network, empresa, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
