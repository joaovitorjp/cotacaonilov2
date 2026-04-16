import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Trash2, Copy, Pencil, Download, FileSpreadsheet, Package, Users, Calendar } from 'lucide-react';

interface Lista {
  id: string;
  nome: string;
  status: string;
  produtos: any[];
  created_at: string;
}

interface LinkInfo {
  empresa: string;
  respondido: boolean;
}

interface CarregarListaPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onListaSelected: (lista: Lista) => void;
  statusFilter: 'aberta' | 'finalizada';
  title: string;
  onExport?: (lista: Lista) => void;
  onDownloadResultados?: (lista: Lista) => void;
}

const CarregarListaPanel: React.FC<CarregarListaPanelProps> = ({
  open, onOpenChange, onListaSelected, statusFilter, title, onExport, onDownloadResultados,
}) => {
  const { user } = useAuth();
  const [listas, setListas] = useState<Lista[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lista | null>(null);
  const [renameTarget, setRenameTarget] = useState<Lista | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [linksMap, setLinksMap] = useState<Record<string, LinkInfo[]>>({});
  const [respostasCount, setRespostasCount] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) fetchListas();
  }, [open]);

  const fetchListas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('listas')
      .select('*')
      .eq('status', statusFilter)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar listas.');
      setLoading(false);
      return;
    }

    const lists = (data ?? []).map((d: any) => ({ ...d, produtos: d.produtos as any[] }));
    setListas(lists);

    // Fetch links and respostas counts for all lists
    const ids = lists.map(l => l.id);
    if (ids.length > 0) {
      const [linksRes, respostasRes] = await Promise.all([
        supabase.from('links_cotacao').select('lista_id, empresa, respondido').in('lista_id', ids),
        supabase.from('respostas').select('lista_id').in('lista_id', ids),
      ]);

      const lMap: Record<string, LinkInfo[]> = {};
      (linksRes.data ?? []).forEach((l: any) => {
        if (!lMap[l.lista_id]) lMap[l.lista_id] = [];
        lMap[l.lista_id].push({ empresa: l.empresa, respondido: l.respondido });
      });
      setLinksMap(lMap);

      const rCount: Record<string, number> = {};
      (respostasRes.data ?? []).forEach((r: any) => {
        rCount[r.lista_id] = (rCount[r.lista_id] || 0) + 1;
      });
      setRespostasCount(rCount);
    }

    setLoading(false);
  };

  const handleSelect = (lista: Lista) => {
    onListaSelected(lista);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('links_cotacao').delete().eq('lista_id', deleteTarget.id);
    await supabase.from('respostas').delete().eq('lista_id', deleteTarget.id);
    const { error } = await supabase.from('listas').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir lista.');
    } else {
      toast.success(`Lista "${deleteTarget.nome}" excluída.`);
      setListas(prev => prev.filter(l => l.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const { error } = await supabase.from('listas').update({ nome: renameValue.trim() }).eq('id', renameTarget.id);
    if (error) {
      toast.error('Erro ao renomear.');
    } else {
      toast.success('Nome atualizado.');
      setListas(prev => prev.map(l => l.id === renameTarget.id ? { ...l, nome: renameValue.trim() } : l));
    }
    setRenameTarget(null);
    setRenameValue('');
  };

  const handleReplicate = async (lista: Lista) => {
    const { data, error } = await supabase
      .from('listas')
      .insert({ nome: `${lista.nome} (cópia)`, produtos: lista.produtos as any, status: 'aberta', user_id: user?.id })
      .select().single();
    if (error) {
      toast.error('Erro ao replicar lista.');
    } else {
      toast.success(`Lista replicada como "${data.nome}".`);
      fetchListas();
    }
  };

  const getProgressInfo = (listaId: string) => {
    const links = linksMap[listaId] || [];
    const total = links.length;
    const responded = links.filter(l => l.respondido).length;
    return { total, responded, links };
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[95vw] sm:w-[50vw] sm:min-w-[420px] sm:max-w-[600px] p-0 flex flex-col">
          <div className="p-6 pb-0">
            <SheetHeader>
              <SheetTitle className="font-display text-xl">{title}</SheetTitle>
              <SheetDescription>
                {statusFilter === 'aberta'
                  ? 'Selecione uma lista para carregar na planilha.'
                  : 'Visualize e exporte cotações finalizadas.'}
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-auto p-6 pt-4 space-y-3">
            {loading ? (
              <p className="text-muted-foreground text-sm text-center py-8">Carregando...</p>
            ) : listas.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground text-sm">
                  {statusFilter === 'aberta' ? 'Nenhuma lista aberta encontrada.' : 'Nenhuma cotação finalizada.'}
                </p>
              </div>
            ) : (
              listas.map(lista => {
                const progress = getProgressInfo(lista.id);
                const respostas = respostasCount[lista.id] || 0;

                return (
                  <div
                    key={lista.id}
                    className="border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all hover:shadow-sm"
                  >
                    {/* Card header - clickable */}
                    <button
                      onClick={() => handleSelect(lista)}
                      className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold text-foreground text-base leading-tight">{lista.nome}</h3>
                        {statusFilter === 'finalizada' && (
                          <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded-full bg-success/10 text-success shrink-0">
                            FINALIZADA
                          </span>
                        )}
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {lista.produtos.length} produtos
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {respostas} resposta{respostas !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(lista.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      {/* Progress bar */}
                      {progress.total > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                            <span>{progress.responded}/{progress.total} fornecedores responderam</span>
                            <span>{Math.round((progress.responded / progress.total) * 100)}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${(progress.responded / progress.total) * 100}%`,
                                backgroundColor: progress.responded === progress.total
                                  ? 'hsl(var(--success))'
                                  : 'hsl(var(--primary))',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Supplier status chips */}
                      {progress.links.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {progress.links.map((link, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-display ${
                                link.respondido
                                  ? 'bg-success/10 text-success'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {link.empresa}
                              {link.respondido ? ' ✓' : ' ⏳'}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>

                    {/* Card actions */}
                    <div className="flex items-center gap-1 px-3 py-2 bg-muted/30 border-t border-border">
                      {statusFilter === 'aberta' && (
                        <button
                          onClick={() => { setRenameTarget(lista); setRenameValue(lista.nome); }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Renomear"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleReplicate(lista)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Duplicar"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {statusFilter === 'finalizada' && onExport && (
                        <button
                          onClick={() => onExport(lista)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Exportar Excel"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {statusFilter === 'finalizada' && onDownloadResultados && (
                        <button
                          onClick={() => onDownloadResultados(lista)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-xs"
                          title="Baixar CSV ganhadores"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[11px] font-display">CSV</span>
                        </button>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={() => setDeleteTarget(lista)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              A lista "{deleteTarget?.nome}" e todas as suas respostas e links serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <AlertDialog open={!!renameTarget} onOpenChange={(o) => { if (!o) { setRenameTarget(null); setRenameValue(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renomear lista</AlertDialogTitle>
          </AlertDialogHeader>
          <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder="Novo nome" className="my-2" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRename} disabled={!renameValue.trim()}>Salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CarregarListaPanel;
