import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Phone } from 'lucide-react';

interface Fornecedor {
  id: string;
  nome: string;
  contato: string | null;
  whatsapp: string;
}

interface FornecedoresPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FornecedoresPanel: React.FC<FornecedoresPanelProps> = ({ open, onOpenChange }) => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [contato, setContato] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) fetchFornecedores();
  }, [open]);

  const fetchFornecedores = async () => {
    setLoading(true);
    const { data } = await supabase.from('fornecedores').select('*').order('nome');
    setFornecedores((data ?? []) as Fornecedor[]);
    setLoading(false);
  };

  const formatWhatsapp = (value: string) => {
    // Keep only digits
    return value.replace(/\D/g, '');
  };

  const handleAdd = async () => {
    if (!nome.trim() || !whatsapp.trim()) return;
    const cleanWhatsapp = formatWhatsapp(whatsapp);
    if (cleanWhatsapp.length < 10) {
      toast.error('Número de WhatsApp inválido. Insira com DDD.');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('fornecedores').insert({
      nome: nome.trim(),
      whatsapp: cleanWhatsapp,
      contato: contato.trim() || null,
    });
    if (error) {
      toast.error('Erro ao adicionar fornecedor.');
    } else {
      toast.success('Fornecedor adicionado.');
      setNome('');
      setWhatsapp('');
      setContato('');
      fetchFornecedores();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('fornecedores').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir.');
    } else {
      setFornecedores(prev => prev.filter(f => f.id !== id));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[95vw] sm:w-[40vw] sm:min-w-[380px] sm:max-w-[500px] p-0 flex flex-col">
        <div className="p-6 pb-0">
          <SheetHeader>
            <SheetTitle className="font-display text-xl flex items-center gap-2">
              <Users className="w-5 h-5" /> Fornecedores
            </SheetTitle>
            <SheetDescription>Cadastre fornecedores com WhatsApp para compartilhar cotações.</SheetDescription>
          </SheetHeader>
        </div>

        {/* Add form */}
        <div className="px-6 pt-4 pb-2 space-y-2 border-b border-border">
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do fornecedor *" />
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="WhatsApp com DDD * (ex: 11999998888)"
              className="pl-9"
              inputMode="tel"
            />
          </div>
          <Input value={contato} onChange={e => setContato(e.target.value)} placeholder="Contato / e-mail (opcional)" />
          <Button onClick={handleAdd} disabled={adding || !nome.trim() || !whatsapp.trim()} className="w-full" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            {adding ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-6 pt-3 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : fornecedores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum fornecedor cadastrado.</p>
          ) : (
            fornecedores.map(f => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-foreground text-sm truncate">{f.nome}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {f.whatsapp}
                  </p>
                  {f.contato && <p className="text-xs text-muted-foreground truncate">{f.contato}</p>}
                </div>
                <button
                  onClick={() => handleDelete(f.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FornecedoresPanel;
