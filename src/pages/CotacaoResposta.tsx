import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import SpreadsheetTable from '@/components/SpreadsheetTable';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Produto {
  codigo_interno: string;
  descricao: string;
  codigo_barras: string;
}

const CotacaoResposta = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [listaId, setListaId] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [respostas, setRespostas] = useState<{ empresa: string; resposta: any[] }[]>([]);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [linkRespondido, setLinkRespondido] = useState(false);

  useEffect(() => {
    loadData();
  }, [token]);

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

    const prods = lista.produtos as any as Produto[];
    setProdutos(prods);

    const { data: resps } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', linkData.lista_id);

    setRespostas((resps ?? []).map((d: any) => ({ empresa: d.empresa, resposta: d.resposta as any[] })));

    // Pre-fill prices if already responded
    const myResp = (resps ?? []).find((r: any) => r.empresa === linkData.empresa);
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
        preco: prices[idx] || '',
      }));

      const existing = respostas.find(r => r.empresa === empresa);
      if (existing) {
        await supabase
          .from('respostas')
          .update({ resposta })
          .eq('lista_id', listaId)
          .eq('empresa', empresa);
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
      toast.error('Erro ao enviar resposta: ' + (err.message || 'Erro'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground font-body">Carregando cotação...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-xl font-display font-bold text-foreground mb-2">Cotação Indisponível</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-xl font-display font-bold text-success mb-2">Resposta Enviada!</h1>
          <p className="text-muted-foreground">Obrigado, {empresa}. Seus preços foram registrados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-card border-b border-border px-6 py-3 shrink-0">
        <h1 className="text-xl font-display font-bold text-foreground tracking-tight">Nilo Atacadista</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Cotação para <span className="font-display font-bold text-foreground">{empresa}</span>
          {linkRespondido && <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">Já respondida — edite e reenvie se necessário</span>}
        </p>
      </header>

      <SpreadsheetTable
        produtos={produtos}
        respostas={[]}
        editableColumn={empresa}
        onPriceChange={(rowIndex, preco) => setPrices(prev => ({ ...prev, [rowIndex]: preco }))}
        editPrices={prices}
      />

      <div className="shrink-0 border-t border-border p-4 bg-card">
        <Button
          variant="success"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full max-w-xs mx-auto block"
        >
          {submitting ? 'Enviando...' : 'Enviar Resposta'}
        </Button>
      </div>
    </div>
  );
};

export default CotacaoResposta;
