import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';

interface GerarLinkPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listaId: string;
}

const GerarLinkPanel: React.FC<GerarLinkPanelProps> = ({ open, onOpenChange, listaId }) => {
  const [empresa, setEmpresa] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkData, setLinkData] = useState<{ empresa: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGerar = async () => {
    if (!empresa.trim()) {
      toast.error('Informe o nome da empresa.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('links_cotacao')
        .insert({ lista_id: listaId, empresa: empresa.trim() })
        .select()
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/cotacao/${data.token}`;
      setLinkData({ empresa: empresa.trim(), link });
      setEmpresa('');
    } catch (err: any) {
      toast.error('Erro ao gerar link: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!linkData) return;
    await navigator.clipboard.writeText(linkData.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setLinkData(null);
      setCopied(false);
      setEmpresa('');
    }
    onOpenChange(open);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-[40vw] min-w-[360px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle className="font-display">Gerar Link Cotação</SheetTitle>
          <SheetDescription>
            Informe o nome da empresa para gerar um link único de resposta.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {!linkData ? (
            <>
              <div>
                <label className="text-sm font-display font-bold text-foreground">Nome da Empresa</label>
                <Input
                  value={empresa}
                  onChange={e => setEmpresa(e.target.value)}
                  placeholder="Ex: Distribuidora ABC"
                  className="mt-1"
                />
              </div>
              <Button onClick={handleGerar} disabled={loading || !empresa.trim()} className="w-full">
                {loading ? 'Gerando...' : 'Gerar Link'}
              </Button>
            </>
          ) : (
            <div
              className={`border-2 rounded p-4 transition-colors duration-200 ${
                copied ? 'border-success bg-success/5' : 'border-border'
              }`}
            >
              <p className="font-display font-bold text-foreground text-lg">{linkData.empresa}</p>
              <p className="text-sm text-muted-foreground mt-2 break-all font-mono">{linkData.link}</p>
              <Button
                onClick={handleCopy}
                variant={copied ? 'success' : 'default'}
                className="w-full mt-4"
              >
                {copied ? 'Copiado!' : 'Copiar Link'}
              </Button>
              <Button
                onClick={() => { setLinkData(null); }}
                variant="outline"
                className="w-full mt-2"
              >
                Gerar outro link
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GerarLinkPanel;
