import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Trash2, Copy, Pencil } from 'lucide-react';

interface Lista {
  id: string;
  nome: string;
  status: string;
  produtos: any[];
  created_at: string;
}

interface CarregarListaPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onListaSelected: (lista: Lista) => void;
  statusFilter: 'aberta' | 'finalizada';
  title: string;
  onExport?: (lista: Lista) => void;
}

const CarregarListaPanel: React.FC<CarregarListaPanelProps> = ({
  open,
  onOpenChange,
  onListaSelected,
  statusFilter,
  title,
  onExport,
}) => {
  const [listas, setListas] = useState<Lista[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lista | null>(null);
  const [renameTarget, setRenameTarget] = useState<Lista | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
    } else {
      setListas((data ?? []).map((d: any) => ({ ...d, produtos: d.produtos as any[] })));
    }
    setLoading(false);
  };

  const handleSelect = (lista: Lista) => {
    onListaSelected(lista);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // Delete related links and respostas first
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
    const { error } = await supabase
      .from('listas')
      .update({ nome: renameValue.trim() })
      .eq('id', renameTarget.id);
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
      .insert({ nome: `${lista.nome} (cópia)`, produtos: lista.produtos as any, status: 'aberta' })
      .select()
      .single();
    if (error) {
      toast.error('Erro ao replicar lista.');
    } else {
      toast.success(`Lista replicada como "${data.nome}".`);
      fetchListas();
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[40vw] min-w-[360px] sm:max-w-none">
          <SheetHeader>
            <SheetTitle className="font-display">{title}</SheetTitle>
            <SheetDescription>
              {statusFilter === 'aberta'
                ? 'Selecione uma lista para carregar na planilha.'
                : 'Selecione uma cotação finalizada para visualizar.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {loading ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : listas.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {statusFilter === 'aberta' ? 'Nenhuma lista aberta encontrada.' : 'Nenhuma cotação finalizada.'}
              </p>
            ) : (
              listas.map(lista => (
                <div
                  key={lista.id}
                  className="w-full text-left px-4 py-3 border border-border rounded hover:bg-muted/50 transition-colors duration-200 flex items-center gap-2"
                >
                  <button
                    onClick={() => handleSelect(lista)}
                    className="flex-1 text-left"
                  >
                    <div className="font-display font-bold text-foreground">{lista.nome}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {lista.produtos.length} produtos · Criada em{' '}
                      {new Date(lista.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {statusFilter === 'aberta' && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenameTarget(lista); setRenameValue(lista.nome); }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Renomear"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReplicate(lista); }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Replicar"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {statusFilter === 'finalizada' && onExport && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onExport(lista); }}
                      >
                        Exportar
                      </Button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(lista); }}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
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
          <Input
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            placeholder="Novo nome"
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRename} disabled={!renameValue.trim()}>
              Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CarregarListaPanel;
