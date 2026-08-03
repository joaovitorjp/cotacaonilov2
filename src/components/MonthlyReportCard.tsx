import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, CalendarRange } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { drawHeader, drawChips, drawSectionTitle, drawFooter, tableStyles, PDF_COLORS } from '@/lib/pdf-theme';

interface Lista {
  id: string;
  nome: string;
  status: string;
  produtos: any[];
  created_at: string;
  user_id: string;
}
interface Profile { user_id: string; nome: string; email: string; }

interface Props {
  listas: Lista[];
  profiles: Record<string, Profile>;
}

const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const MonthlyReportCard: React.FC<Props> = ({ listas, profiles }) => {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [userId, setUserId] = useState<string>('all');
  const [generating, setGenerating] = useState(false);

  const users = useMemo(() => {
    const ids = Array.from(new Set(listas.map(l => l.user_id)));
    return ids.map(id => profiles[id]).filter(Boolean) as Profile[];
  }, [listas, profiles]);

  const filtered = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return listas.filter(l => {
      // Usar fuso horário local ou UTC consistentemente? 
      // O input 'month' vem como YYYY-MM (local do browser).
      // l.created_at é ISO (UTC).
      const d = new Date(l.created_at);
      const yearMatch = d.getUTCFullYear() === y;
      const monthMatch = (d.getUTCMonth() + 1) === m;
      if (!yearMatch || !monthMatch) return false;
      if (userId !== 'all' && l.user_id !== userId) return false;
      return true;
    });
  }, [listas, month, userId]);

  const generate = async () => {
    if (filtered.length === 0) {
      toast.error('Nenhuma cotação no período selecionado.');
      return;
    }
    setGenerating(true);
    try {
      const ids = filtered.map(l => l.id);
      const { data: respostasData } = await supabase
        .from('respostas')
        .select('lista_id, empresa')
        .in('lista_id', ids);

      const respostasPorLista: Record<string, number> = {};
      (respostasData ?? []).forEach((r: any) => {
        respostasPorLista[r.lista_id] = (respostasPorLista[r.lista_id] || 0) + 1;
      });

      const [y, m] = month.split('-').map(Number);
      const periodLabel = `${monthNames[m - 1]} / ${y}`;
      const userLabel = userId !== 'all'
        ? `${profiles[userId]?.nome || 'Sem nome'} (${profiles[userId]?.email || '—'})`
        : 'Todos os usuários';

      const doc = new jsPDF();
      let y0 = drawHeader(doc, {
        title: 'Relatório Mensal de Cotações',
        subtitle: `Período: ${periodLabel}`,
        meta: `Usuário: ${userLabel}`,
      });

      const finalizadas = filtered.filter(l => l.status === 'finalizada').length;
      const totalProdutos = filtered.reduce((s, l) => s + (l.produtos?.length ?? 0), 0);
      y0 = drawChips(doc, y0, [
        { label: 'Cotações', value: String(filtered.length), tone: 'primary' },
        { label: 'Finalizadas', value: String(finalizadas), tone: 'success' },
        { label: 'Abertas', value: String(filtered.length - finalizadas), tone: 'muted' },
        { label: 'Produtos', value: String(totalProdutos), tone: 'muted' },
      ]);

      y0 = drawSectionTitle(doc, y0 + 2, 'Detalhamento');

      const rows = filtered
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(l => {
          const owner = profiles[l.user_id];
          return [
            new Date(l.created_at).toLocaleDateString('pt-BR'),
            l.nome,
            owner?.nome || 'Sem nome',
            owner?.email || '—',
            String(l.produtos?.length ?? 0),
            String(respostasPorLista[l.id] || 0),
            l.status === 'finalizada' ? 'Finalizada' : 'Aberta',
          ];
        });

      autoTable(doc, {
        ...tableStyles,
        startY: y0,
        head: [['Data', 'Cotação', 'Usuário', 'Email', 'Produtos', 'Respostas', 'Status']],
        body: rows,
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 42, fontStyle: 'bold', textColor: PDF_COLORS.ink as any },
          2: { cellWidth: 32 },
          3: { cellWidth: 46 },
          4: { cellWidth: 16, halign: 'center' },
          5: { cellWidth: 18, halign: 'center' },
          6: { cellWidth: 22, halign: 'center' },
        },
        didParseCell: (data: any) => {
          if (data.section !== 'body' || data.column.index !== 6) return;
          const v = String(data.cell.raw || '');
          if (v === 'Finalizada') {
            data.cell.styles.textColor = PDF_COLORS.success;
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = PDF_COLORS.primary;
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      drawFooter(doc);
      const fileName = `relatorio-cotacoes-${month}${userId !== 'all' ? '-' + (profiles[userId]?.nome || 'usuario').replace(/\s+/g, '_') : ''}.pdf`;
      doc.save(fileName);
      toast.success('Relatório gerado.');
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao gerar relatório.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/60 ml-1">Mês de Referência</label>
        <Input 
          type="month" 
          value={month} 
          onChange={e => setMonth(e.target.value)} 
          className="bg-muted/40 border-none h-11 rounded-xl text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/60 ml-1">Comprador</label>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="bg-muted/40 border-none h-11 rounded-xl text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary/20 transition-all">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/50 shadow-xl">
            <SelectItem value="all" className="font-medium">Todos os usuários</SelectItem>
            {users.map(u => (
              <SelectItem key={u.user_id} value={u.user_id} className="text-xs font-medium">
                {u.nome || 'Sem nome'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="pt-4">
        <Button 
          onClick={generate} 
          disabled={generating} 
          className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-2xl font-display font-bold text-xs h-11 uppercase tracking-widest transition-all duration-300"
        >
          {generating ? (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Processando...</span>
            </div>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2.5" />
              Gerar PDF Mensal
            </>
          )}
        </Button>
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-tighter opacity-50">
          <CalendarRange className="w-3 h-3" />
          <span>{filtered.length} Registros Encontrados</span>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportCard;
