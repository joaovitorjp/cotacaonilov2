import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { FileSpreadsheet, Loader2, Save, RotateCcw } from 'lucide-react';

interface EstoquesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Lojas fixas conforme solicitado
const LOJAS_FIXAS = ['09', '02', '01', '05', '07', '10', '08'];

const MESES = [
  { v: 1, l: 'Janeiro', curto: 'JAN' },
  { v: 2, l: 'Fevereiro', curto: 'FEV' },
  { v: 3, l: 'Março', curto: 'MAR' },
  { v: 4, l: 'Abril', curto: 'ABR' },
  { v: 5, l: 'Maio', curto: 'MAI' },
  { v: 6, l: 'Junho', curto: 'JUN' },
  { v: 7, l: 'Julho', curto: 'JUL' },
  { v: 8, l: 'Agosto', curto: 'AGO' },
  { v: 9, l: 'Setembro', curto: 'SET' },
  { v: 10, l: 'Outubro', curto: 'OUT' },
  { v: 11, l: 'Novembro', curto: 'NOV' },
  { v: 12, l: 'Dezembro', curto: 'DEZ' },
];

interface ManualRow {
  id?: string;
  loja: string;
  mes: number;
  venda: number;
  estoque: number;
}

// Chave: loja|mes
const k = (loja: string, mes: number) => `${loja}|${mes}`;

// Parse "1.234,56" ou "1234.56" → number
const parseBR = (v: string): number => {
  if (!v) return 0;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s) return 0;
  // Se tem vírgula, assumir formato BR
  if (s.includes(',')) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const fmtBR = (n: number, frac = 0) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: frac, maximumFractionDigits: frac });

const corDias = (d: number | null): string => {
  if (d === null) return 'bg-muted text-muted-foreground';
  if (d < 15) return 'bg-destructive/20 text-destructive font-bold';
  if (d <= 60) return 'bg-success/20 text-success font-bold';
  return 'bg-primary/10 text-primary font-bold';
};

const EstoquesPanel: React.FC<EstoquesPanelProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Quais 3 meses serão exibidos como colunas (default: 3 últimos meses do ano corrente)
  const [mesesSel, setMesesSel] = useState<number[]>(() => {
    const now = new Date();
    const m = now.getMonth() + 1; // 1-12
    const mes3 = m;
    const mes2 = m === 1 ? 12 : m - 1;
    const mes1 = mes2 === 1 ? 12 : mes2 - 1;
    return [mes1, mes2, mes3];
  });

  // Mapa de valores: chave loja|mes → { venda, estoque, id? }
  const [dados, setDados] = useState<Record<string, ManualRow>>({});
  // Buffer de edição (texto cru por campo) para permitir digitar vírgula
  const [editVenda, setEditVenda] = useState<Record<string, string>>({});
  const [editEstoque, setEditEstoque] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('estoques_manuais')
      .select('id, loja, mes, venda, estoque')
      .eq('user_id', user.id);
    if (error) {
      toast.error('Erro ao carregar dados.');
      setLoading(false);
      return;
    }
    const map: Record<string, ManualRow> = {};
    for (const r of data ?? []) {
      map[k(r.loja, r.mes)] = {
        id: r.id,
        loja: r.loja,
        mes: r.mes,
        venda: Number(r.venda) || 0,
        estoque: Number(r.estoque) || 0,
      };
    }
    setDados(map);
    setEditVenda({});
    setEditEstoque({});
    setDirty(new Set());
    setLoading(false);
  }, [user]);

  useEffect(() => { if (open) loadAll(); }, [open, loadAll]);

  const getVendaDisplay = (loja: string, mes: number): string => {
    const key = k(loja, mes);
    if (editVenda[key] !== undefined) return editVenda[key];
    const row = dados[key];
    return row && row.venda > 0 ? fmtBR(row.venda, 0) : '';
  };
  const getEstoqueDisplay = (loja: string, mes: number): string => {
    const key = k(loja, mes);
    if (editEstoque[key] !== undefined) return editEstoque[key];
    const row = dados[key];
    return row && row.estoque > 0 ? fmtBR(row.estoque, 0) : '';
  };

  const handleVendaChange = (loja: string, mes: number, val: string) => {
    const key = k(loja, mes);
    setEditVenda(prev => ({ ...prev, [key]: val }));
    setDirty(prev => new Set(prev).add(key));
  };
  const handleEstoqueChange = (loja: string, mes: number, val: string) => {
    const key = k(loja, mes);
    setEditEstoque(prev => ({ ...prev, [key]: val }));
    setDirty(prev => new Set(prev).add(key));
  };

  const handleVendaBlur = (loja: string, mes: number) => {
    const key = k(loja, mes);
    const raw = editVenda[key];
    if (raw === undefined) return;
    const num = parseBR(raw);
    setDados(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { loja, mes, venda: 0, estoque: 0 }), loja, mes, venda: num },
    }));
    setEditVenda(prev => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };
  const handleEstoqueBlur = (loja: string, mes: number) => {
    const key = k(loja, mes);
    const raw = editEstoque[key];
    if (raw === undefined) return;
    const num = parseBR(raw);
    setDados(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { loja, mes, venda: 0, estoque: 0 }), loja, mes, estoque: num },
    }));
    setEditEstoque(prev => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  // Cálculos por loja
  const calcLoja = (loja: string) => {
    const valores = mesesSel.map(m => dados[k(loja, m)]).filter(Boolean) as ManualRow[];
    const vendasComValor = valores.filter(v => v.venda > 0);
    const mediaVenda = vendasComValor.length > 0
      ? vendasComValor.reduce((s, v) => s + v.venda, 0) / vendasComValor.length
      : 0;
    // Estoque atual = estoque do MAIOR mês selecionado que tenha valor > 0
    const mesesOrdDesc = [...mesesSel].sort((a, b) => b - a);
    let estoqueAtual = 0;
    for (const m of mesesOrdDesc) {
      const r = dados[k(loja, m)];
      if (r && r.estoque > 0) { estoqueAtual = r.estoque; break; }
    }
    const dias = mediaVenda > 0 ? (estoqueAtual * 30) / mediaVenda : null;
    return { mediaVenda, estoqueAtual, dias };
  };

  const handleSalvar = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Aplica buffer de edição pendente
      const finalDados = { ...dados };
      for (const key of Object.keys(editVenda)) {
        const [loja, mesStr] = key.split('|');
        const mes = Number(mesStr);
        finalDados[key] = {
          ...(finalDados[key] ?? { loja, mes, venda: 0, estoque: 0 }),
          loja, mes,
          venda: parseBR(editVenda[key]),
        };
      }
      for (const key of Object.keys(editEstoque)) {
        const [loja, mesStr] = key.split('|');
        const mes = Number(mesStr);
        finalDados[key] = {
          ...(finalDados[key] ?? { loja, mes, venda: 0, estoque: 0 }),
          loja, mes,
          estoque: parseBR(editEstoque[key]),
        };
      }

      // Apenas linhas modificadas (dirty) ou que tenham algum valor
      const toUpsert: any[] = [];
      const toDelete: string[] = [];
      for (const key of dirty) {
        const r = finalDados[key];
        if (!r) continue;
        if (r.venda === 0 && r.estoque === 0) {
          if (r.id) toDelete.push(r.id);
        } else {
          toUpsert.push({
            ...(r.id ? { id: r.id } : {}),
            user_id: user.id,
            loja: r.loja,
            mes: r.mes,
            venda: r.venda,
            estoque: r.estoque,
          });
        }
      }

      if (toDelete.length > 0) {
        const { error } = await supabase.from('estoques_manuais').delete().in('id', toDelete);
        if (error) throw error;
      }
      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from('estoques_manuais')
          .upsert(toUpsert, { onConflict: 'user_id,loja,mes' });
        if (error) throw error;
      }

      toast.success('Dados salvos.');
      await loadAll();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message ?? 'desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDescartar = () => {
    setEditVenda({});
    setEditEstoque({});
    setDirty(new Set());
    toast.info('Alterações descartadas.');
  };

  const handleMesChange = (idx: number, novoMes: number) => {
    setMesesSel(prev => {
      const n = [...prev];
      n[idx] = novoMes;
      return n;
    });
  };

  const temPendentes = dirty.size > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[1000px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Estoques por Loja
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Seletor de meses */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-display font-bold text-muted-foreground">Meses exibidos:</span>
            {mesesSel.map((m, idx) => (
              <select
                key={idx}
                value={m}
                onChange={e => handleMesChange(idx, Number(e.target.value))}
                className="h-8 px-2 text-xs rounded border border-border bg-background"
              >
                {MESES.map(mm => (
                  <option key={mm.v} value={mm.v}>{mm.l}</option>
                ))}
              </select>
            ))}
            <div className="flex-1" />
            {temPendentes && (
              <Button variant="outline" size="sm" onClick={handleDescartar} disabled={saving} className="gap-1">
                <RotateCcw className="w-3 h-3" /> Descartar
              </Button>
            )}
            <Button onClick={handleSalvar} disabled={!temPendentes || saving} size="sm" className="gap-1">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Salvar {temPendentes ? `(${dirty.size})` : ''}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-primary text-primary-foreground">
                    <tr>
                      <th rowSpan={2} className="px-2 py-2 text-left font-display font-bold w-24 align-middle border-r border-primary-foreground/20">
                        LOJA
                      </th>
                      {mesesSel.map((m, idx) => (
                        <th key={idx} colSpan={2} className="px-3 py-1 text-center font-display font-bold whitespace-nowrap border-r border-primary-foreground/20">
                          {MESES.find(x => x.v === m)?.l.toUpperCase() ?? m}
                        </th>
                      ))}
                      <th rowSpan={2} className="px-3 py-2 text-right font-display font-bold whitespace-nowrap align-middle">
                        VEND.<br/>MÉDIA
                      </th>
                      <th rowSpan={2} className="px-3 py-2 text-right font-display font-bold whitespace-nowrap align-middle">
                        ESTOQUE<br/>ATUAL
                      </th>
                      <th rowSpan={2} className="px-3 py-2 text-center font-display font-bold w-20 align-middle">
                        DIAS
                      </th>
                    </tr>
                    <tr className="text-[10px] bg-primary/80">
                      {mesesSel.map((_, idx) => (
                        <React.Fragment key={idx}>
                          <th className="px-2 py-1 font-display font-bold border-r border-primary-foreground/10">VENDA</th>
                          <th className="px-2 py-1 font-display font-bold border-r border-primary-foreground/20">ESTOQUE</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LOJAS_FIXAS.map(loja => {
                      const { mediaVenda, estoqueAtual, dias } = calcLoja(loja);
                      return (
                        <tr key={loja} className="border-t border-border hover:bg-muted/30">
                          <td className="px-2 py-1 font-display font-bold bg-primary/90 text-primary-foreground">
                            LOJA {loja}
                          </td>
                          {mesesSel.map((m, idx) => {
                            const key = k(loja, m);
                            const isDirty = dirty.has(key);
                            return (
                              <React.Fragment key={idx}>
                                <td className="px-1 py-0.5 border-r border-border/50">
                                  <Input
                                    value={getVendaDisplay(loja, m)}
                                    onChange={e => handleVendaChange(loja, m, e.target.value)}
                                    onBlur={() => handleVendaBlur(loja, m)}
                                    placeholder="0"
                                    className={`h-7 text-right tabular-nums text-xs px-1.5 ${isDirty ? 'border-primary' : ''}`}
                                    inputMode="decimal"
                                  />
                                </td>
                                <td className="px-1 py-0.5 border-r border-border">
                                  <Input
                                    value={getEstoqueDisplay(loja, m)}
                                    onChange={e => handleEstoqueChange(loja, m, e.target.value)}
                                    onBlur={() => handleEstoqueBlur(loja, m)}
                                    placeholder="0"
                                    className={`h-7 text-right tabular-nums text-xs px-1.5 ${isDirty ? 'border-primary' : ''}`}
                                    inputMode="decimal"
                                  />
                                </td>
                              </React.Fragment>
                            );
                          })}
                          <td className="px-3 py-1 text-right tabular-nums font-bold bg-muted/40">
                            {mediaVenda > 0 ? fmtBR(mediaVenda, 0) : '—'}
                          </td>
                          <td className="px-3 py-1 text-right tabular-nums font-bold bg-muted/40">
                            {estoqueAtual > 0 ? fmtBR(estoqueAtual, 0) : '—'}
                          </td>
                          <td className={`px-3 py-1 text-center tabular-nums ${corDias(dias)}`}>
                            {dias === null ? '—' : fmtBR(dias, 1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Legenda + fórmula */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
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
            <span className="italic">Dias = (Estoque atual × 30) ÷ Venda média mensal</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EstoquesPanel;
