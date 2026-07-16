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

// Busca o item da resposta correspondente ao produto, priorizando o
// código interno e caindo para o código de barras quando necessário.
// Isso evita ausência de estatísticas quando um dos campos está vazio.
const norm = (v: any) => (v === undefined || v === null ? '' : String(v).trim());
const findRespItem = (items: any[] | undefined, prod: { codigo_interno: string; codigo_barras?: string }): any | undefined => {
  if (!items || items.length === 0) return undefined;
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
  const [showComparativoDialog, setShowComparativoDialog] = useState(false);
  const [estadoComparativo, setEstadoComparativo] = useState<'mt' | 'go'>('mt');
  const [showFornecedorDialog, setShowFornecedorDialog] = useState(false);
  const [estadoFornecedor, setEstadoFornecedor] = useState<'mt' | 'go' | 'ambos'>('ambos');

  const exportFornecedorPDF = (empresaSelecionada: string) => {
    const resp = respostas.find(r => r.empresa === empresaSelecionada);
    if (!resp) return;

    const showMT = estadoFornecedor === 'mt' || estadoFornecedor === 'ambos';
    const showGO = estadoFornecedor === 'go' || estadoFornecedor === 'ambos';

    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, pageWidth, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('Cotação — Preços do Fornecedor', 14, 12);
    doc.setFontSize(9);
    doc.text(`Cotação: ${listaNome || 'Sem nome'}`, 14, 18);
    doc.text(`Fornecedor: ${empresaSelecionada}`, 14, 23);
    const dataStr = `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`;
    doc.text(dataStr, pageWidth - 14 - doc.getTextWidth(dataStr), 23);
    doc.setTextColor(0, 0, 0);

    const fmt = (v: number) => !isNaN(v) && v > 0 ? `R$ ${v.toFixed(2).replace('.', ',')}` : '-';

    const head: string[] = ['#', 'Código', 'Descrição', 'Cód. Barras'];
    if (showMT) head.push('MT');
    if (showGO) head.push('GO');

    let totalMT = 0, totalGO = 0, countMT = 0, countGO = 0;

    const body = produtos.map((prod, idx) => {
      const item: any = resp.resposta.find((i: any) => i.codigo_interno === prod.codigo_interno);
      const priceMT = item ? parsePreco(item.preco_mt ?? item.preco) : NaN;
      const priceGO = item ? parsePreco(item.preco_go ?? item.preco) : NaN;
      if (!isNaN(priceMT) && priceMT > 0) { totalMT += priceMT; countMT++; }
      if (!isNaN(priceGO) && priceGO > 0) { totalGO += priceGO; countGO++; }
      const row = [String(idx + 1), prod.codigo_interno, prod.descricao.substring(0, 55), prod.codigo_barras || '-'];
      if (showMT) row.push(fmt(priceMT));
      if (showGO) row.push(fmt(priceGO));
      return row;
    });

    autoTable(doc, {
      startY: 32,
      head: [head],
      body,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 8, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 22 },
        3: { cellWidth: 28 },
      },
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        const priceColStart = 4;
        if (data.column.index >= priceColStart) {
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    let y = finalY + 8;
    doc.text(`Total de produtos: ${produtos.length}`, 14, y);
    y += 5;
    if (showMT) { doc.text(`Itens precificados (MT): ${countMT}  ·  Soma MT: R$ ${totalMT.toFixed(2).replace('.', ',')}`, 14, y); y += 5; }
    if (showGO) { doc.text(`Itens precificados (GO): ${countGO}  ·  Soma GO: R$ ${totalGO.toFixed(2).replace('.', ',')}`, 14, y); y += 5; }

    doc.save(`precos_${empresaSelecionada.replace(/\s+/g, '_')}${listaNome ? `_${listaNome.replace(/\s+/g, '_')}` : ''}.pdf`);
    setShowFornecedorDialog(false);
  };


  const exportComparativoPDF = (empresaSelecionada: string) => {
    const estado = estadoComparativo;
    const estadoLabel = estado === 'mt' ? 'MT (Mato Grosso)' : 'GO (Goiás)';
    const getPriceField = (item: any) =>
      estado === 'mt' ? (item.preco_mt ?? item.preco) : (item.preco_go ?? item.preco);
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const outrasEmpresas = respostas.filter(r => r.empresa !== empresaSelecionada);

    // Anonymized names
    const nomesConcorrentes: Record<string, string> = {};
    outrasEmpresas.forEach((r, idx) => {
      nomesConcorrentes[r.empresa] = `Concorrente ${idx + 1}`;
    });

    // --- Header bar ---
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Comparativo de Preços', 14, 12);
    doc.setFontSize(9);
    doc.text(`Cotação: ${listaNome || 'Sem nome'}`, 14, 19);
    doc.text(`Fornecedor: ${empresaSelecionada}  ·  Estado: ${estadoLabel}`, 14, 24);
    const dataStr = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
    doc.text(dataStr, pageWidth - 14 - doc.getTextWidth(dataStr), 24);

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // --- Summary box ---
    const totalProdutos = produtos.length;
    const totalConcorrentes = outrasEmpresas.length;

    // Count how many items the selected supplier has the best price
    let winsCount = 0;
    let lossesCount = 0;
    produtos.forEach(prod => {
      const getNum = (resp: RespostaEmpresa) => {
        const item = resp.resposta.find((i: any) => i.codigo_interno === prod.codigo_interno);
        if (!item) return NaN;
        return parsePreco(getPriceField(item));
      };
      const selPrice = getNum(respostas.find(r => r.empresa === empresaSelecionada)!);
      if (isNaN(selPrice) || selPrice <= 0) return;
      const concPrices = outrasEmpresas.map(r => getNum(r)).filter(v => !isNaN(v) && v > 0);
      if (concPrices.length === 0) return;
      const minConc = Math.min(...concPrices);
      if (selPrice <= minConc) winsCount++;
      else lossesCount++;
    });

    doc.setFontSize(8);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(14, 32, pageWidth - 28, 10, 2, 2, 'F');
    doc.setTextColor(80, 80, 80);
    doc.text(`${totalProdutos} produtos  ·  ${totalConcorrentes} concorrente(s)  ·  ✅ Menor preço em ${winsCount} itens  ·  ⚠️ Preço maior em ${lossesCount} itens`, 18, 38.5);
    doc.setTextColor(0, 0, 0);

    // --- Table ---
    const colHeaders = ['#', 'Código', 'Descrição', empresaSelecionada, ...outrasEmpresas.map(r => nomesConcorrentes[r.empresa]), 'Diferença'];

    // Pre-compute numeric prices and filter out wins / no-price items
    const allRowData = produtos.map((prod, idx) => {
      const getNum = (resp: RespostaEmpresa) => {
        const item = resp.resposta.find((i: any) => i.codigo_interno === prod.codigo_interno);
        if (!item) return NaN;
        return parsePreco(getPriceField(item));
      };
      const fmt = (v: number) => !isNaN(v) && v > 0 ? `R$ ${v.toFixed(2).replace('.', ',')}` : '-';

      const selResp = respostas.find(r => r.empresa === empresaSelecionada);
      const selPrice = selResp ? getNum(selResp) : NaN;
      const concPrices = outrasEmpresas.map(r => getNum(r));

      const validConc = concPrices.filter(v => !isNaN(v) && v > 0);
      const minConc = validConc.length > 0 ? Math.min(...validConc) : NaN;

      // Skip if supplier has no price, already has the best/equal price, or no competitors have a price
      const hasPrice = !isNaN(selPrice) && selPrice > 0;
      const noConcurrents = validConc.length === 0;
      const alreadyWon = hasPrice && !isNaN(minConc) && selPrice <= minConc;
      if (!hasPrice || noConcurrents || alreadyWon) return null;

      let diffStr = '-';
      if (!isNaN(minConc)) {
        const diffPct = ((selPrice - minConc) / selPrice) * 100;
        diffStr = diffPct > 0 ? `+${diffPct.toFixed(1)}%` : '0%';
      }

      return {
        row: [
          '', // placeholder for sequential #
          prod.codigo_interno,
          prod.descricao.substring(0, 42),
          fmt(selPrice),
          ...concPrices.map(v => fmt(v)),
          diffStr,
        ],
        selPrice,
        concPrices,
      };
    }).filter(Boolean) as { row: string[]; selPrice: number; concPrices: number[] }[];

    // Re-number rows sequentially
    allRowData.forEach((rd, i) => { rd.row[0] = String(i + 1); });

    // Update summary with filtered count
    lossesCount = allRowData.length;

    autoTable(doc, {
      startY: 46,
      head: [colHeaders],
      body: allRowData.map(r => r.row),
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        fontSize: 7,
        halign: 'center',
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 22 },
        2: { cellWidth: 42 },
        [colHeaders.length - 1]: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        const rowIdx = data.row.index;
        const rd = allRowData[rowIdx];
        if (!rd) return;

        const selColIdx = 3; // supplier column index
        const firstConcIdx = 4;
        const lastConcIdx = firstConcIdx + outrasEmpresas.length - 1;
        const diffColIdx = colHeaders.length - 1;

        // Highlight selected supplier column
        if (data.column.index === selColIdx) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 242, 255];
        }

        // Highlight competitor prices that are LOWER than the selected supplier (green)
        if (data.column.index >= firstConcIdx && data.column.index <= lastConcIdx) {
          const concIdx = data.column.index - firstConcIdx;
          const concPrice = rd.concPrices[concIdx];
          if (!isNaN(concPrice) && concPrice > 0 && !isNaN(rd.selPrice) && rd.selPrice > 0) {
            if (concPrice < rd.selPrice) {
              data.cell.styles.fillColor = [220, 245, 220];
              data.cell.styles.textColor = [30, 120, 30];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }

        // Difference column coloring
        if (data.column.index === diffColIdx) {
          const txt = data.cell.raw || '';
          if (typeof txt === 'string' && txt.startsWith('+')) {
            data.cell.styles.textColor = [200, 50, 50];
          } else if (typeof txt === 'string' && txt.startsWith('-')) {
            data.cell.styles.textColor = [30, 120, 30];
          }
        }
      },
    });

    // --- Footer ---
    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Os nomes dos concorrentes foram omitidos por questões de confidencialidade.', 14, finalY + 6);

    // Legend
    doc.setFillColor(220, 245, 220);
    doc.rect(14, finalY + 10, 4, 3, 'F');
    doc.setTextColor(80, 80, 80);
    doc.text('= Preço do concorrente menor que o seu (oportunidade de cobrir)', 20, finalY + 12.5);

    doc.save(`comparativo_${empresaSelecionada.replace(/\s+/g, '_')}_${estado.toUpperCase()}.pdf`);
    setShowComparativoDialog(false);
  };

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
        <button
          onClick={() => setShowComparativoDialog(true)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-display font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
          Comparativo p/ Fornecedor
        </button>
        <button
          onClick={() => setShowFornecedorDialog(true)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-display font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
        >
          <FileDown className="w-4 h-4" />
          PDF por Fornecedor
        </button>

      </div>

      {/* Supplier selection dialog for comparative PDF */}
      <Dialog open={showComparativoDialog} onOpenChange={setShowComparativoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Gerar Comparativo de Preços</DialogTitle>
            <DialogDescription>
              Escolha o estado considerado e o fornecedor. Os nomes dos concorrentes serão anonimizados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-display font-bold text-muted-foreground mb-1.5 block">
                Estado considerado
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={estadoComparativo === 'mt' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 font-display"
                  onClick={() => setEstadoComparativo('mt')}
                >
                  MT (Mato Grosso)
                </Button>
                <Button
                  type="button"
                  variant={estadoComparativo === 'go' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 font-display"
                  onClick={() => setEstadoComparativo('go')}
                >
                  GO (Goiás)
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-display font-bold text-muted-foreground mb-1.5 block">
                Fornecedor
              </label>
              <div className="space-y-2 max-h-[300px] overflow-auto">
                {respostas.map(r => (
                  <Button
                    key={r.empresa}
                    variant="outline"
                    className="w-full justify-start font-display"
                    onClick={() => exportComparativoPDF(r.empresa)}
                  >
                    {r.empresa}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single-supplier PDF dialog */}
      <Dialog open={showFornecedorDialog} onOpenChange={setShowFornecedorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">PDF de Preços por Fornecedor</DialogTitle>
            <DialogDescription>
              Escolha o(s) estado(s) e o fornecedor. O PDF conterá apenas os produtos e preços deste fornecedor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-display font-bold text-muted-foreground mb-1.5 block">
                Estado(s)
              </label>
              <div className="flex gap-2">
                <Button type="button" variant={estadoFornecedor === 'mt' ? 'default' : 'outline'} size="sm" className="flex-1 font-display" onClick={() => setEstadoFornecedor('mt')}>MT</Button>
                <Button type="button" variant={estadoFornecedor === 'go' ? 'default' : 'outline'} size="sm" className="flex-1 font-display" onClick={() => setEstadoFornecedor('go')}>GO</Button>
                <Button type="button" variant={estadoFornecedor === 'ambos' ? 'default' : 'outline'} size="sm" className="flex-1 font-display" onClick={() => setEstadoFornecedor('ambos')}>Ambos</Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-display font-bold text-muted-foreground mb-1.5 block">
                Fornecedor
              </label>
              <div className="space-y-2 max-h-[300px] overflow-auto">
                {respostas.map(r => (
                  <Button
                    key={r.empresa}
                    variant="outline"
                    className="w-full justify-start font-display"
                    onClick={() => exportFornecedorPDF(r.empresa)}
                  >
                    {r.empresa}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>


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
