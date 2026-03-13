import React, { useMemo } from 'react';
import { BarChart3, Trophy, TrendingDown } from 'lucide-react';

interface Produto {
  codigo_interno: string;
  descricao: string;
  codigo_barras: string;
}

interface RespostaEmpresa {
  empresa: string;
  resposta: { codigo_interno: string; preco: number | string }[];
}

interface AnalisePrecosPanelProps {
  produtos: Produto[];
  respostas: RespostaEmpresa[];
}

const parsePreco = (raw: number | string): number => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw !== '') return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  return NaN;
};

const AnalisePrecosPanel: React.FC<AnalisePrecosPanelProps> = ({ produtos, respostas }) => {
  const analysis = useMemo(() => {
    if (respostas.length === 0) return null;

    const empresas = respostas.map(r => r.empresa);
    let totalByEmpresa: Record<string, { total: number; count: number; wins: number }> = {};
    empresas.forEach(e => { totalByEmpresa[e] = { total: 0, count: 0, wins: 0 }; });

    // Per-product analysis
    const prodAnalysis = produtos.map(prod => {
      const prices: { empresa: string; preco: number }[] = [];
      for (const resp of respostas) {
        const item = resp.resposta.find((i: any) => i.codigo_interno === prod.codigo_interno);
        if (item) {
          const num = parsePreco(item.preco);
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

    // Ranking
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

      {/* Per-product comparison - top 10 with biggest savings */}
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
                {/* Mini bar chart */}
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
