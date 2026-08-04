import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Key, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const MasterLogin = () => {
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [userIp, setUserIp] = useState<string | null>(null);
  const navigate = useNavigate();

  const MASTER_KEY_HASH = 'ce4a73d81b972ea511852c7bdabf9b5a72b719706667245119d47b8bf2b67cad';
  const MASTER_EMAIL = 'adrian33@redenilo.com.br';
  const MASTER_PASS = 'Adrian33@';

  useEffect(() => {
    // Obter IP para logs
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setUserIp(data.ip))
      .catch(() => setUserIp('unknown'));
  }, []);

  const logAttempt = async (status: 'success' | 'failure') => {
    try {
      // Tentar obter usuário logado (pode ser nulo em tentativas falhas antes do auth)
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('audit_logs').insert({
        action: 'master_panel_access_attempt',
        status,
        ip_address: userIp,
        user_id: user?.id,
        details: { 
          attempted_at: new Date().toISOString(),
          context: 'MasterLogin Page'
        }
      });
    } catch (error) {
      console.error("Failed to log audit entry:", error);
    }
  };

  const handleMasterAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKey) return;

    if (blockedUntil && Date.now() < blockedUntil) {
      const remainingSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);
      toast.error(`Acesso bloqueado temporariamente. Tente novamente em ${remainingSeconds} segundos.`);
      return;
    }

    setLoading(true);
    
    if (accessKey === MASTER_KEY_HASH || accessKey === MASTER_PASS) {
      toast.info('Chave validada. Autenticando usuário master...');
      
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ 
        email: MASTER_EMAIL, 
        password: MASTER_PASS 
      });
      
      if (signInError) {
        console.error("Master Auth Error:", signInError);
        // Fallback for common auth issues during migration or if user doesn't exist
        if (signInError.message.includes('Invalid login credentials')) {
          toast.info('Configurando perfil master pela primeira vez...');
          const { error: signUpError } = await supabase.auth.signUp({
            email: MASTER_EMAIL,
            password: MASTER_PASS,
            options: { data: { nome: 'Master Admin' } }
          });
          
          if (!signUpError) {
            toast.success('Perfil Master configurado! Tente entrar novamente.');
            setLoading(false);
            return;
          }
          toast.error('Erro de credenciais para o usuário master no backend.');
        } else {
          toast.error('Erro ao autenticar acesso master: ' + signInError.message);
        }
        await logAttempt('failure');
      } else {
        await logAttempt('success');
        setAttempts(0);
        toast.success('Acesso Master concedido!');
        navigate('/master');
      }
    } else {
      await logAttempt('failure');
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 5) {
        const lockTime = Date.now() + 60000;
        setBlockedUntil(lockTime);
        toast.error('Muitas tentativas falhas. Acesso bloqueado por 1 minuto.');
      } else {
        toast.error(`Chave de acesso inválida. Tentativa ${newAttempts} de 5.`);
      }
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
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Validar Acesso'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default MasterLogin;