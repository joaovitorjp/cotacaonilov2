import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';

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
}

const CarregarListaPanel: React.FC<CarregarListaPanelProps> = ({
  open,
  onOpenChange,
  onListaSelected,
  statusFilter,
  title,
}) => {
  const [listas, setListas] = useState<Lista[]>([]);
  const [loading, setLoading] = useState(false);

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
      setListas(data ?? []);
    }
    setLoading(false);
  };

  const handleSelect = (lista: Lista) => {
    onListaSelected(lista);
    onOpenChange(false);
  };

  return (
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
              <button
                key={lista.id}
                onClick={() => handleSelect(lista)}
                className="w-full text-left px-4 py-3 border border-border rounded hover:bg-muted/50 transition-colors duration-200"
              >
                <div className="font-display font-bold text-foreground">{lista.nome}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {lista.produtos.length} produtos · Criada em{' '}
                  {new Date(lista.created_at).toLocaleDateString('pt-BR')}
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CarregarListaPanel;
