import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Copy, Check, Link2, UserPlus, MessageCircle } from 'lucide-react';

interface Fornecedor {
  id: string;
  nome: string;
  contato: string | null;
  whatsapp: string;
}

interface GeneratedLink {
  empresa: string;
  link: string;
  copied: boolean;
  whatsapp?: string;
}

interface GerarLinkPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listaId: string;
}

const GerarLinkPanel: React.FC<GerarLinkPanelProps> = ({ open, onOpenChange, listaId }) => {
  const [empresa, setEmpresa] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  useEffect(() => {
    if (open) {
      supabase.from('fornecedores').select('*').order('nome').then(({ data }) => {
        setFornecedores((data ?? []) as Fornecedor[]);
      });
    }
  }, [open]);

  const generateLink = async (empresaNome: string) => {
    const { data, error } = await supabase
      .from('links_cotacao')
      .insert({ lista_id: listaId, empresa: empresaNome })
      .select()
      .single();

    if (error) throw error;
    return `${window.location.origin}/cotacao/${data.token}`;
  };

  const handleGerar = async () => {
    if (!empresa.trim()) return;
    setLoading(true);
    try {
      const link = await generateLink(empresa.trim());
      setGeneratedLinks(prev => [...prev, { empresa: empresa.trim(), link, copied: false }]);
      setEmpresa('');
      toast.success('Link gerado!');
    } catch {
      toast.error('Erro ao gerar link.');
    }
    setLoading(false);
  };

  const handleGerarFromFornecedor = async (f: Fornecedor) => {
    if (generatedLinks.some(l => l.empresa === f.nome)) {
      toast.info('Link já gerado para este fornecedor.');
      return;
    }
    try {
      const link = await generateLink(f.nome);
      setGeneratedLinks(prev => [...prev, { empresa: f.nome, link, copied: false, whatsapp: f.whatsapp }]);
      toast.success(`Link gerado para ${f.nome}!`);
    } catch {
      toast.error('Erro ao gerar link.');
    }
  };

  const handleGerarTodos = async () => {
    const pendentes = fornecedores.filter(f => !generatedLinks.some(l => l.empresa === f.nome));
    if (pendentes.length === 0) {
      toast.info('Links já gerados para todos os fornecedores.');
      return;
    }
    setLoading(true);
    let count = 0;
    for (const f of pendentes) {
      try {
        const link = await generateLink(f.nome);
        setGeneratedLinks(prev => [...prev, { empresa: f.nome, link, copied: false, whatsapp: f.whatsapp }]);
        count++;
      } catch { /* skip */ }
    }
    toast.success(`${count} link(s) gerado(s)!`);
    setLoading(false);
  };

  const handleCopy = async (idx: number) => {
    await navigator.clipboard.writeText(generatedLinks[idx].link);
    setGeneratedLinks(prev => prev.map((l, i) => i === idx ? { ...l, copied: true } : l));
    setTimeout(() => {
      setGeneratedLinks(prev => prev.map((l, i) => i === idx ? { ...l, copied: false } : l));
    }, 2000);
  };

  const handleCopyAll = async () => {
    const text = generatedLinks.map(l => `${l.empresa}: ${l.link}`).join('\n');
    await navigator.clipboard.writeText(text);
    toast.success('Todos os links copiados!');
  };

  const handleShareWhatsApp = (item: GeneratedLink) => {
    const phone = item.whatsapp ? item.whatsapp.replace(/\D/g, '') : '';
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const message = encodeURIComponent(
      `Olá! Segue o link para responder a cotação:\n${item.link}`
    );
    window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setGeneratedLinks([]);
      setEmpresa('');
    }
    onOpenChange(open);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-[95vw] sm:w-[50vw] sm:min-w-[420px] sm:max-w-[600px] p-0 flex flex-col">
        <div className="p-6 pb-0">
          <SheetHeader>
            <SheetTitle className="font-display text-xl flex items-center gap-2">
              <Link2 className="w-5 h-5" /> Gerar Links de Cotação
            </SheetTitle>
            <SheetDescription>Gere links únicos e compartilhe via WhatsApp.</SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-auto p-6 pt-4 space-y-4">
          {/* Quick add from saved fornecedores */}
          {fornecedores.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Fornecedores salvos</p>
                <Button variant="outline" size="sm" onClick={handleGerarTodos} disabled={loading} className="text-xs h-7">
                  Gerar todos
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fornecedores.map(f => {
                  const alreadyGenerated = generatedLinks.some(l => l.empresa === f.nome);
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleGerarFromFornecedor(f)}
                      disabled={alreadyGenerated}
                      className={`text-xs px-3 py-1.5 rounded-full font-display transition-colors ${
                        alreadyGenerated
                          ? 'bg-success/10 text-success cursor-default'
                          : 'bg-muted text-foreground hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {alreadyGenerated ? '✓ ' : '+ '}{f.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manual add */}
          <div>
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2">
              {fornecedores.length > 0 ? 'Ou adicionar manualmente' : 'Nome da empresa'}
            </p>
            <div className="flex gap-2">
              <Input
                value={empresa}
                onChange={e => setEmpresa(e.target.value)}
                placeholder="Ex: Distribuidora ABC"
                onKeyDown={e => e.key === 'Enter' && handleGerar()}
              />
              <Button onClick={handleGerar} disabled={loading || !empresa.trim()} size="sm" className="shrink-0">
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Generated links */}
          {generatedLinks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">
                  Links gerados ({generatedLinks.length})
                </p>
                {generatedLinks.length > 1 && (
                  <Button variant="outline" size="sm" onClick={handleCopyAll} className="text-xs h-7">
                    <Copy className="w-3 h-3 mr-1" /> Copiar todos
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {generatedLinks.map((item, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-3 transition-colors ${
                      item.copied ? 'border-success bg-success/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-display font-bold text-foreground text-sm">{item.empresa}</p>
                      <div className="flex items-center gap-1">
                        {item.whatsapp && (
                          <button
                            onClick={() => handleShareWhatsApp(item)}
                            className="p-1.5 rounded transition-colors text-green-600 hover:bg-green-500/10"
                            title="Enviar via WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleCopy(idx)}
                          className={`p-1.5 rounded transition-colors ${
                            item.copied ? 'text-success' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          {item.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground break-all font-mono">{item.link}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GerarLinkPanel;
