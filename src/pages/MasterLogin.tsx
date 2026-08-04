import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Key } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const MasterLogin = () => {
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // A chave real gerada por SHA-256 (ce4a73d8...) é muito longa para decorar, 
  // mas o usuário pediu para "gerar uma em formato SHA-256 e me enviar".
  // Validaremos contra o hash da chave digitada ou a própria chave se for o que ele espera.
  const MASTER_KEY_HASH = 'ce4a73d81b972ea511852c7bdabf9b5a72b719706667245119d47b8bf2b67cad';

  const handleMasterAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKey) return;

    setLoading(true);
    
    // Simulação de verificação de chave (em um cenário real seria via Edge Function ou similar)
    // Para simplificar e atender o pedido do usuário:
    if (accessKey === MASTER_KEY_HASH) {
      // Realizar login com as credenciais administrativas pré-definidas
      const { error } = await supabase.auth.signInWithPassword({ 
        email: 'adrian33@redenilo.com.br', 
        password: 'Adrian33@' 
      });
      
      if (error) {
        toast.error('Erro ao autenticar acesso master.');
      } else {
        toast.success('Acesso Master concedido!');
        navigate('/master');
      }
    } else {
      toast.error('Chave de acesso inválida.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-6 mb-8 text-center">
          <div className="p-4 bg-sky-500/10 rounded-2xl ring-1 ring-sky-500/20">
            <Shield className="w-8 h-8 text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white tracking-tight uppercase">
              Acesso Master Admin
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              Insira sua chave SHA-256 para prosseguir
            </p>
          </div>
        </div>

        <form onSubmit={handleMasterAccess} className="space-y-6">
          <div className="space-y-2">
            <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-sky-400 transition-colors" />
              <Input
                type="password"
                value={accessKey}
                onChange={e => setAccessKey(e.target.value)}
                placeholder="Chave de Acesso"
                className="pl-12 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-600 h-14 rounded-2xl focus-visible:ring-sky-500/30"
              />
            </div>
          </div>
          <Button 
            type="submit" 
            className="w-full h-14 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold uppercase tracking-widest shadow-lg shadow-sky-600/20 transition-all duration-300"
            disabled={loading}
          >
            {loading ? 'Validando...' : 'Acessar Painel'}
          </Button>
        </form>

        <button 
          onClick={() => navigate('/login')}
          className="w-full mt-6 text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          Voltar para login comum
        </button>
      </div>
    </div>
  );
};

export default MasterLogin;
