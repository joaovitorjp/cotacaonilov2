import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Copy, Check, Link2, UserPlus, MessageCircle, RefreshCw, MapPin, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  estados?: string;
  tipo_preco?: 'IPI_ST' | 'NOTA';
}

interface ExistingLink {
  id: string;
  token: string;
  empresa: string;
  respondido: boolean;
  whatsapp?: string;
  estados?: string;
  tipo_preco?: 'IPI_ST' | 'NOTA';
}

type EstadoOption = 'AMBOS' | 'MT' | 'GO';
type TipoPrecoOption = 'IPI_ST' | 'NOTA';

interface GerarLinkPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listaId: string;
}

const getPublicBaseUrl = () => {
  const origin = window.location.origin;
  if (origin.includes('preview--') && origin.includes('.lovable.app')) {
    return 'https://cotacaonilov2.lovable.app';
  }
  return origin;
};

const ESTADO_LABELS: Record<EstadoOption, string> = {
  'AMBOS': 'MT + GO',
  'MT': 'Apenas MT',
  'GO': 'Apenas GO',
};

const TIPO_PRECO_LABELS: Record<TipoPrecoOption, string> = {
  'IPI_ST': 'PREÇO COM IPI + ST',
  'NOTA': 'PREÇO DE NOTA',
};

const GerarLinkPanel: React.FC<GerarLinkPanelProps> = ({ open, onOpenChange, listaId }) => {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [existingLinks, setExistingLinks] = useState<ExistingLink[]>([]);
  const [selectedEstado, setSelectedEstado] = useState<EstadoOption>('AMBOS');
  const [selectedTipoPreco, setSelectedTipoPreco] = useState<TipoPrecoOption>('IPI_ST');
  const [listaNome, setListaNome] = useState<string>('');
  const [userNome, setUserNome] = useState<string>('');
  const [linkToDelete, setLinkToDelete] = useState<ExistingLink | null>(null);



  useEffect(() => {
    if (open) {
      supabase.from('fornecedores').select('*').order('nome').then(({ data }) => {
        setFornecedores((data ?? []) as Fornecedor[]);
      });
      supabase.from('listas').select('nome').eq('id', listaId).maybeSingle().then(({ data }) => {
        setListaNome((data as any)?.nome ?? '');
      });
      if (user?.id) {
        supabase.from('profiles').select('nome').eq('user_id', user.id).maybeSingle().then(({ data }) => {
          setUserNome(((data as any)?.nome ?? '').trim());
        });
      }
      loadExistingLinks();
    }
  }, [open]);


  const loadExistingLinks = async () => {
    const { data: links } = await supabase
      .from('links_cotacao')
      .select('id, token, empresa, respondido, estados, tipo_preco')
      .eq('lista_id', listaId)
      .order('created_at', { ascending: false });

    if (links) {
      const { data: forns } = await supabase.from('fornecedores').select('nome, whatsapp');
      const fornMap: Record<string, string> = {};
      (forns ?? []).forEach((f: any) => { fornMap[f.nome] = f.whatsapp; });

      setExistingLinks(links.map((l: any) => ({
        ...l,
        whatsapp: fornMap[l.empresa],
      })));
    }
  };

  const generateLink = async (empresaNome: string, estados: EstadoOption, tipo_preco: TipoPrecoOption) => {
    const { data, error } = await supabase
      .from('links_cotacao')
      .insert({ lista_id: listaId, empresa: empresaNome, estados, tipo_preco, user_id: user?.id })
      .select()
      .single();

    if (error) throw error;
    return `${getPublicBaseUrl()}/cotacao/${data.token}`;
  };

  const handleGerar = async () => {
    if (!empresa.trim()) return;
    setLoading(true);
    try {
      const link = await generateLink(empresa.trim(), selectedEstado, selectedTipoPreco);
      setGeneratedLinks(prev => [...prev, { empresa: empresa.trim(), link, copied: false, estados: selectedEstado, tipo_preco: selectedTipoPreco }]);
      setEmpresa('');
      toast.success('Link gerado!');
      loadExistingLinks();
    } catch {
      toast.error('Erro ao gerar link.');
    }
    setLoading(false);
  };

  const handleGerarFromFornecedor = async (f: Fornecedor) => {
    if (generatedLinks.some(l => l.empresa === f.nome) || existingLinks.some(l => l.empresa === f.nome)) {
      toast.info('Link já gerado para este fornecedor.');
      return;
    }
    try {
      const link = await generateLink(f.nome, selectedEstado, selectedTipoPreco);
      setGeneratedLinks(prev => [...prev, { empresa: f.nome, link, copied: false, whatsapp: f.whatsapp, estados: selectedEstado, tipo_preco: selectedTipoPreco }]);
      toast.success(`Link gerado para ${f.nome}!`);
      loadExistingLinks();
    } catch {
      toast.error('Erro ao gerar link.');
    }
  };

  const handleGerarTodos = async () => {
    const allExisting = [...generatedLinks.map(l => l.empresa), ...existingLinks.map(l => l.empresa)];
    const pendentes = fornecedores.filter(f => !allExisting.includes(f.nome));
    if (pendentes.length === 0) {
      toast.info('Links já gerados para todos os fornecedores.');
      return;
    }
    setLoading(true);
    let count = 0;
    for (const f of pendentes) {
      try {
        const link = await generateLink(f.nome, selectedEstado, selectedTipoPreco);
        setGeneratedLinks(prev => [...prev, { empresa: f.nome, link, copied: false, whatsapp: f.whatsapp, estados: selectedEstado, tipo_preco: selectedTipoPreco }]);
        count++;
      } catch { /* skip */ }
    }
    toast.success(`${count} link(s) gerado(s)!`);
    loadExistingLinks();
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

  const buildWhatsAppMessage = (link: string, tipoPreco?: 'IPI_ST' | 'NOTA') => {
    const cotacaoLabel = listaNome ? `"${listaNome}"` : '';
    const remetente = userNome ? `\n\nEnviado por: ${userNome}` : '';
    const avisoPreco = tipoPreco ? `\n\n*ATENÇÃO:* Os preços devem ser preenchidos como: *${TIPO_PRECO_LABELS[tipoPreco]}*` : '';
    const msg = `Olá! Segue o link para responder a cotação ${cotacaoLabel}:${avisoPreco}\n${link}${remetente}`.replace(/ {2,}/g, ' ');
    return encodeURIComponent(msg);
  };

  const handleShareWhatsApp = (empresa: string, token: string, whatsapp?: string, tipoPreco?: 'IPI_ST' | 'NOTA') => {
    const phone = whatsapp ? whatsapp.replace(/\D/g, '') : '';
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const link = `${getPublicBaseUrl()}/cotacao/${token}`;
    window.open(`https://wa.me/${fullPhone}?text=${buildWhatsAppMessage(link, tipoPreco)}`, '_blank');
  };

  const handleShareWhatsAppGenerated = (item: GeneratedLink) => {
    const phone = item.whatsapp ? item.whatsapp.replace(/\D/g, '') : '';
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    window.open(`https://wa.me/${fullPhone}?text=${buildWhatsAppMessage(item.link, item.tipo_preco)}`, '_blank');
  };

  const handleDeleteLink = async () => {
    if (!linkToDelete) return;
    const { error } = await supabase.from('links_cotacao').delete().eq('id', linkToDelete.id);
    if (error) {
      toast.error('Erro ao excluir link.');
    } else {
      toast.success('Link excluído.');
      setExistingLinks(prev => prev.filter(l => l.id !== linkToDelete.id));
    }
    setLinkToDelete(null);
  };


  const handleClose = (open: boolean) => {
    if (!open) {
      setGeneratedLinks([]);
      setEmpresa('');
    }
    onOpenChange(open);
  };

  const pendingExisting = existingLinks.filter(l => !l.respondido);
  const respondedExisting = existingLinks.filter(l => l.respondido);

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
          {/* State selector */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Estados para cotação</p>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(['AMBOS', 'MT', 'GO'] as EstadoOption[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setSelectedEstado(opt)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-display font-bold transition-colors ${
                    selectedEstado === opt
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  {ESTADO_LABELS[opt]}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              O fornecedor verá apenas os campos de preço do(s) estado(s) selecionado(s).
            </p>
          </div>

          {/* Price type selector */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Formato do Preço</p>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(['IPI_ST', 'NOTA'] as TipoPrecoOption[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setSelectedTipoPreco(opt)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-display font-bold transition-colors ${
                    selectedTipoPreco === opt
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  {TIPO_PRECO_LABELS[opt]}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Este aviso será exibido para o fornecedor ao abrir o link.
            </p>
          </div>

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
                  const alreadyGenerated = generatedLinks.some(l => l.empresa === f.nome) || existingLinks.some(l => l.empresa === f.nome);
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

          {/* Newly generated links */}
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
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-display font-bold text-foreground text-sm truncate">{item.empresa}</p>
                        {item.estados && item.estados !== 'AMBOS' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold shrink-0">
                            {item.estados}
                          </span>
                        )}
                        {item.tipo_preco && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">
                            {item.tipo_preco === 'IPI_ST' ? 'IPI+ST' : 'NOTA'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {item.whatsapp && (
                          <button
                            onClick={() => handleShareWhatsAppGenerated(item)}
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

          {/* Existing links - pending (resend) */}
          {pendingExisting.length > 0 && (
            <div>
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2">
                ⏳ Aguardando resposta ({pendingExisting.length})
              </p>
              <div className="space-y-2">
                {pendingExisting.map(link => (
                  <div key={link.id} className="border border-border rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-display font-bold text-foreground text-sm truncate">{link.empresa}</p>
                        {link.estados && link.estados !== 'AMBOS' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">
                            {link.estados}
                          </span>
                        )}
                        {link.tipo_preco && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">
                            {link.tipo_preco === 'IPI_ST' ? 'IPI+ST' : 'NOTA'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Ainda não respondeu</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {link.whatsapp && (
                        <button
                          onClick={() => handleShareWhatsApp(link.empresa, link.token, link.whatsapp, link.tipo_preco)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-bold text-green-600 bg-green-500/10 hover:bg-green-500/20 transition-colors"
                          title="Reenviar via WhatsApp"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const url = `${getPublicBaseUrl()}/cotacao/${link.token}`;
                          await navigator.clipboard.writeText(url);
                          toast.success('Link copiado!');
                        }}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Copiar link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setLinkToDelete(link)}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Excluir link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing links - responded */}
          {respondedExisting.length > 0 && (
            <div>
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2">
                ✅ Respondidos ({respondedExisting.length})
              </p>
              <div className="space-y-1">
                {respondedExisting.map(link => (
                  <div key={link.id} className="border border-success/20 bg-success/5 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Check className="w-4 h-4 text-success shrink-0" />
                    <p className="font-display font-bold text-foreground text-sm truncate flex-1">{link.empresa}</p>
                    {link.estados && link.estados !== 'AMBOS' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success font-bold shrink-0">
                        {link.estados}
                      </span>
                    )}
                    {link.tipo_preco && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success font-bold shrink-0">
                        {link.tipo_preco === 'IPI_ST' ? 'IPI+ST' : 'NOTA'}
                      </span>
                    )}
                    <button
                      onClick={() => setLinkToDelete(link)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      title="Excluir link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={!!linkToDelete} onOpenChange={(o) => !o && setLinkToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir link de {linkToDelete?.empresa}?</AlertDialogTitle>
            <AlertDialogDescription>
              {linkToDelete?.respondido
                ? 'Este fornecedor já respondeu. Excluir o link também removerá a resposta vinculada. Esta ação não pode ser desfeita.'
                : 'O link ficará inválido e o fornecedor não conseguirá mais acessá-lo. Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLink} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};

export default GerarLinkPanel;
