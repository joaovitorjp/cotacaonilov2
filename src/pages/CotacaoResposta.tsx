import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, Loader2, Package, Send, Search, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [listaUserId, setListaUserId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string>('');
  const [listaNome, setListaNome] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pricesMT, setPricesMT] = useState<Record<number, string>>({});
  const [pricesGO, setPricesGO] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [linkRespondido, setLinkRespondido] = useState(false);
  const [filledCount, setFilledCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [estados, setEstados] = useState<string>('AMBOS');

  const showMT = estados === 'AMBOS' || estados === 'MT';
  const showGO = estados === 'AMBOS' || estados === 'GO';

  useEffect(() => {
    loadData();
  }, [token]);

  useEffect(() => {
    const countMT = showMT ? Object.values(pricesMT).filter(v => v && v.trim() !== '').length : 0;
    const countGO = showGO ? Object.values(pricesGO).filter(v => v && v.trim() !== '').length : 0;
    setFilledCount(countMT + countGO);
  }, [pricesMT, pricesGO, showMT, showGO]);

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

    if (linkData.respondido) setLinkRespondido(true);
    setEmpresa(linkData.empresa);
    setListaId(linkData.lista_id);
    setLinkId(linkData.id);
    setEstados((linkData as any).estados || 'AMBOS');

    const { data: lista } = await supabase
      .from('listas')
      .select('*')
      .eq('id', linkData.lista_id)
      .maybeSingle();

    if (!lista) { setError('Lista não encontrada.'); setLoading(false); return; }
    if (lista.status === 'finalizada') { setError('Esta cotação já foi encerrada.'); setLoading(false); return; }
    if ((lista as any).prazo && new Date((lista as any).prazo) < new Date()) {
      setError('O prazo para responder esta cotação expirou.'); setLoading(false); return;
    }

    setListaNome(lista.nome);
    setListaUserId((lista as any).user_id ?? null);
    const prods = lista.produtos as any as Produto[];
    setProdutos(prods);

    const { data: resps } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', linkData.lista_id)
      .eq('empresa', linkData.empresa);

    const myResp = (resps ?? [])[0];
    if (myResp) {
      const prefilledMT: Record<number, string> = {};
      const prefilledGO: Record<number, string> = {};
      prods.forEach((p, idx) => {
        const item = (myResp.resposta as any[]).find((i: any) => i.codigo_interno === p.codigo_interno);
        if (item) {
          if (item.preco_mt) prefilledMT[idx] = String(item.preco_mt);
          if (item.preco_go) prefilledGO[idx] = String(item.preco_go);
          if (!item.preco_mt && !item.preco_go && item.preco) prefilledMT[idx] = String(item.preco);
        }
      });
      setPricesMT(prefilledMT);
      setPricesGO(prefilledGO);
    }

    setLoading(false);
  };

  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      const dateStr = now.toLocaleString('pt-BR');
      doc.setFontSize(14);
      doc.text('Nilo Atacadista - Cópia da Resposta', 14, 15);
      doc.setFontSize(10);
      doc.text(`Cotação: ${listaNome}`, 14, 22);
      doc.text(`Fornecedor: ${empresa}`, 14, 27);
      doc.text(`Data: ${dateStr}`, 14, 32);

      const head: string[] = ['Código', 'Descrição', 'EAN'];
      if (showMT) head.push('Preço MT (R$)');
      if (showGO) head.push('Preço GO (R$)');

      const body = produtos.map((p, idx) => {
        const row: string[] = [p.codigo_interno, p.descricao, p.codigo_barras || ''];
        if (showMT) row.push(pricesMT[idx] || '-');
        if (showGO) row.push(pricesGO[idx] || '-');
        return row;
      });

      autoTable(doc, {
        head: [head],
        body,
        startY: 38,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
      });

      const safeEmpresa = empresa.replace(/[^a-zA-Z0-9]+/g, '_');
      const safeLista = listaNome.replace(/[^a-zA-Z0-9]+/g, '_');
      doc.save(`cotacao_${safeLista}_${safeEmpresa}.pdf`);
      toast.success('PDF baixado com sucesso!');
    } catch {
      toast.error('Erro ao gerar PDF.');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const resposta = produtos.map((p, idx) => ({
        codigo_interno: p.codigo_interno,
        ...(showMT ? { preco_mt: (pricesMT[idx] && pricesMT[idx].trim() !== '') ? pricesMT[idx] : '' } : {}),
        ...(showGO ? { preco_go: (pricesGO[idx] && pricesGO[idx].trim() !== '') ? pricesGO[idx] : '' } : {}),
      }));

      const { data: existing } = await supabase
        .from('respostas')
        .select('id')
        .eq('lista_id', listaId)
        .eq('empresa', empresa)
        .maybeSingle();

      if (existing) {
        await supabase.from('respostas').update({ resposta }).eq('id', existing.id);
      } else {
        await supabase.from('respostas').insert({
          lista_id: listaId,
          empresa,
          resposta,
          ...(listaUserId ? { user_id: listaUserId } : {}),
        });
      }

      // Vincula a resposta ao link específico que foi usado
      if (linkId) {
        await supabase.from('links_cotacao').update({ respondido: true }).eq('id', linkId);
      } else {
        await supabase.from('links_cotacao').update({ respondido: true }).eq('token', token);
      }
      setSubmitted(true);
      toast.success('Resposta enviada com sucesso!');
    } catch {
      toast.error('Erro ao enviar resposta.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProdutos = produtos.map((prod, idx) => ({ prod, idx })).filter(({ prod }) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      prod.codigo_interno.toLowerCase().includes(term) ||
      prod.descricao.toLowerCase().includes(term) ||
      prod.codigo_barras.toLowerCase().includes(term) ||
      (prod.categoria || '').toLowerCase().includes(term)
    );
  });

  const categories = useMemo(() => {
    const cats: Record<string, typeof filteredProdutos> = {};
    for (const item of filteredProdutos) {
      const cat = item.prod.categoria || 'Geral';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(item);
    }
    return cats;
  }, [filteredProdutos]);

  const hasCategories = produtos.some(p => p.categoria && p.categoria.trim() !== '');

  const renderProductCard = (prod: Produto, idx: number) => {
    const hasPriceMT = showMT && pricesMT[idx] && pricesMT[idx].trim() !== '';
    const hasPriceGO = showGO && pricesGO[idx] && pricesGO[idx].trim() !== '';
    const hasAnyPrice = hasPriceMT || hasPriceGO;
    return (
      <div
        key={idx}
        className={`border rounded-lg p-3 sm:p-4 transition-colors ${
          hasAnyPrice ? 'border-success/30 bg-success/5' : 'border-border bg-card'
        }`}
      >
        <div className="flex flex-col gap-2">
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
            {prod.observacao && (
              <p className="text-xs text-primary/80 mt-1 ml-0 sm:ml-12 italic">
                📝 {prod.observacao}
              </p>
            )}
          </div>
          <div className="flex gap-2 sm:gap-3">
            {showMT && (
              <div className="flex-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                  MT (Mato Grosso)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    value={pricesMT[idx] ?? ''}
                    onChange={e => setPricesMT(prev => ({ ...prev, [idx]: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
              </div>
            )}
            {showGO && (
              <div className="flex-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                  GO (Goiás)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    value={pricesGO[idx] ?? ''}
                    onChange={e => setPricesGO(prev => ({ ...prev, [idx]: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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

  const stateCount = (showMT ? 1 : 0) + (showGO ? 1 : 0);
  const totalFields = produtos.length * stateCount;
  const progress = totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0;

  const estadoLabel = estados === 'AMBOS' ? 'MT + GO' : estados;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 sm:px-6 py-4 shrink-0 shadow-md">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Nilo Atacadista</h1>
          <p className="text-primary-foreground/80 text-xs sm:text-sm mt-0.5">
            Cotação: {listaNome}
          </p>
        </div>
      </header>

      <div className="bg-card border-b border-border px-4 sm:px-6 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              Fornecedor: <span className="font-bold">{empresa}</span>
            </span>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
              {estadoLabel}
            </span>
            {linkRespondido && (
              <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">
                Já respondida
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{filledCount}/{totalFields} preços preenchidos</span>
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

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

      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="bg-muted/50 border border-border rounded-lg p-3 mb-3">
            <p className="text-xs text-muted-foreground">
              {estados === 'AMBOS' ? (
                <>Preencha os preços para cada estado. <span className="font-bold text-foreground">MT</span> = Mato Grosso, <span className="font-bold text-foreground">GO</span> = Goiás.</>
              ) : estados === 'MT' ? (
                <>Preencha os preços para <span className="font-bold text-foreground">Mato Grosso (MT)</span>.</>
              ) : (
                <>Preencha os preços para <span className="font-bold text-foreground">Goiás (GO)</span>.</>
              )}
            </p>
          </div>
          {filteredProdutos.length === 0 && searchTerm.trim() ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum produto encontrado para "{searchTerm}"
            </div>
          ) : hasCategories ? (
            Object.entries(categories).map(([cat, items]) => (
              <div key={cat}>
                <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 rounded-lg mb-2 z-[5]">
                  <p className="text-xs font-display font-bold text-primary uppercase tracking-wider">{cat}</p>
                  <p className="text-[10px] text-muted-foreground">{items.length} produto(s)</p>
                </div>
                {items.map(({ prod, idx }) => renderProductCard(prod, idx))}
              </div>
            ))
          ) : (
            filteredProdutos.map(({ prod, idx }) => renderProductCard(prod, idx))
          )}
        </div>
      </div>

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
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="w-4 h-4" /> Enviar Resposta ({filledCount}/{totalFields})</>
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
