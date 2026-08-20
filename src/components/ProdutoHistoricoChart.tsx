import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileDown, TrendingUp, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawHeader, drawChips, drawSectionTitle, drawFooter, tableStyles, PDF_COLORS, formatBRL } from '@/lib/pdf-theme';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Produto {
  codigo_interno: string;
  descricao: string;
  codigo_barras?: string;
}

interface Props {
  produto: Produto | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Ponto {
  cotacao: string;
  data: string;
  menor: number;
  maior: number;
  empresaMenor: string;
  empresaMaior: string;
}

const norm = (v: any) => (v === undefined || v === null ? '' : String(v).trim());

const parsePreco = (raw: any): number => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw !== '') return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  return NaN;
};

const findRespItem = (items: any[] | undefined, prod: Produto): any | undefined => {
  if (!items?.length) return undefined;
  const ci = norm(prod.codigo_interno);
  const cb = norm(prod.codigo_barras);
  if (ci) {
    const byCi = items.find((i: any) => norm(i.codigo_interno) === ci);
    if (byCi) return byCi;
  }
  if (cb) {
    const byCb = items.find((i: any) => norm(i.codigo_barras) === cb);
    if (byCb) return byCb;
  }
  return undefined;
};

const ProdutoHistoricoChart: React.FC<Props> = ({ produto, open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [pontos, setPontos] = useState<Ponto[]>([]);

  useEffect(() => {
    if (!open || !produto) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setPontos([]);

      const { data: listas } = await supabase
        .from('listas')
        .select('id, nome, created_at, produtos')
        .order('created_at', { ascending: false })
        .limit(15);

      if (!listas?.length) { if (!cancelled) { setLoading(false); } return; }

      const ids = listas.map(l => l.id);
      const { data: allRespostas } = await supabase
        .from('respostas')
        .select('lista_id, empresa, resposta')
        .in('lista_id', ids);

      const result: Ponto[] = [];

      for (const lista of [...listas].reverse()) {
        const prods = (lista.produtos as any as Produto[]) ?? [];
        const inLista = prods.find(p =>
          (norm(p.codigo_interno) && norm(p.codigo_interno) === norm(produto.codigo_interno)) ||
          (norm(p.codigo_barras) && norm(p.codigo_barras) === norm(produto.codigo_barras)),
        );
        if (!inLista) continue;

        let menor = Infinity, maior = -Infinity, empMenor = '', empMaior = '';
        for (const resp of (allRespostas ?? []).filter(r => r.lista_id === lista.id)) {
          const item = findRespItem(resp.resposta as any[], produto);
          if (!item) continue;
          for (const raw of [item.preco_mt, item.preco_go, item.preco]) {
            const num = parsePreco(raw);
            if (isNaN(num) || num <= 0) continue;
            if (num < menor) { menor = num; empMenor = resp.empresa; }
            if (num > maior) { maior = num; empMaior = resp.empresa; }
          }
        }
        if (menor === Infinity) continue;

        result.push({
          cotacao: lista.nome,
          data: new Date(lista.created_at).toLocaleDateString('pt-BR'),
          menor: Number(menor.toFixed(2)),
          maior: Number(maior.toFixed(2)),
          empresaMenor: empMenor,
          empresaMaior: empMaior,
        });
      }

      if (!cancelled) { setPontos(result); setLoading(false); }
    };

    load();
    return () => { cancelled = true; };
  }, [open, produto]);

  const stats = useMemo(() => {
    if (!pontos.length) return null;
    const menores = pontos.map(p => p.menor);
    const media = menores.reduce((a, b) => a + b, 0) / menores.length;
    const primeiro = menores[0];
    const ultimo = menores[menores.length - 1];
    const variacao = primeiro > 0 ? ((ultimo - primeiro) / primeiro) * 100 : 0;
    return {
      media,
      minimo: Math.min(...menores),
      maximo: Math.max(...pontos.map(p => p.maior)),
      variacao,
    };
  }, [pontos]);

  const exportPDF = () => {
    if (!produto || !pontos.length || !stats) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    let y = drawHeader(doc, {
      title: 'Histórico de Preços do Produto',
      subtitle: produto.descricao || produto.codigo_interno,
      meta: `Código interno: ${produto.codigo_interno}${produto.codigo_barras ? ` · EAN: ${produto.codigo_barras}` : ''}`,
    });

    y = drawChips(doc, y, [
      { label: 'Cotações', value: String(pontos.length), tone: 'primary' },
      { label: 'Menor histórico', value: formatBRL(stats.minimo), tone: 'success' },
      { label: 'Maior histórico', value: formatBRL(stats.maximo), tone: 'danger' },
      { label: 'Média (menores)', value: formatBRL(stats.media) },
      { label: 'Variação', value: `${stats.variacao >= 0 ? '+' : ''}${stats.variacao.toFixed(1)}%`, tone: stats.variacao > 0 ? 'danger' : 'success' },
    ]);

    y = drawSectionTitle(doc, y + 4, 'Projeção de preços cotados') + 4;

    // Gráfico vetorial
    const cx = 14, cw = pw - 28, ch = 70;
    const cy = y;
    doc.setFillColor(...PDF_COLORS.surface);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(cx, cy, cw, ch, 2, 2, 'FD');

    const padL = 22, padR = 6, padT = 8, padB = 14;
    const px0 = cx + padL, py0 = cy + padT;
    const pw2 = cw - padL - padR, ph2 = ch - padT - padB;
    const vals = pontos.flatMap(p => [p.menor, p.maior]);
    const vMin = Math.min(...vals), vMax = Math.max(...vals);
    const span = vMax - vMin || 1;
    const lo = vMin - span * 0.1, hi = vMax + span * 0.1;
    const scaleY = (v: number) => py0 + ph2 - ((v - lo) / (hi - lo)) * ph2;
    const scaleX = (i: number) => pontos.length === 1 ? px0 + pw2 / 2 : px0 + (i / (pontos.length - 1)) * pw2;

    // Grid + eixo Y
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.muted);
    for (let g = 0; g <= 4; g++) {
      const v = lo + ((hi - lo) * g) / 4;
      const gy = scaleY(v);
      doc.setDrawColor(...PDF_COLORS.border);
      doc.setLineWidth(0.15);
      doc.line(px0, gy, px0 + pw2, gy);
      doc.text(formatBRL(v), cx + 2, gy + 1.2);
    }

    const drawSerie = (key: 'menor' | 'maior', color: readonly [number, number, number]) => {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setFillColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.7);
      pontos.forEach((p, i) => {
        const x = scaleX(i), yy = scaleY(p[key]);
        if (i > 0) {
          const xp = scaleX(i - 1), yp = scaleY(pontos[i - 1][key]);
          doc.line(xp, yp, x, yy);
        }
        doc.circle(x, yy, 1, 'F');
      });
    };
    drawSerie('maior', PDF_COLORS.danger);
    drawSerie('menor', PDF_COLORS.success);

    // Eixo X
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_COLORS.muted);
    pontos.forEach((p, i) => {
      const x = scaleX(i);
      const w = doc.getTextWidth(p.data);
      doc.text(p.data, Math.min(Math.max(x - w / 2, cx + 2), cx + cw - w - 2), cy + ch - 4);
    });

    // Legenda
    let lx = px0;
    const legend: [string, readonly [number, number, number]][] = [
      ['Menor preço', PDF_COLORS.success],
      ['Maior preço', PDF_COLORS.danger],
    ];
    doc.setFontSize(7.5);
    legend.forEach(([label, color]) => {
      doc.setFillColor(color[0], color[1], color[2]);
      doc.circle(lx, cy + ch + 5, 1.2, 'F');
      doc.setTextColor(...PDF_COLORS.body);
      doc.text(label, lx + 3, cy + ch + 6);
      lx += doc.getTextWidth(label) + 14;
    });

    autoTable(doc, {
      startY: cy + ch + 11,
      head: [['Cotação', 'Data', 'Menor preço', 'Fornecedor (menor)', 'Maior preço', 'Fornecedor (maior)']],
      body: pontos.map(p => [p.cotacao, p.data, formatBRL(p.menor), p.empresaMenor || '—', formatBRL(p.maior), p.empresaMaior || '—']),
      ...tableStyles,
    });

    drawFooter(doc);
    doc.save(`historico_${(produto.codigo_interno || 'produto').replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Histórico de preços
          </DialogTitle>
          <DialogDescription>
            {produto ? `${produto.descricao || 'Produto'} · ${produto.codigo_interno}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando histórico...
          </div>
        ) : pontos.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            Nenhum preço cotado encontrado para este produto no histórico de cotações.
          </div>
        ) : (
          <>
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Menor histórico', value: stats.minimo, cls: 'text-emerald-600' },
                  { label: 'Maior histórico', value: stats.maximo, cls: 'text-destructive' },
                  { label: 'Média (menores)', value: stats.media, cls: 'text-foreground' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg border border-border bg-muted/40 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                    <p className={`text-sm font-bold ${s.cls}`}>{formatBRL(s.value)}</p>
                  </div>
                ))}
                <div className="rounded-lg border border-border bg-muted/40 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Variação</p>
                  <p className={`text-sm font-bold ${stats.variacao > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                    {stats.variacao >= 0 ? '+' : ''}{stats.variacao.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pontos} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={70}
                    tickFormatter={(v: number) => formatBRL(v)} />
                  <Tooltip
                    formatter={(v: any, name: string) => [formatBRL(Number(v)), name === 'menor' ? 'Menor preço' : 'Maior preço']}
                    labelFormatter={(l: string, payload: any) => payload?.[0]?.payload?.cotacao ?? l}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend formatter={(v: string) => (v === 'menor' ? 'Menor preço' : 'Maior preço')} />
                  <Line type="monotone" dataKey="maior" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="menor" stroke="hsl(142 71% 40%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-end">
              <Button onClick={exportPDF} size="sm" className="gap-2">
                <FileDown className="w-4 h-4" /> Baixar gráfico em PDF
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProdutoHistoricoChart;
