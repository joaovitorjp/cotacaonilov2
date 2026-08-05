import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';

const MasterLogin = () => {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const ip = '0.0.0.0'; // IP logging handled via edge functions or simple log table
    
    if (hashHex === 'ce4a73d81b972ea511852c7bdabf9b5a72b719706667245119d47b8bf2b67cad') {
      localStorage.setItem('master_access', 'true');
      await supabase.from('audit_logs').insert({ 
        action: 'MASTER_LOGIN', 
        details: 'Login bem-sucedido', 
        ip 
      });
      navigate('/master');
    } else {
      await supabase.from('audit_logs').insert({ 
        action: 'MASTER_LOGIN_FAILED', 
        details: 'Chave inválida', 
        ip 
      });
      toast.error('Chave de acesso inválida.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Shield className="w-12 h-12 mx-auto text-primary mb-2" />
          <CardTitle>Painel Master</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Chave de Acesso"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <Button className="w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Acessar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterLogin;
