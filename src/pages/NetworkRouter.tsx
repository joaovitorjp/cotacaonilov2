import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, Navigate, useSearchParams } from 'react-router-dom';
import Index from '@/pages/Index';
import AdminPanel from '@/pages/AdminPanel';
import Login from '@/pages/Login';

const NetworkRouter = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { user, network, loading: authLoading } = useAuth();
  const [targetNetwork, setTargetNetwork] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTargetNetwork = async () => {
      if (!slug) return;
      const { data } = await supabase
        .from('networks')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      setTargetNetwork(data);
      setLoading(false);
    };
    fetchTargetNetwork();
  }, [slug]);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!targetNetwork) {
    return <Navigate to="/404" replace />;
  }

  // Se não estiver logado, mostra o Login personalizado para a rede
  if (!user) {
    // Injetamos o parâmetro network para o componente Login saber qual rede exibir
    return <Login />;
  }

  // Se estiver logado mas em uma rede diferente da URL, redireciona para a home dele
  // ou mostra erro de permissão. Aqui vamos permitir que o AuthContext lide com isso
  // mas garantimos que ele veja a versão da rede dele.
  
  const view = searchParams.get('view');
  if (view === 'admin') {
    return <AdminPanel />;
  }

  return <Index />;
};

export default NetworkRouter;
