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
import { Trash2, Upload, Search, FileSpreadsheet, AlertTriangle, Loader2 } from 'lucide-react';

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
  codigo_produto: string;
  estoque_atual: number;
  media_vendas: number;
  dias_cobertura: number | null;
  meses_considerados: number;
}

const MESES = [
  { v: '01', l: 'Janeiro' }, { v: '02', l: 'Fevereiro' }, { v: '03', l: 'Março' },
  { v: '04', l: 'Abril' }, { v: '05', l: 'Maio' }, { v: '06', l: 'Junho' },
  { v: '07', l: 'Julho' }, { v: '08', l: 'Agosto' }, { v: '09', l: 'Setembro' },
  { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro' }, { v: '12', l: 'Dezembro' },
];

const parseNum = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const EstoquesPanel: React.FC<EstoquesPanelProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const [lojas, setLojas] = useState<string[]>([]);
  const [selectedLoja, setSelectedLoja] = useState<string>('');
  const [novaLoja, setNovaLoja] = useState('');
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [resultados, setResultados] = useState<ResultadoRow[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UploadRow | null>(null);

  // Form state for upload
  const [vendaMes, setVendaMes] = useState<string>('01');

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: ups } = await supabase
      .from('estoques_uploads')
      .select('*')
      .order('created_at', { ascending: false });
    const list = (ups ?? []) as UploadRow[];
    setUploads(list);
    const lojasUnique = Array.from(new Set(list.map(u => u.loja))).sort();
    setLojas(lojasUnique);
    if (!selectedLoja && lojasUnique.length > 0) {
      setSelectedLoja(lojasUnique[0]);
    }
    setLoading(false);
  }, [user, selectedLoja]);

  const loadResultados = useCallback(async (loja: string) => {
    if (!user || !loja) {
      setResultados([]);
      return;
    }
    const { data } = await supabase
      .from('estoques_resultados')
      .select('codigo_produto, estoque_atual, media_vendas, dias_cobertura, meses_considerados')
      .eq('loja', loja)
      .order('dias_cobertura', { ascending: true, nullsFirst: false });
    setResultados((data ?? []) as ResultadoRow[]);
  }, [user]);

  useEffect(() => {
    if (open) loadAll();
  }, [open, loadAll]);

  useEffect(() => {
    if (selectedLoja) loadResultados(selectedLoja);
  }, [selectedLoja, loadResultados]);

  const uploadsLoja = useMemo(
    () => uploads.filter(u => u.loja === selectedLoja),
    [uploads, selectedLoja]
  );
  const vendasUploads = uploadsLoja.filter(u => u.tipo === 'vendas');
  const estoqueUpload = uploadsLoja.find(u => u.tipo === 'estoque');

  const handleAddLoja = () => {
    const code = novaLoja.trim();
    if (!code) return;
    if (lojas.includes(code)) {
      toast.error('Loja já existe.');
      return;
    }
    setLojas(prev => [...prev, code].sort());
    setSelectedLoja(code);
    setNovaLoja('');
    toast.success(`Loja "${code}" criada. Anexe os arquivos abaixo.`);
  };

  // Read a sheet, return rows of values starting from row 1 (no header skip)
  const readXlsxRows = async (file: File): Promise<any[][]> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  };

  const recompute = async (loja: string) => {
    if (!user) return;
    // Load all uploads for this store
    const ups = uploads.filter(u => u.loja === loja);
    const vendasUps = ups.filter(u => u.tipo === 'vendas');
    const estoqueUp = ups.find(u => u.tipo === 'estoque');

    if (!estoqueUp) {
      // Cannot calculate without stock file
      await supabase.from('estoques_resultados').delete().eq('loja', loja).eq('user_id', user.id);
      setResultados([]);
      return;
    }

    // Helper to download + parse
    const downloadAndParse = async (path: string): Promise<any[][]> => {
      const { data, error } = await supabase.storage.from('estoques').download(path);
      if (error || !data) throw new Error('Falha ao baixar ' + path);
      const buf = await data.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    };

    // Sales: aggregate per código (sum) per file, then average across files
    // codigo from column A (idx 0), qty from column C (idx 2)
    const perFileTotals: Record<string, number>[] = [];
    for (const v of vendasUps) {
      const rows = await downloadAndParse(v.file_path);
      const totals: Record<string, number> = {};
      for (const row of rows) {
        const cod = String(row[0] ?? '').trim();
        if (!cod) continue;
        const qty = parseNum(row[2]);
        totals[cod] = (totals[cod] ?? 0) + qty;
      }
      perFileTotals.push(totals);
    }

    // Stock: codigo from column I (idx 8), qty from column L (idx 11)
    const stockRows = await downloadAndParse(estoqueUp.file_path);
    const stockMap: Record<string, number> = {};
    for (const row of stockRows) {
      const cod = String(row[8] ?? '').trim();
      if (!cod) continue;
      stockMap[cod] = parseNum(row[11]);
    }

    // Merge: union of all codes
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
        user_id: user.id,
        loja,
        codigo_produto: cod,
        estoque_atual: stk,
        media_vendas: media,
        dias_cobertura: dias,
        meses_considerados: numFiles,
        updated_at: new Date().toISOString(),
      });
    }

    // Replace results for this store
    await supabase.from('estoques_resultados').delete().eq('loja', loja).eq('user_id', user.id);
    if (records.length > 0) {
      // Insert in chunks of 500
      for (let i = 0; i < records.length; i += 500) {
        await supabase.from('estoques_resultados').insert(records.slice(i, i + 500));
      }
    }
    await loadResultados(loja);
  };

  const handleUploadVendas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user || !selectedLoja) return;
    if (vendasUploads.length >= 3) {
      toast.error('Máximo de 3 arquivos de vendas por loja.');
      return;
    }
    setProcessando(true);
    try {
      const path = `${user.id}/${selectedLoja}/vendas_${vendaMes}_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('estoques').upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('estoques_uploads').insert({
        user_id: user.id, loja: selectedLoja, tipo: 'vendas',
        referencia: vendaMes, file_path: path, file_name: file.name,
      });
      if (insErr) throw insErr;
      toast.success('Arquivo de vendas anexado.');
      await loadAll();
      // Recompute after reloading uploads
      const newUps = [...uploads, { id: '', loja: selectedLoja, tipo: 'vendas' as const, referencia: vendaMes, file_path: path, file_name: file.name, created_at: '' }];
      // Use the actual fresh fetch
      const { data: fresh } = await supabase.from('estoques_uploads').select('*').eq('loja', selectedLoja);
      setUploads(prev => {
        const others = prev.filter(p => p.loja !== selectedLoja);
        return [...others, ...((fresh ?? []) as UploadRow[])];
      });
      await recomputeWithFresh(selectedLoja);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message ?? 'falha ao enviar'));
    } finally {
      setProcessando(false);
    }
  };

  const handleUploadEstoque = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user || !selectedLoja) return;
    setProcessando(true);
    try {
      // Replace existing stock file if any
      if (estoqueUpload) {
        await supabase.storage.from('estoques').remove([estoqueUpload.file_path]);
        await supabase.from('estoques_uploads').delete().eq('id', estoqueUpload.id);
      }
      const path = `${user.id}/${selectedLoja}/estoque_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('estoques').upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('estoques_uploads').insert({
        user_id: user.id, loja: selectedLoja, tipo: 'estoque',
        file_path: path, file_name: file.name,
      });
      if (insErr) throw insErr;
      toast.success('Arquivo de estoque anexado.');
      const { data: fresh } = await supabase.from('estoques_uploads').select('*').eq('loja', selectedLoja);
      setUploads(prev => {
        const others = prev.filter(p => p.loja !== selectedLoja);
        return [...others, ...((fresh ?? []) as UploadRow[])];
      });
      await recomputeWithFresh(selectedLoja);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message ?? 'falha ao enviar'));
    } finally {
      setProcessando(false);
    }
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
      setResultados([]);
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

    const perFileTotals: Record<string, number>[] = [];
    for (const v of vendasUps) {
      const rows = await downloadAndParse(v.file_path);
      const totals: Record<string, number> = {};
      for (const row of rows) {
        const cod = String(row[0] ?? '').trim();
        if (!cod) continue;
        totals[cod] = (totals[cod] ?? 0) + parseNum(row[2]);
      }
      perFileTotals.push(totals);
    }

    const stockRows = await downloadAndParse(estoqueUp.file_path);
    const stockMap: Record<string, number> = {};
    for (const row of stockRows) {
      const cod = String(row[8] ?? '').trim();
      if (!cod) continue;
      stockMap[cod] = parseNum(row[11]);
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
        estoque_atual: stk, media_vendas: media,
        dias_cobertura: dias, meses_considerados: numFiles,
      });
    }

    await supabase.from('estoques_resultados').delete().eq('loja', loja).eq('user_id', user.id);
    for (let i = 0; i < records.length; i += 500) {
      await supabase.from('estoques_resultados').insert(records.slice(i, i + 500));
    }
    await loadResultados(loja);
    if (records.length > 0) {
      toast.success(`Cálculo atualizado: ${records.length} produtos.`);
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

  const filteredResultados = useMemo(() => {
    if (!busca.trim()) return resultados;
    const q = busca.trim().toLowerCase();
    return resultados.filter(r => r.codigo_produto.toLowerCase().includes(q));
  }, [resultados, busca]);

  const stats = useMemo(() => {
    const total = resultados.length;
    const critico = resultados.filter(r => r.dias_cobertura !== null && r.dias_cobertura < 15).length;
    const ok = resultados.filter(r => r.dias_cobertura !== null && r.dias_cobertura >= 15 && r.dias_cobertura <= 60).length;
    const excesso = resultados.filter(r => r.dias_cobertura !== null && r.dias_cobertura > 60).length;
    const semVenda = resultados.filter(r => r.dias_cobertura === null).length;
    return { total, critico, ok, excesso, semVenda };
  }, [resultados]);

  const corDias = (d: number | null): string => {
    if (d === null) return 'text-muted-foreground';
    if (d < 15) return 'text-destructive font-bold';
    if (d <= 60) return 'text-success font-bold';
    return 'text-primary';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Estoques por Loja
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Loja selector */}
          <div className="space-y-3">
            <Label className="text-sm font-display font-bold">Loja</Label>
            <div className="flex gap-2 flex-wrap">
              <Select value={selectedLoja} onValueChange={setSelectedLoja}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Selecionar loja" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.map(l => (
                    <SelectItem key={l} value={l}>Loja {l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                <Input
                  placeholder="Código (ex: 02)"
                  value={novaLoja}
                  onChange={e => setNovaLoja(e.target.value)}
                  className="w-32"
                  onKeyDown={e => e.key === 'Enter' && handleAddLoja()}
                />
                <Button size="sm" onClick={handleAddLoja} variant="outline">+ Loja</Button>
              </div>
            </div>
          </div>

          {selectedLoja && (
            <>
              {/* Uploads */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vendas */}
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-sm">Vendas mensais</h3>
                    <span className="text-xs text-muted-foreground">{vendasUploads.length}/3</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Coluna A: código · Coluna C: qtd vendida
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
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MESES.map(m => (
                            <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
                          ))}
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
                    Coluna I: código · Coluna L: qtd em estoque
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

              {/* Stats */}
              {stats.total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                  <div className="bg-muted/40 rounded p-2">
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-display font-bold text-base">{stats.total}</p>
                  </div>
                  <div className="bg-destructive/10 rounded p-2">
                    <p className="text-destructive">Crítico (&lt;15d)</p>
                    <p className="font-display font-bold text-base text-destructive">{stats.critico}</p>
                  </div>
                  <div className="bg-success/10 rounded p-2">
                    <p className="text-success">OK (15-60d)</p>
                    <p className="font-display font-bold text-base text-success">{stats.ok}</p>
                  </div>
                  <div className="bg-primary/10 rounded p-2">
                    <p className="text-primary">Excesso (&gt;60d)</p>
                    <p className="font-display font-bold text-base text-primary">{stats.excesso}</p>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <p className="text-muted-foreground">Sem venda</p>
                    <p className="font-display font-bold text-base">{stats.semVenda}</p>
                  </div>
                </div>
              )}

              {/* Search + table */}
              {stats.total > 0 && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Pesquisar código do produto..."
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="max-h-[400px] overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-display font-bold">Código</th>
                            <th className="px-3 py-2 text-right font-display font-bold">Estoque</th>
                            <th className="px-3 py-2 text-right font-display font-bold">Média venda/mês</th>
                            <th className="px-3 py-2 text-right font-display font-bold">Dias cobertura</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredResultados.slice(0, 500).map(r => (
                            <tr key={r.codigo_produto} className="border-t border-border hover:bg-muted/30">
                              <td className="px-3 py-1.5 font-mono">{r.codigo_produto}</td>
                              <td className="px-3 py-1.5 text-right">{r.estoque_atual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                              <td className="px-3 py-1.5 text-right">{r.media_vendas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                              <td className={`px-3 py-1.5 text-right ${corDias(r.dias_cobertura)}`}>
                                {r.dias_cobertura === null ? '—' : `${Math.round(r.dias_cobertura)}d`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredResultados.length > 500 && (
                      <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                        Exibindo 500 de {filteredResultados.length}. Use a busca para refinar.
                      </div>
                    )}
                    {filteredResultados.length === 0 && (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Nenhum produto encontrado.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {stats.total === 0 && !loading && (
                <div className="text-center py-8 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
                  Anexe pelo menos 1 arquivo de vendas e o arquivo de estoque para ver o cálculo.
                </div>
              )}
            </>
          )}

          {!selectedLoja && lojas.length === 0 && (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <p className="text-sm text-muted-foreground">Crie sua primeira loja acima.</p>
            </div>
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
