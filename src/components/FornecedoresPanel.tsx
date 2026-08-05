import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Phone, Pencil, Check, X } from 'lucide-react';

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
  const { user } = useAuth();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [contato, setContato] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editContato, setEditContato] = useState('');

  useEffect(() => {
    if (open) fetchFornecedores();
  }, [open]);

  const fetchFornecedores = async () => {
    setLoading(true);
    const { data } = await supabase.from('fornecedores').select('*').order('nome');
    setFornecedores((data ?? []) as Fornecedor[]);
    setLoading(false);
  };

  const formatWhatsapp = (value: string) => value.replace(/\D/g, '');

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
      user_id: user?.id,
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

  const startEdit = (f: Fornecedor) => {
    setEditingId(f.id);
    setEditNome(f.nome);
    setEditWhatsapp(f.whatsapp);
    setEditContato(f.contato || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editNome.trim() || !editWhatsapp.trim()) return;
    const cleanWhatsapp = formatWhatsapp(editWhatsapp);
    if (cleanWhatsapp.length < 10) {
      toast.error('Número de WhatsApp inválido.');
      return;
    }
    const { error } = await supabase.from('fornecedores').update({
      nome: editNome.trim(),
      whatsapp: cleanWhatsapp,
      contato: editContato.trim() || null,
    }).eq('id', editingId);

    if (error) {
      toast.error('Erro ao salvar.');
    } else {
      toast.success('Fornecedor atualizado.');
      setFornecedores(prev => prev.map(f => f.id === editingId ? { ...f, nome: editNome.trim(), whatsapp: cleanWhatsapp, contato: editContato.trim() || null } : f));
      setEditingId(null);
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
            <SheetDescription>Cadastre e edite fornecedores com WhatsApp para compartilhar cotações.</SheetDescription>
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
              <div key={f.id} className="px-3 py-2.5 bg-card border border-border rounded-lg">
                {editingId === f.id ? (
                  <div className="space-y-2">
                    <Input value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome *" className="h-8 text-sm" />
                    <Input value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)} placeholder="WhatsApp *" className="h-8 text-sm" inputMode="tel" />
                    <Input value={editContato} onChange={e => setEditContato(e.target.value)} placeholder="Contato (opcional)" className="h-8 text-sm" />
                    <div className="flex gap-1 justify-end">
                      <button onClick={cancelEdit} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                      <button onClick={saveEdit} className="p-1.5 rounded hover:bg-success/10 text-success transition-colors" disabled={!editNome.trim() || !editWhatsapp.trim()}>
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-foreground text-sm truncate">{f.nome}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {f.whatsapp}
                      </p>
                      {f.contato && <p className="text-xs text-muted-foreground truncate">{f.contato}</p>}
                    </div>
                    <button
                      onClick={() => startEdit(f)}
                      className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FornecedoresPanel;
