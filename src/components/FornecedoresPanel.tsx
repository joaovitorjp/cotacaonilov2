import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Phone, Pencil, Check, X, Mail, Hash, User } from 'lucide-react';

type CodigoEstado = 'MT' | 'GO';

interface Fornecedor {
  id: string;
  nome: string;
  nome_representante: string | null;
  whatsapp: string;
  email: string | null;
  codigo_interno_ciss: string | null;
  codigo_interno_consinco: string | null;
  codigo_estado: string | null;
}

interface FornecedoresPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyForm = {
  nome: '',
  representante: '',
  whatsapp: '',
  email: '',
  codigoEstado: 'MT' as CodigoEstado,
  codigoCiss: '',
  codigoConsinco: '',
};

const FornecedoresPanel: React.FC<FornecedoresPanelProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  useEffect(() => {
    if (open) fetchFornecedores();
  }, [open]);

  const fetchFornecedores = async () => {
    setLoading(true);
    if (!user?.id) {
      setFornecedores([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('fornecedores')
      .select('id,nome,nome_representante,whatsapp,email,codigo_interno_ciss,codigo_interno_consinco,codigo_estado')
      .eq('user_id', user.id)
      .order('nome');
    setFornecedores((data ?? []) as Fornecedor[]);
    setLoading(false);
  };

  const onlyDigits = (value: string) => value.replace(/\D/g, '');

  const validate = (f: typeof emptyForm) => {
    if (!f.nome.trim()) return 'Informe o nome do fornecedor.';
    if (onlyDigits(f.whatsapp).length < 10) return 'Número de WhatsApp inválido. Insira com DDD.';
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'E-mail inválido.';
    if ((f.codigoCiss.trim() || f.codigoConsinco.trim()) && !f.codigoEstado) return 'Selecione o estado dos códigos internos.';
    return null;
  };

  const toPayload = (f: typeof emptyForm) => ({
    nome: f.nome.trim(),
    nome_representante: f.representante.trim() || null,
    whatsapp: onlyDigits(f.whatsapp),
    email: f.email.trim() || null,
    codigo_interno_ciss: f.codigoCiss.trim() || null,
    codigo_interno_consinco: f.codigoConsinco.trim() || null,
    codigo_estado: (f.codigoCiss.trim() || f.codigoConsinco.trim()) ? f.codigoEstado : null,
  });

  const handleAdd = async () => {
    const err = validate(form);
    if (err) return toast.error(err);
    setAdding(true);
    const { error } = await supabase.from('fornecedores').insert({ ...toPayload(form), user_id: user?.id });
    if (error) {
      toast.error('Erro ao adicionar fornecedor.');
    } else {
      toast.success('Fornecedor adicionado.');
      setForm(emptyForm);
      fetchFornecedores();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    const { error } = await supabase.from('fornecedores').delete().eq('id', id).eq('user_id', user.id);
    if (error) toast.error('Erro ao excluir.');
    else setFornecedores(prev => prev.filter(f => f.id !== id));
  };

  const startEdit = (f: Fornecedor) => {
    setEditingId(f.id);
    setEditForm({
      nome: f.nome,
      representante: f.nome_representante || '',
      whatsapp: f.whatsapp,
      email: f.email || '',
      codigoEstado: (f.codigo_estado === 'GO' ? 'GO' : 'MT') as CodigoEstado,
      codigoCiss: f.codigo_interno_ciss || '',
      codigoConsinco: f.codigo_interno_consinco || '',
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const err = validate(editForm);
    if (err) return toast.error(err);
    const payload = toPayload(editForm);
    const { error } = await supabase
      .from('fornecedores')
      .update(payload)
      .eq('id', editingId)
      .eq('user_id', user?.id ?? '');
    if (error) {
      toast.error('Erro ao salvar.');
    } else {
      toast.success('Fornecedor atualizado.');
      setFornecedores(prev => prev.map(f => (f.id === editingId ? { ...f, ...payload } : f)));
      setEditingId(null);
    }
  };

  const renderFields = (f: typeof emptyForm, set: (v: typeof emptyForm) => void, compact = false) => {
    const h = compact ? 'h-8 text-sm' : '';
    return (
      <>
        <Input className={h} value={f.nome} onChange={e => set({ ...f, nome: e.target.value })} placeholder="Nome do fornecedor (empresa) *" />
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className={`pl-9 ${h}`} value={f.representante} onChange={e => set({ ...f, representante: e.target.value })} placeholder="Nome do representante" />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className={`pl-9 ${h}`} value={f.whatsapp} onChange={e => set({ ...f, whatsapp: e.target.value })} placeholder="WhatsApp do representante * (DDD)" inputMode="tel" />
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className={`pl-9 ${h}`} value={f.email} onChange={e => set({ ...f, email: e.target.value })} placeholder="E-mail do fornecedor" type="email" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className={`pl-9 ${h}`} value={f.codigoCiss} onChange={e => set({ ...f, codigoCiss: e.target.value })} placeholder="Código CISS" />
          </div>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className={`pl-9 ${h}`} value={f.codigoConsinco} onChange={e => set({ ...f, codigoConsinco: e.target.value })} placeholder="Código CONSINCO" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Estado dos códigos:</span>
          <Select value={f.codigoEstado} onValueChange={(v: CodigoEstado) => set({ ...f, codigoEstado: v })}>
            <SelectTrigger className={`w-[90px] ${h}`}>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MT">MT</SelectItem>
              <SelectItem value="GO">GO</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[95vw] sm:w-[40vw] sm:min-w-[380px] sm:max-w-[500px] p-0 flex flex-col">
        <div className="p-6 pb-0">
          <SheetHeader>
            <SheetTitle className="font-display text-xl flex items-center gap-2">
              <Users className="w-5 h-5" /> Fornecedores
            </SheetTitle>
            <SheetDescription>Cadastre fornecedores com representante, contato e código interno.</SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-6 pt-4 pb-3 space-y-2 border-b border-border">
          {renderFields(form, setForm)}
          <Button onClick={handleAdd} disabled={adding || !form.nome.trim() || !form.whatsapp.trim()} className="w-full" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            {adding ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>

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
                    {renderFields(editForm, setEditForm, true)}
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                      <button onClick={saveEdit} className="p-1.5 rounded hover:bg-success/10 text-success transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-foreground text-sm truncate">{f.nome}</p>
                      {f.nome_representante && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <User className="w-3 h-3" /> {f.nome_representante}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {f.whatsapp}
                      </p>
                      {f.email && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {f.email}
                        </p>
                      )}
                      {(f.codigo_interno_ciss || f.codigo_interno_consinco) && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {[
                            f.codigo_interno_ciss ? `CISS: ${f.codigo_interno_ciss}` : null,
                            f.codigo_interno_consinco ? `CONSINCO: ${f.codigo_interno_consinco}` : null,
                          ].filter(Boolean).join(' • ')}{f.codigo_estado ? ` • ${f.codigo_estado}` : ''}
                        </p>
                      )}
                    </div>
                    <button onClick={() => startEdit(f)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors shrink-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(f.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
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
