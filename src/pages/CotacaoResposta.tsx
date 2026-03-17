import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, Loader2, Package, Send, Search } from 'lucide-react';

interface Produto {
  codigo_interno: string;
  descricao: string;
  codigo_barras: string;
  categoria?: string;
  observacao?: string;
}

const CotacaoResposta = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [listaId, setListaId] = useState('');
  const [listaNome, setListaNome] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [linkRespondido, setLinkRespondido] = useState(false);
  const [filledCount, setFilledCount] = useState(0);
  // 3. SEARCH: filter products in supplier view
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [token]);

  useEffect(() => {
    const count = Object.values(prices).filter(v => v && v.trim() !== '').length;
    setFilledCount(count);
  }, [prices]);

  const loadData = async () => {
    if (!token) { setError('Link inválido.'); setLoading(false); return; }

    const { data: linkData, error: linkErr } = await supabase
      .from('links_cotacao')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (linkErr || !linkData) {
      setError('Link de cotação não encontrado ou inválido.');
      setLoading(false);
      return;
    }

    if (linkData.respondido) {
      setLinkRespondido(true);
    }

    setEmpresa(linkData.empresa);
    setListaId(linkData.lista_id);

    const { data: lista } = await supabase
      .from('listas')
      .select('*')
      .eq('id', linkData.lista_id)
      .maybeSingle();

    if (!lista) {
      setError('Lista não encontrada.');
      setLoading(false);
      return;
    }

    if (lista.status === 'finalizada') {
      setError('Esta cotação já foi encerrada.');
      setLoading(false);
      return;
    }

    // 5. DEADLINE: Check if expired
    if ((lista as any).prazo && new Date((lista as any).prazo) < new Date()) {
      setError('O prazo para responder esta cotação expirou.');
      setLoading(false);
      return;
    }

    setListaNome(lista.nome);
    const prods = lista.produtos as any as Produto[];
    setProdutos(prods);

    // Pre-fill prices if already responded
    const { data: resps } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', linkData.lista_id)
      .eq('empresa', linkData.empresa);

    const myResp = (resps ?? [])[0];
    if (myResp) {
      const prefilled: Record<number, string> = {};
      prods.forEach((p, idx) => {
        const item = (myResp.resposta as any[]).find((i: any) => i.codigo_interno === p.codigo_interno);
        if (item && item.preco) prefilled[idx] = String(item.preco);
      });
      setPrices(prefilled);
    }

    setLoading(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const resposta = produtos.map((p, idx) => ({
        codigo_interno: p.codigo_interno,
        preco: (prices[idx] && prices[idx].trim() !== '') ? prices[idx] : 'R$ - ',
      }));

      const { data: existing } = await supabase
        .from('respostas')
        .select('id')
        .eq('lista_id', listaId)
        .eq('empresa', empresa)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('respostas')
          .update({ resposta })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('respostas')
          .insert({ lista_id: listaId, empresa, resposta });
      }

      await supabase
        .from('links_cotacao')
        .update({ respondido: true })
        .eq('token', token);

      setSubmitted(true);
      toast.success('Resposta enviada com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao enviar resposta.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. SEARCH: Filter products
  const filteredProdutos = produtos.map((prod, idx) => ({ prod, idx })).filter(({ prod }) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      prod.codigo_interno.toLowerCase().includes(term) ||
      prod.descricao.toLowerCase().includes(term) ||
      prod.codigo_barras.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando cotação...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3 max-w-sm mx-auto px-6">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Cotação Indisponível</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4 max-w-sm mx-auto px-6">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Resposta Enviada!</h1>
          <p className="text-muted-foreground text-sm">
            Obrigado, <span className="font-bold text-foreground">{empresa}</span>. Seus preços foram registrados com sucesso.
          </p>
        </div>
      </div>
    );
  }

  const progress = produtos.length > 0 ? Math.round((filledCount / produtos.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 sm:px-6 py-4 shrink-0 shadow-md">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Nilo Atacadista</h1>
          <p className="text-primary-foreground/80 text-xs sm:text-sm mt-0.5">
            Cotação: {listaNome}
          </p>
        </div>
      </header>

      {/* Info bar */}
      <div className="bg-card border-b border-border px-4 sm:px-6 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              Fornecedor: <span className="font-bold">{empresa}</span>
            </span>
            {linkRespondido && (
              <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">
                Já respondida
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{filledCount}/{produtos.length} preços preenchidos</span>
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. SEARCH BAR */}
      {produtos.length > 10 && (
        <div className="bg-card border-b border-border px-4 sm:px-6 py-2 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por código, descrição ou código de barras..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Product list */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-2">
          {filteredProdutos.length === 0 && searchTerm.trim() ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum produto encontrado para "{searchTerm}"
            </div>
          ) : (
            filteredProdutos.map(({ prod, idx }) => {
              const hasPrice = prices[idx] && prices[idx].trim() !== '';
              return (
                <div
                  key={idx}
                  className={`border rounded-lg p-3 sm:p-4 transition-colors ${
                    hasPrice ? 'border-success/30 bg-success/5' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                          {prod.codigo_interno}
                        </span>
                        <p className="text-sm text-foreground font-medium leading-tight truncate">
                          {prod.descricao}
                        </p>
                      </div>
                      {prod.codigo_barras && (
                        <p className="text-xs text-muted-foreground mt-1 ml-0 sm:ml-12">
                          EAN: {prod.codigo_barras}
                        </p>
                      )}
                    </div>

                    {/* Price input */}
                    <div className="shrink-0 w-full sm:w-36">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                          R$
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                          value={prices[idx] ?? ''}
                          onChange={e => setPrices(prev => ({ ...prev, [idx]: e.target.value }))}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border bg-card px-4 sm:px-6 py-4 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="success"
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || filledCount === 0}
            className="w-full gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar Resposta ({filledCount}/{produtos.length})
              </>
            )}
          </Button>
          {filledCount === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Preencha ao menos um preço para enviar
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CotacaoResposta;
