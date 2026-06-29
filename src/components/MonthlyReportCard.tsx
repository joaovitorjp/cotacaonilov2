import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, CalendarRange } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

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

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Relatório Mensal de Cotações', 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Período: ${periodLabel}`, 14, 25);

      if (userId !== 'all') {
        const p = profiles[userId];
        doc.text(`Usuário: ${p?.nome || 'Sem nome'} (${p?.email || '—'})`, 14, 31);
      } else {
        doc.text('Usuário: Todos', 14, 31);
      }
      doc.text(`Total de cotações: ${filtered.length}`, 14, 37);
      doc.setTextColor(0);

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
        startY: 43,
        head: [['Data', 'Cotação', 'Usuário', 'Email', 'Produtos', 'Respostas', 'Status']],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 42 },
          2: { cellWidth: 32 },
          3: { cellWidth: 46 },
          4: { cellWidth: 16, halign: 'center' },
          5: { cellWidth: 18, halign: 'center' },
          6: { cellWidth: 22 },
        },
      });

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
    <div className="mb-6 border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 mb-3">
        <CalendarRange className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-foreground">Relatório Mensal (PDF)</h2>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="text-xs text-muted-foreground font-display font-bold">Mês</label>
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
        <div className="flex-1 w-full">
          <label className="text-xs text-muted-foreground font-display font-bold">Usuário</label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {users.map(u => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.nome || 'Sem nome'} — {u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground sm:pb-2">
          {filtered.length} cotação(ões)
        </div>
        <Button onClick={generate} disabled={generating}>
          <FileText className="w-3.5 h-3.5 mr-1.5" />
          {generating ? 'Gerando...' : 'Baixar PDF'}
        </Button>
      </div>
    </div>
  );
};

export default MonthlyReportCard;
