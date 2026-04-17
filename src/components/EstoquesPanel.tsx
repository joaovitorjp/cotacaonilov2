import React, { useEffect, useMemo, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Trash2, Upload, Search, FileSpreadsheet, AlertTriangle, Loader2,
  Plus, Minus, ChevronLeft, Settings,
} from 'lucide-react';

interface EstoquesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UploadRow {
  id: string;
  loja: string;
  tipo: 'vendas' | 'estoque';
  referencia: string | null;
  file_path: string;
  file_name: string;
  created_at: string;
}

interface ResultadoRow {
  loja: string;
  codigo_produto: string;
  descricao: string | null;
  estoque_atual: number;
  media_vendas: number;
  dias_cobertura: number | null;
  meses_considerados: number;
}

const MESES = [
  { v: '01', l: 'Janeiro', curto: 'JAN' }, { v: '02', l: 'Fevereiro', curto: 'FEV' },
  { v: '03', l: 'Março', curto: 'MAR' }, { v: '04', l: 'Abril', curto: 'ABR' },
  { v: '05', l: 'Maio', curto: 'MAI' }, { v: '06', l: 'Junho', curto: 'JUN' },
  { v: '07', l: 'Julho', curto: 'JUL' }, { v: '08', l: 'Agosto', curto: 'AGO' },
  { v: '09', l: 'Setembro', curto: 'SET' }, { v: '10', l: 'Outubro', curto: 'OUT' },
  { v: '11', l: 'Novembro', curto: 'NOV' }, { v: '12', l: 'Dezembro', curto: 'DEZ' },
];

const parseNum = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const fmtNum = (n: number, frac = 0) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: frac, maximumFractionDigits: frac });

const EstoquesPanel: React.FC<EstoquesPanelProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const [lojas, setLojas] = useState<string[]>([]);
  const [novaLoja, setNovaLoja] = useState('');
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [resultados, setResultados] = useState<ResultadoRow[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UploadRow | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  // Loja em modo "configuração" (anexar/remover arquivos). null = visão consolidada.
  const [configLoja, setConfigLoja] = useState<string | null>(null);
  const [vendaMes, setVendaMes] = useState<string>('01');

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: ups }, { data: res }] = await Promise.all([
      supabase.from('estoques_uploads').select('*').order('created_at', { ascending: false }),
      supabase.from('estoques_resultados').select('loja, codigo_produto, descricao, estoque_atual, media_vendas, dias_cobertura, meses_considerados'),
    ]);
    const upList = (ups ?? []) as UploadRow[];
    setUploads(upList);
    setResultados((res ?? []) as ResultadoRow[]);
    const lojasUnique = Array.from(new Set(upList.map(u => u.loja))).sort();
    setLojas(lojasUnique);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (open) loadAll(); }, [open, loadAll]);

  const handleAddLoja = () => {
    const code = novaLoja.trim();
    if (!code) return;
    if (lojas.includes(code)) {
      toast.error('Loja já existe.');
      return;
    }
    setLojas(prev => [...prev, code].sort());
    setConfigLoja(code);
    setNovaLoja('');
    toast.success(`Loja "${code}" criada. Anexe os arquivos.`);
  };

  // Recompute that fetches fresh uploads list
  const recomputeWithFresh = async (loja: string) => {
    if (!user) return;
    const { data } = await supabase.from('estoques_uploads').select('*').eq('loja', loja).eq('user_id', user.id);
    const ups = (data ?? []) as UploadRow[];
    const vendasUps = ups.filter(u => u.tipo === 'vendas');
    const estoqueUp = ups.find(u => u.tipo === 'estoque');

    if (!estoqueUp) {
      await supabase.from('estoques_resultados').delete().eq('loja', loja).eq('user_id', user.id);
      const { data: res } = await supabase.from('estoques_resultados').select('loja, codigo_produto, descricao, estoque_atual, media_vendas, dias_cobertura, meses_considerados');
      setResultados((res ?? []) as ResultadoRow[]);
      return;
    }

    const downloadAndParse = async (path: string): Promise<any[][]> => {
      const { data: f, error } = await supabase.storage.from('estoques').download(path);
      if (error || !f) throw new Error('Falha ao baixar ' + path);
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    };

    // Mapas: descrição (col B vendas, col J estoque) e totais por arquivo
    const descMap: Record<string, string> = {};
    const perFileTotals: Record<string, number>[] = [];
    for (const v of vendasUps) {
      const rows = await downloadAndParse(v.file_path);
      const totals: Record<string, number> = {};
      for (const row of rows) {
        const cod = String(row[0] ?? '').trim();
        if (!cod) continue;
        totals[cod] = (totals[cod] ?? 0) + parseNum(row[2]);
        const desc = String(row[1] ?? '').trim();
        if (desc && !descMap[cod]) descMap[cod] = desc;
      }
      perFileTotals.push(totals);
    }

    // Estoque: código col I (idx 8), descrição col J (idx 9), qtd col L (idx 11)
    const stockRows = await downloadAndParse(estoqueUp.file_path);
    const stockMap: Record<string, number> = {};
    for (const row of stockRows) {
      const cod = String(row[8] ?? '').trim();
      if (!cod) continue;
      stockMap[cod] = parseNum(row[11]);
      const desc = String(row[9] ?? '').trim();
      if (desc) descMap[cod] = desc; // estoque tem prioridade na descrição
    }

    const allCodes = new Set<string>();
    Object.keys(stockMap).forEach(c => allCodes.add(c));
    perFileTotals.forEach(t => Object.keys(t).forEach(c => allCodes.add(c)));

    const numFiles = perFileTotals.length;
    const records: any[] = [];
    for (const cod of allCodes) {
      const sum = perFileTotals.reduce((acc, t) => acc + (t[cod] ?? 0), 0);
      const media = numFiles > 0 ? sum / numFiles : 0;
      const stk = stockMap[cod] ?? 0;
      const dias = media > 0 ? (stk * 30) / media : null;
      records.push({
        user_id: user.id, loja, codigo_produto: cod,
        descricao: descMap[cod] ?? null,
        estoque_atual: stk, media_vendas: media,
        dias_cobertura: dias, meses_considerados: numFiles,
      });
    }

    await supabase.from('estoques_resultados').delete().eq('loja', loja).eq('user_id', user.id);
    for (let i = 0; i < records.length; i += 500) {
      await supabase.from('estoques_resultados').insert(records.slice(i, i + 500));
    }
    const { data: res } = await supabase.from('estoques_resultados').select('loja, codigo_produto, descricao, estoque_atual, media_vendas, dias_cobertura, meses_considerados');
    setResultados((res ?? []) as ResultadoRow[]);
    if (records.length > 0) toast.success(`Loja ${loja}: ${records.length} produtos calculados.`);
  };

  const uploadsLoja = useMemo(
    () => configLoja ? uploads.filter(u => u.loja === configLoja) : [],
    [uploads, configLoja]
  );
  const vendasUploads = uploadsLoja.filter(u => u.tipo === 'vendas');
  const estoqueUpload = uploadsLoja.find(u => u.tipo === 'estoque');

  const handleUploadVendas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user || !configLoja) return;
    if (vendasUploads.length >= 3) {
      toast.error('Máximo de 3 arquivos de vendas por loja.');
      return;
    }
    setProcessando(true);
    try {
      const path = `${user.id}/${configLoja}/vendas_${vendaMes}_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('estoques').upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('estoques_uploads').insert({
        user_id: user.id, loja: configLoja, tipo: 'vendas',
        referencia: vendaMes, file_path: path, file_name: file.name,
      });
      if (insErr) throw insErr;
      toast.success('Arquivo de vendas anexado.');
      const { data: fresh } = await supabase.from('estoques_uploads').select('*').eq('loja', configLoja);
      setUploads(prev => {
        const others = prev.filter(p => p.loja !== configLoja);
        return [...others, ...((fresh ?? []) as UploadRow[])];
      });
      await recomputeWithFresh(configLoja);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message ?? 'falha ao enviar'));
    } finally {
      setProcessando(false);
    }
  };

  const handleUploadEstoque = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user || !configLoja) return;
    setProcessando(true);
    try {
      if (estoqueUpload) {
        await supabase.storage.from('estoques').remove([estoqueUpload.file_path]);
        await supabase.from('estoques_uploads').delete().eq('id', estoqueUpload.id);
      }
      const path = `${user.id}/${configLoja}/estoque_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('estoques').upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('estoques_uploads').insert({
        user_id: user.id, loja: configLoja, tipo: 'estoque',
        file_path: path, file_name: file.name,
      });
      if (insErr) throw insErr;
      toast.success('Arquivo de estoque anexado.');
      const { data: fresh } = await supabase.from('estoques_uploads').select('*').eq('loja', configLoja);
      setUploads(prev => {
        const others = prev.filter(p => p.loja !== configLoja);
        return [...others, ...((fresh ?? []) as UploadRow[])];
      });
      await recomputeWithFresh(configLoja);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message ?? 'falha ao enviar'));
    } finally {
      setProcessando(false);
    }
  };

  const handleDeleteUpload = async (u: UploadRow) => {
    setProcessando(true);
    try {
      await supabase.storage.from('estoques').remove([u.file_path]);
      await supabase.from('estoques_uploads').delete().eq('id', u.id);
      toast.success('Arquivo removido.');
      const { data: fresh } = await supabase.from('estoques_uploads').select('*').eq('loja', u.loja);
      setUploads(prev => {
        const others = prev.filter(p => p.loja !== u.loja);
        return [...others, ...((fresh ?? []) as UploadRow[])];
      });
      await recomputeWithFresh(u.loja);
    } catch (err: any) {
      toast.error('Erro ao remover.');
    } finally {
      setProcessando(false);
      setConfirmDelete(null);
    }
  };

  // ============== Visão consolidada por loja ==============
  // Para cada loja: vendas por mês de referência (soma de unidades), média mensal,
  // estoque atual total e dias de cobertura ponderado.
  const consolidado = useMemo(() => {
    // Mapa: loja -> { mesRef -> total unidades }, totalEstoque, totalMediaVendas
    const porLoja: Record<string, {
      vendasPorMes: Record<string, number>;
      mesesUsados: string[]; // meses de referência presentes
      totalEstoque: number;
      totalMediaVendas: number;
      produtos: ResultadoRow[];
    }> = {};

    for (const loja of lojas) {
      porLoja[loja] = {
        vendasPorMes: {},
        mesesUsados: [],
        totalEstoque: 0,
        totalMediaVendas: 0,
        produtos: [],
      };
    }

    // Meses de referência usados por loja (a partir dos uploads)
    for (const u of uploads) {
      if (u.tipo === 'vendas' && u.referencia && porLoja[u.loja]) {
        if (!porLoja[u.loja].mesesUsados.includes(u.referencia)) {
          porLoja[u.loja].mesesUsados.push(u.referencia);
        }
      }
    }
    Object.values(porLoja).forEach(p => p.mesesUsados.sort());

    // Resultados: para totalizar estoque e média
    for (const r of resultados) {
      const p = porLoja[r.loja];
      if (!p) continue;
      p.totalEstoque += Number(r.estoque_atual) || 0;
      p.totalMediaVendas += Number(r.media_vendas) || 0;
      p.produtos.push(r);
    }

    // Vendas por mês: precisamos reler? Não — usamos média_vendas e meses_considerados
    // para reconstruir o total por mês de forma proporcional.
    // Como cada arquivo de mês contribui igual à média (sum/n = média), o total por
    // mês NÃO está armazenado individualmente. Para a UI igual à imagem, usamos a
    // mesma média em cada mês de referência (aproximação fiel ao cálculo atual).
    for (const loja of Object.keys(porLoja)) {
      const p = porLoja[loja];
      const meses = p.mesesUsados.length > 0 ? p.mesesUsados : [];
      meses.forEach(m => { p.vendasPorMes[m] = p.totalMediaVendas; });
    }

    return porLoja;
  }, [lojas, uploads, resultados]);

  // Conjunto de todos os meses presentes em qualquer loja, para colunas dinâmicas
  const mesesColunas = useMemo(() => {
    const set = new Set<string>();
    Object.values(consolidado).forEach(p => p.mesesUsados.forEach(m => set.add(m)));
    return Array.from(set).sort();
  }, [consolidado]);

  const corDias = (d: number | null): string => {
    if (d === null) return 'bg-muted text-muted-foreground';
    if (d < 15) return 'bg-destructive/20 text-destructive font-bold';
    if (d <= 60) return 'bg-success/20 text-success font-bold';
    return 'bg-primary/10 text-primary font-bold';
  };

  const toggleExpand = (loja: string) => {
    setExpandidas(prev => {
      const next = new Set(prev);
      if (next.has(loja)) next.delete(loja); else next.add(loja);
      return next;
    });
  };

  const filtraProdutos = (produtos: ResultadoRow[]) => {
    if (!busca.trim()) return produtos;
    const q = busca.trim().toLowerCase();
    return produtos.filter(r =>
      r.codigo_produto.toLowerCase().includes(q) ||
      (r.descricao ?? '').toLowerCase().includes(q)
    );
  };

  // ============== RENDER ==============
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[1100px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {configLoja ? `Loja ${configLoja} — Configuração` : 'Estoques por Loja'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* ========== MODO CONFIGURAÇÃO DE LOJA ========== */}
          {configLoja && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfigLoja(null)} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Voltar à visão geral
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vendas */}
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-sm">Vendas mensais</h3>
                    <span className="text-xs text-muted-foreground">{vendasUploads.length}/3</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Col A: código · Col B: descrição · Col C: qtd vendida
                  </div>

                  <div className="space-y-1">
                    {vendasUploads.map(u => (
                      <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded text-xs">
                        <span className="font-display font-bold">
                          {MESES.find(m => m.v === u.referencia)?.l ?? u.referencia ?? '—'}
                        </span>
                        <span className="text-muted-foreground truncate flex-1" title={u.file_name}>{u.file_name}</span>
                        <button onClick={() => setConfirmDelete(u)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {vendasUploads.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Nenhum arquivo enviado.</p>
                    )}
                  </div>

                  {vendasUploads.length < 3 && (
                    <div className="flex gap-1 items-center">
                      <Select value={vendaMes} onValueChange={setVendaMes}>
                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MESES.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <label className="flex-1">
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadVendas} disabled={processando} />
                        <span className="cursor-pointer flex items-center justify-center gap-1 px-2 h-8 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 font-display font-bold">
                          <Upload className="w-3 h-3" /> Anexar
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Estoque */}
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <h3 className="font-display font-bold text-sm">Estoque atual</h3>
                  <div className="text-xs text-muted-foreground">
                    Col I: código · Col J: descrição · Col L: qtd em estoque
                  </div>
                  {estoqueUpload ? (
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded text-xs">
                      <span className="text-muted-foreground truncate flex-1" title={estoqueUpload.file_name}>{estoqueUpload.file_name}</span>
                      <button onClick={() => setConfirmDelete(estoqueUpload)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nenhum arquivo enviado.</p>
                  )}
                  <label>
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadEstoque} disabled={processando} />
                    <span className="cursor-pointer flex items-center justify-center gap-1 px-2 h-8 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 font-display font-bold">
                      <Upload className="w-3 h-3" /> {estoqueUpload ? 'Substituir' : 'Anexar'}
                    </span>
                  </label>
                </div>
              </div>

              {processando && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Processando...
                </div>
              )}
            </>
          )}

          {/* ========== VISÃO CONSOLIDADA ========== */}
          {!configLoja && (
            <>
              {/* Top bar: nova loja + busca */}
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-1">
                  <Input
                    placeholder="Código da loja (ex: 02)"
                    value={novaLoja}
                    onChange={e => setNovaLoja(e.target.value)}
                    className="w-44 h-9"
                    onKeyDown={e => e.key === 'Enter' && handleAddLoja()}
                  />
                  <Button size="sm" onClick={handleAddLoja} variant="default">+ Nova loja</Button>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto (código ou descrição)..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="pl-8 w-72 h-9"
                  />
                </div>
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              )}

              {!loading && lojas.length === 0 && (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">Crie sua primeira loja acima.</p>
                </div>
              )}

              {!loading && lojas.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-primary text-primary-foreground">
                        <tr>
                          <th className="px-2 py-2 text-left font-display font-bold w-24">Loja</th>
                          {mesesColunas.map(m => (
                            <th key={m} className="px-3 py-2 text-right font-display font-bold whitespace-nowrap">
                              VENDA {MESES.find(x => x.v === m)?.curto ?? m}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right font-display font-bold whitespace-nowrap">VEND MÉD MENS</th>
                          <th className="px-3 py-2 text-right font-display font-bold whitespace-nowrap">ESTOQUE ATUAL</th>
                          <th className="px-3 py-2 text-center font-display font-bold w-20">DIAS</th>
                          <th className="px-2 py-2 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lojas.map(loja => {
                          const p = consolidado[loja];
                          if (!p) return null;
                          const dias = p.totalMediaVendas > 0 ? (p.totalEstoque * 30) / p.totalMediaVendas : null;
                          const isExpanded = expandidas.has(loja);
                          const produtosFiltrados = filtraProdutos(p.produtos);
                          // Ordena por dias asc (urgência), nulls por último
                          produtosFiltrados.sort((a, b) => {
                            const da = a.dias_cobertura ?? Infinity;
                            const db = b.dias_cobertura ?? Infinity;
                            return da - db;
                          });

                          return (
                            <React.Fragment key={loja}>
                              <tr className="border-t border-border bg-card hover:bg-muted/30">
                                <td className="px-2 py-2 font-display font-bold bg-primary/90 text-primary-foreground">
                                  LOJA {loja}
                                </td>
                                {mesesColunas.map(m => (
                                  <td key={m} className="px-3 py-2 text-right tabular-nums">
                                    {p.vendasPorMes[m] !== undefined ? fmtNum(p.vendasPorMes[m], 0) : '—'}
                                  </td>
                                ))}
                                <td className="px-3 py-2 text-right tabular-nums font-bold">
                                  {fmtNum(p.totalMediaVendas, 0)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-bold">
                                  {fmtNum(p.totalEstoque, 0)}
                                </td>
                                <td className={`px-3 py-2 text-center tabular-nums ${corDias(dias)}`}>
                                  {dias === null ? '—' : `${fmtNum(dias, 1)}`}
                                </td>
                                <td className="px-1 py-1 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => toggleExpand(loja)}
                                      className="w-6 h-6 flex items-center justify-center rounded border border-border hover:bg-primary hover:text-primary-foreground transition-colors"
                                      title={isExpanded ? 'Recolher' : 'Expandir produtos'}
                                    >
                                      {isExpanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={() => setConfigLoja(loja)}
                                      className="w-6 h-6 flex items-center justify-center rounded border border-border hover:bg-primary hover:text-primary-foreground transition-colors"
                                      title="Configurar arquivos"
                                    >
                                      <Settings className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr className="bg-muted/30">
                                  <td colSpan={mesesColunas.length + 5} className="p-0">
                                    <div className="max-h-[400px] overflow-auto">
                                      <table className="w-full text-xs">
                                        <thead className="bg-muted sticky top-0">
                                          <tr>
                                            <th className="px-3 py-1.5 text-left font-display font-bold w-28">Código</th>
                                            <th className="px-3 py-1.5 text-left font-display font-bold">Descrição</th>
                                            <th className="px-3 py-1.5 text-right font-display font-bold">Méd. venda/mês</th>
                                            <th className="px-3 py-1.5 text-right font-display font-bold">Estoque</th>
                                            <th className="px-3 py-1.5 text-center font-display font-bold w-20">Dias</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {produtosFiltrados.length === 0 && (
                                            <tr>
                                              <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                                                {p.produtos.length === 0 ? 'Sem dados — anexe arquivos da loja.' : 'Nenhum produto encontrado.'}
                                              </td>
                                            </tr>
                                          )}
                                          {produtosFiltrados.slice(0, 1000).map(r => (
                                            <tr key={r.codigo_produto} className="border-t border-border hover:bg-card">
                                              <td className="px-3 py-1 font-mono">{r.codigo_produto}</td>
                                              <td className="px-3 py-1 truncate max-w-md" title={r.descricao ?? ''}>{r.descricao ?? '—'}</td>
                                              <td className="px-3 py-1 text-right tabular-nums">{fmtNum(Number(r.media_vendas), 0)}</td>
                                              <td className="px-3 py-1 text-right tabular-nums">{fmtNum(Number(r.estoque_atual), 0)}</td>
                                              <td className={`px-3 py-1 text-center tabular-nums ${corDias(r.dias_cobertura)}`}>
                                                {r.dias_cobertura === null ? '—' : `${fmtNum(Number(r.dias_cobertura), 1)}`}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {produtosFiltrados.length > 1000 && (
                                        <div className="px-3 py-1 text-xs text-muted-foreground bg-card border-t border-border">
                                          Exibindo 1000 de {produtosFiltrados.length}. Use a busca para refinar.
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Legenda */}
              {!loading && lojas.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-destructive/20 border border-destructive" /> &lt; 15 dias (crítico)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-success/20 border border-success" /> 15 a 60 dias (ok)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-primary/10 border border-primary" /> &gt; 60 dias (excesso)
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 font-display">
                <AlertTriangle className="w-5 h-5 text-destructive" /> Remover arquivo?
              </AlertDialogTitle>
              <AlertDialogDescription>
                O arquivo "{confirmDelete?.file_name}" será removido e o cálculo de cobertura recalculado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmDelete && handleDeleteUpload(confirmDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
};

export default EstoquesPanel;
