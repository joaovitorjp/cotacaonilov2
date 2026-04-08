import React, { useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Trophy, TrendingDown, History, FileDown, Send } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Produto {
  codigo_interno: string;
  descricao: string;
  codigo_barras: string;
  categoria?: string;
  observacao?: string;
}

interface RespostaEmpresa {
  empresa: string;
  resposta: { codigo_interno: string; preco?: number | string; preco_mt?: number | string; preco_go?: number | string }[];
}

interface AnalisePrecosPanelProps {
  produtos: Produto[];
  respostas: RespostaEmpresa[];
  listaNome?: string;
}

const parsePreco = (raw: number | string): number => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw !== '') return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  return NaN;
};

interface HistoricoItem {
  listaNome: string;
  data: string;
  menorPreco: number;
  empresa: string;
}

const AnalisePrecosPanel: React.FC<AnalisePrecosPanelProps> = ({ produtos, respostas, listaNome }) => {
  const [historico, setHistorico] = useState<Record<string, HistoricoItem[]>>({});
  const [showHistorico, setShowHistorico] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const loadHistorico = async () => {
    if (Object.keys(historico).length > 0) {
      setShowHistorico(!showHistorico);
      return;
    }
    setLoadingHistorico(true);
    
    const { data: listas } = await supabase
      .from('listas')
      .select('id, nome, created_at, produtos')
      .eq('status', 'finalizada')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!listas || listas.length === 0) {
      setLoadingHistorico(false);
      setShowHistorico(true);
      return;
    }

    const ids = listas.map(l => l.id);
    const { data: allRespostas } = await supabase
      .from('respostas')
      .select('lista_id, empresa, resposta')
      .in('lista_id', ids);

    const hist: Record<string, HistoricoItem[]> = {};

    for (const lista of listas) {
      const listaResps = (allRespostas ?? []).filter(r => r.lista_id === lista.id);
      const prods = lista.produtos as any as Produto[];

      for (const prod of prods) {
        let lowestPrice = Infinity;
        let lowestEmpresa = '';

        for (const resp of listaResps) {
          const items = resp.resposta as any[];
          const item = items.find((i: any) => i.codigo_interno === prod.codigo_interno);
          if (item) {
            const num = parsePreco(item.preco_mt ?? item.preco);
            if (!isNaN(num) && num > 0 && num < lowestPrice) {
              lowestPrice = num;
              lowestEmpresa = resp.empresa;
            }
          }
        }

        if (lowestPrice !== Infinity) {
          if (!hist[prod.codigo_interno]) hist[prod.codigo_interno] = [];
          hist[prod.codigo_interno].push({
            listaNome: lista.nome,
            data: new Date(lista.created_at).toLocaleDateString('pt-BR'),
            menorPreco: lowestPrice,
            empresa: lowestEmpresa,
          });
        }
      }
    }

    setHistorico(hist);
    setShowHistorico(true);
    setLoadingHistorico(false);
  };

  const analysis = useMemo(() => {
    if (respostas.length === 0) return null;

    const empresas = respostas.map(r => r.empresa);
    let totalByEmpresa: Record<string, { total: number; count: number; wins: number }> = {};
    empresas.forEach(e => { totalByEmpresa[e] = { total: 0, count: 0, wins: 0 }; });

    const prodAnalysis = produtos.map(prod => {
      const prices: { empresa: string; preco: number }[] = [];
      for (const resp of respostas) {
        const item = resp.resposta.find((i: any) => i.codigo_interno === prod.codigo_interno);
        if (item) {
          const num = parsePreco(item.preco_mt ?? item.preco);
          if (!isNaN(num) && num > 0) {
            prices.push({ empresa: resp.empresa, preco: num });
            totalByEmpresa[resp.empresa].total += num;
            totalByEmpresa[resp.empresa].count++;
          }
        }
      }

      prices.sort((a, b) => a.preco - b.preco);
      const winner = prices[0] || null;
      if (winner) totalByEmpresa[winner.empresa].wins++;

      const avg = prices.length > 0 ? prices.reduce((s, p) => s + p.preco, 0) / prices.length : 0;
      const max = prices.length > 0 ? prices[prices.length - 1].preco : 0;
      const savings = max > 0 && winner ? ((max - winner.preco) / max * 100) : 0;

      return { prod, prices, winner, avg, savings };
    });

    const ranking = Object.entries(totalByEmpresa)
      .map(([empresa, data]) => ({
        empresa,
        wins: data.wins,
        avgPrice: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => b.wins - a.wins);

    const totalSavings = prodAnalysis.reduce((s, p) => {
      if (p.prices.length > 1 && p.winner) {
        const highest = p.prices[p.prices.length - 1].preco;
        return s + (highest - p.winner.preco);
      }
      return s;
    }, 0);

    return { prodAnalysis, ranking, totalSavings };
  }, [produtos, respostas]);

  // PDF Export
  const exportPDF = () => {
    if (!analysis) return;

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const empresas = respostas.map(r => r.empresa);

    // Title
    doc.setFontSize(16);
    doc.text(`Análise de Preços${listaNome ? ` - ${listaNome}` : ''}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 22);
    doc.text(`${respostas.length} fornecedor(es) · ${produtos.length} produto(s)`, 14, 27);

    // Summary
    doc.setFontSize(12);
    doc.text('Resumo', 14, 36);
    doc.setFontSize(10);
    doc.text(`Melhor fornecedor: ${analysis.ranking[0]?.empresa || '-'} (${analysis.ranking[0]?.wins || 0} itens com menor preço)`, 14, 42);
    doc.text(`Economia potencial: R$ ${analysis.totalSavings.toFixed(2).replace('.', ',')}`, 14, 48);

    // Ranking table
    autoTable(doc, {
      startY: 54,
      head: [['#', 'Fornecedor', 'Vitórias', 'Preço Médio']],
      body: analysis.ranking.map((r, idx) => [
        `${idx + 1}º`,
        r.empresa,
        String(r.wins),
        `R$ ${r.avgPrice.toFixed(2).replace('.', ',')}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 9 },
    });

    // Price comparison table
    const tableHead = ['Código', 'Descrição', ...empresas, 'Menor', 'Economia'];
    const tableBody = analysis.prodAnalysis.map(item => {
      const row = [
        item.prod.codigo_interno,
        item.prod.descricao.substring(0, 40),
        ...empresas.map(emp => {
          const p = item.prices.find(pr => pr.empresa === emp);
          return p ? `R$ ${p.preco.toFixed(2).replace('.', ',')}` : '-';
        }),
        item.winner ? `R$ ${item.winner.preco.toFixed(2).replace('.', ',')}` : '-',
        item.savings > 0 ? `-${item.savings.toFixed(0)}%` : '-',
      ];
      return row;
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable?.finalY + 10 || 80,
      head: [tableHead],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 40 },
      },
    });

    doc.save(`analise_precos${listaNome ? `_${listaNome}` : ''}.pdf`);
  };

  if (!analysis || respostas.length < 2) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        É necessário pelo menos 2 respostas de fornecedores para gerar análise comparativa.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 overflow-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground font-display">Melhor fornecedor</span>
          </div>
          <p className="text-lg font-display font-bold text-foreground">{analysis.ranking[0]?.empresa}</p>
          <p className="text-xs text-muted-foreground">{analysis.ranking[0]?.wins} itens com menor preço</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-success" />
            <span className="text-xs text-muted-foreground font-display">Economia potencial</span>
          </div>
          <p className="text-lg font-display font-bold text-success">
            R$ {analysis.totalSavings.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-xs text-muted-foreground">vs. maior preço de cada item</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground font-display">Fornecedores</span>
          </div>
          <p className="text-lg font-display font-bold text-foreground">{respostas.length}</p>
          <p className="text-xs text-muted-foreground">responderam esta cotação</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={loadHistorico}
          disabled={loadingHistorico}
          className="flex items-center gap-2 px-3 py-2 text-xs font-display font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
        >
          <History className="w-4 h-4" />
          {loadingHistorico ? 'Carregando...' : showHistorico ? 'Ocultar Histórico' : 'Histórico de Preços'}
        </button>
        <button
          onClick={exportPDF}
          className="flex items-center gap-2 px-3 py-2 text-xs font-display font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
        >
          <FileDown className="w-4 h-4" />
          Exportar PDF
        </button>
      </div>

      {/* Price history section */}
      {showHistorico && (
        <div>
          <h3 className="font-display font-bold text-foreground mb-3 text-sm">Histórico de Menores Preços (Cotações Anteriores)</h3>
          {Object.keys(historico).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum histórico encontrado em cotações finalizadas.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {produtos.filter(p => historico[p.codigo_interno]?.length > 0).slice(0, 20).map(prod => {
                const items = historico[prod.codigo_interno] || [];
                const currentWinner = analysis.prodAnalysis.find(a => a.prod.codigo_interno === prod.codigo_interno)?.winner;
                return (
                  <div key={prod.codigo_interno} className="bg-card border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-display font-bold text-foreground text-sm truncate">{prod.descricao}</p>
                        <p className="text-[11px] text-muted-foreground">{prod.codigo_interno}</p>
                      </div>
                      {currentWinner && (
                        <span className="text-[11px] font-display font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                          Atual: R$ {currentWinner.preco.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 5).map((h, idx) => {
                        const trend = currentWinner
                          ? h.menorPreco > currentWinner.preco ? '↑' : h.menorPreco < currentWinner.preco ? '↓' : '='
                          : '';
                        const trendColor = trend === '↑' ? 'text-destructive' : trend === '↓' ? 'text-success' : 'text-muted-foreground';
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-20 shrink-0">{h.data}</span>
                            <span className="text-muted-foreground w-24 truncate shrink-0">{h.empresa}</span>
                            <span className="font-display font-bold text-foreground">
                              R$ {h.menorPreco.toFixed(2).replace('.', ',')}
                            </span>
                            {trend && <span className={`font-bold ${trendColor}`}>{trend}</span>}
                            <span className="text-[10px] text-muted-foreground truncate">{h.listaNome}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Ranking */}
      <div>
        <h3 className="font-display font-bold text-foreground mb-3 text-sm">Ranking de Fornecedores</h3>
        <div className="space-y-2">
          {analysis.ranking.map((r, idx) => {
            const maxWins = analysis.ranking[0]?.wins || 1;
            return (
              <div key={r.empresa} className="flex items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-lg">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-display font-bold shrink-0 ${
                  idx === 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {idx + 1}º
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-foreground text-sm truncate">{r.empresa}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(r.wins / maxWins) * 100}%`,
                          backgroundColor: idx === 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)',
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{r.wins} vitórias</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Preço médio</p>
                  <p className="text-sm font-display font-bold text-foreground">
                    R$ {r.avgPrice.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-product comparison */}
      <div>
        <h3 className="font-display font-bold text-foreground mb-3 text-sm">Maiores Diferenças de Preço</h3>
        <div className="space-y-2">
          {analysis.prodAnalysis
            .filter(p => p.prices.length > 1 && p.savings > 0)
            .sort((a, b) => b.savings - a.savings)
            .slice(0, 10)
            .map(item => (
              <div key={item.prod.codigo_interno} className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-foreground text-sm truncate">{item.prod.descricao}</p>
                    <p className="text-[11px] text-muted-foreground">{item.prod.codigo_interno}</p>
                  </div>
                  <span className="text-[11px] font-display font-bold text-success bg-success/10 px-2 py-0.5 rounded-full shrink-0">
                    -{item.savings.toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-1">
                  {item.prices.map((p, idx) => {
                    const maxPrice = item.prices[item.prices.length - 1].preco;
                    return (
                      <div key={p.empresa} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-24 truncate shrink-0">{p.empresa}</span>
                        <div className="flex-1 h-4 bg-muted rounded overflow-hidden relative">
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: `${(p.preco / maxPrice) * 100}%`,
                              backgroundColor: idx === 0 ? 'hsl(var(--success))' : 'hsl(var(--primary) / 0.3)',
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-display font-bold text-foreground w-16 text-right shrink-0">
                          {p.preco.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default AnalisePrecosPanel;
