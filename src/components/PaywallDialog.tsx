import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const PaywallDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { status, refresh } = useSubscription();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Após retorno do MP (?pay=success), revalida
    const params = new URLSearchParams(window.location.search);
    if (params.get('pay')) {
      refresh();
      // limpa URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refresh]);

  const handlePay = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-mp-preference');
      if (error) throw error;
      if (!data?.init_point) throw new Error('URL de pagamento indisponível');
      window.location.href = data.init_point;
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar pagamento');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Liberar Acesso ao Sistema</DialogTitle>
          <DialogDescription className="text-center">
            Para usar todas as funcionalidades do sistema de cotações, faça a aquisição da assinatura vitalícia.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-4 my-4">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-bold">R$ 69,90</span>
            <span className="text-sm text-muted-foreground">/ vitalício</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              'Acesso ilimitado a cotações',
              'Geração de links para fornecedores',
              'Análise comparativa de preços',
              'Módulo de estoques',
              'Pagamento único, sem mensalidade',
            ].map(t => (
              <li key={t} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {status === 'pending' && (
          <p className="text-xs text-center text-amber-600">
            Pagamento iniciado anteriormente. Se já pagou, aguarde alguns segundos para confirmação.
          </p>
        )}

        <Button onClick={handlePay} disabled={loading} className="w-full" size="lg">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Pagar com Mercado Pago
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Você será redirecionado para o ambiente seguro do Mercado Pago.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default PaywallDialog;
