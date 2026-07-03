import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LOJAS, SESSOES, fmtBRL } from '@/lib/avariasConstants';
import { BarChart3, Package, DollarSign, Filter, X, TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

interface Avaria {
  id: string;
  sessao: string;
  comprador: string;
  loja_numero: string;
  loja_nome: string;
  valor_total: number;
  fornecedor_codigo: string | null;
  fornecedor_nome: string | null;
  quantidade: number;
  data_referencia: string;
}

interface Props {
  className?: string;
}

const AvariasDashboard: React.FC<Props> = ({ className }) => {
  const [rows, setRows] = useState<Avaria[]>([]);
  const [loading, setLoading] = useState(true);

  const [fSessao, setFSessao] = useState<string>('all');
  const [fLoja, setFLoja] = useState<string>('all');
  const [fFornecedor, setFFornecedor] = useState<string>('');
  const [fFrom, setFFrom] = useState<string>('');
  const [fTo, setFTo] = useState<string>('');

  useEffect(() => {
    void fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('avarias')
      .select('id, sessao, comprador, loja_numero, loja_nome, valor_total, fornecedor_codigo, fornecedor_nome, quantidade, data_referencia')
      .order('data_referencia', { ascending: false })
      .limit(50000);
    setRows((data ?? []).map((r: any) => ({
      ...r,
      valor_total: Number(r.valor_total) || 0,
      quantidade: Number(r.quantidade) || 0,
    })));
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const forn = fFornecedor.trim().toLowerCase();
    return rows.filter(r => {
      if (fSessao !== 'all' && r.sessao !== fSessao) return false;
      if (fLoja !== 'all' && r.loja_numero !== fLoja) return false;
      if (forn) {
        const hay = `${r.fornecedor_nome ?? ''} ${r.fornecedor_codigo ?? ''}`.toLowerCase();
        if (!hay.includes(forn)) return false;
      }
      if (fFrom && r.data_referencia < fFrom) return false;
      if (fTo && r.data_referencia > fTo) return false;
      return true;
    });
  }, [rows, fSessao, fLoja, fFornecedor, fFrom, fTo]);

  const totalValor = filtered.reduce((s, r) => s + r.valor_total, 0);
  const totalQtd = filtered.reduce((s, r) => s + r.quantidade, 0);
  const totalRegistros = filtered.length;

  const groupBy = (key: keyof Avaria, label?: (r: Avaria) => string) => {
    const map = new Map<string, { name: string; valor: number; qtd: number }>();
    for (const r of filtered) {
      const k = String(r[key] ?? '—');
      const name = label ? label(r) : k;
      const cur = map.get(k) ?? { name, valor: 0, qtd: 0 };
      cur.valor += r.valor_total;
      cur.qtd += r.quantidade;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  };

  const porSessao = useMemo(() => groupBy('sessao'), [filtered]);
  const porLoja = useMemo(() => groupBy('loja_numero', r => `${r.loja_numero} · ${r.loja_nome}`), [filtered]);
  const porFornecedor = useMemo(
    () => groupBy('fornecedor_nome', r => r.fornecedor_nome || r.fornecedor_codigo || '—').slice(0, 15),
    [filtered],
  );

  const colors = ['hsl(var(--primary))', 'hsl(var(--success))', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const clearFilters = () => {
    setFSessao('all'); setFLoja('all'); setFFornecedor(''); setFFrom(''); setFTo('');
  };

  const hasFilters = fSessao !== 'all' || fLoja !== 'all' || fFornecedor || fFrom || fTo;

  return (
    <div className={`p-4 sm:p-6 space-y-4 overflow-auto ${className ?? ''}`}>
      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-primary" />
          <span className="font-display font-bold text-sm">Filtros</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div>
            <label className="text-[10px] font-display font-bold text-muted-foreground uppercase">Sessão</label>
            <Select value={fSessao} onValueChange={setFSessao}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {SESSOES.map(s => (
                  <SelectItem key={s.sessao} value={s.sessao}>{s.sessao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-display font-bold text-muted-foreground uppercase">Loja</label>
            <Select value={fLoja} onValueChange={setFLoja}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(LOJAS).map(([num, nome]) => (
                  <SelectItem key={num} value={num}>{num} · {nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-display font-bold text-muted-foreground uppercase">Fornecedor</label>
            <Input value={fFornecedor} onChange={e => setFFornecedor(e.target.value)} placeholder="Nome ou código" className="h-9" />
          </div>
          <div>
            <label className="text-[10px] font-display font-bold text-muted-foreground uppercase">De</label>
            <Input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-[10px] font-display font-bold text-muted-foreground uppercase">Até</label>
            <Input type="date" value={fTo} onChange={e => setFTo(e.target.value)} className="h-9" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-display font-bold uppercase">
            <DollarSign className="w-3.5 h-3.5" /> Valor total
          </div>
          <div className="text-2xl font-display font-bold text-destructive mt-1">{fmtBRL(totalValor)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-display font-bold uppercase">
            <Package className="w-3.5 h-3.5" /> Quantidade
          </div>
          <div className="text-2xl font-display font-bold text-foreground mt-1">
            {totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-display font-bold uppercase">
            <TrendingDown className="w-3.5 h-3.5" /> Registros
          </div>
          <div className="text-2xl font-display font-bold text-foreground mt-1">{totalRegistros}</div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg bg-card">
          <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum dado de avaria encontrado com os filtros atuais.</p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ChartCard title="Avarias por sessão" data={porSessao} colors={colors} />
            <ChartCard title="Avarias por loja" data={porLoja} colors={colors} />
          </div>
          <ChartCard title="Top 15 fornecedores" data={porFornecedor} colors={colors} height={340} />

          {/* Detailed table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-border">
              <span className="font-display font-bold text-sm">Detalhamento por fornecedor</span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-display font-bold">Fornecedor</th>
                    <th className="text-right px-3 py-2 font-display font-bold">Qtd</th>
                    <th className="text-right px-3 py-2 font-display font-bold">Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {porFornecedor.map(f => (
                    <tr key={f.name} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2">{f.name}</td>
                      <td className="text-right px-3 py-2 tabular-nums">
                        {f.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right px-3 py-2 tabular-nums text-destructive font-medium">
                        {fmtBRL(f.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ChartCard: React.FC<{
  title: string;
  data: { name: string; valor: number; qtd: number }[];
  colors: string[];
  height?: number;
}> = ({ title, data, colors, height = 260 }) => (
  <div className="bg-card border border-border rounded-lg p-3">
    <div className="font-display font-bold text-sm mb-2">{title}</div>
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={v => fmtBRL(v).replace('R$', '')} fontSize={10} />
          <YAxis type="category" dataKey="name" width={140} fontSize={10} />
          <Tooltip formatter={(v: number) => fmtBRL(v)} />
          <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default AvariasDashboard;
