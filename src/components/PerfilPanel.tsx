import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { LogOut, User as UserIcon } from 'lucide-react';

interface PerfilPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PerfilPanel: React.FC<PerfilPanelProps> = ({ open, onOpenChange }) => {
  const { user, signOut } = useAuth();
  const [nome, setNome] = useState('');
  const [emailLocal, setEmailLocal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('nome, email')
        .eq('user_id', user.id)
        .maybeSingle();
      setNome((data as any)?.nome ?? '');
      setEmailLocal((data as any)?.email ?? user.email ?? '');
      setLoading(false);
    })();
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    const clean = nome.trim();
    if (clean.length < 2) {
      toast.error('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    if (clean.length > 80) {
      toast.error('Nome muito longo (máximo 80 caracteres).');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: user.id, email: user.email ?? emailLocal, nome: clean },
        { onConflict: 'user_id' }
      );
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar perfil.');
    } else {
      toast.success('Perfil atualizado!');
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <SheetTitle className="font-display">Meu Perfil</SheetTitle>
              <SheetDescription>Gerencie suas informações</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {loading ? (
          <p className="text-muted-foreground mt-6">Carregando...</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={emailLocal} disabled className="opacity-70" />
              <p className="text-xs text-muted-foreground">O email é vinculado à sua conta e não pode ser alterado.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome completo"
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">Este nome será exibido nas mensagens enviadas aos fornecedores.</p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Button>

            <Button
              variant="outline"
              onClick={() => { onOpenChange(false); signOut(); }}
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sair da conta
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default PerfilPanel;
