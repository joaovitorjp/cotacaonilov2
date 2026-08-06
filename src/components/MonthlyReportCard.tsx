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
      const d = new Date(l.created_at);
      if (d.getFullYear() !== y || d.getMonth() + 1 !== m) return false;
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
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-50 p-2 rounded-lg">
          <CalendarRange className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 leading-tight">Relatório Consolidado</h2>
          <p className="text-[10px] text-slate-500 font-medium">Exportar métricas mensais em PDF</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block px-1">Mês de Referência</label>
          <Input 
            type="month" 
            value={month} 
            onChange={e => setMonth(e.target.value)} 
            className="bg-slate-50 border-slate-200 rounded-xl h-10 text-sm font-medium focus:bg-white transition-all"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block px-1">Filtrar por Usuário</label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="bg-slate-50 border-slate-200 rounded-xl h-10 text-sm font-medium focus:bg-white transition-all">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200">
              <SelectItem value="all" className="text-xs font-medium">Todos os usuários</SelectItem>
              {users.map(u => (
                <SelectItem key={u.user_id} value={u.user_id} className="text-xs font-medium">
                  {u.nome || 'Sem nome'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2">
          <Button 
            onClick={generate} 
            disabled={generating} 
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs py-5 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {generating ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Processando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Gerar Relatório PDF</span>
              </div>
            )}
          </Button>
          
          <p className="text-[10px] text-center text-slate-400 mt-4 font-medium">
            {filtered.length} cotações identificadas no período
          </p>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportCard;
