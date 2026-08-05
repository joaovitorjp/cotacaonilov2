import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { LogOut, User as UserIcon, Camera, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface PerfilPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PerfilPanel: React.FC<PerfilPanelProps> = ({ open, onOpenChange }) => {
  const { user, empresa, signOut } = useAuth();
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [emailLocal, setEmailLocal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    fetchProfile();
  }, [open, user]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('nome, email, cargo, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setNome(data?.nome ?? '');
      setCargo(data?.cargo ?? '');
      setAvatarUrl(data?.avatar_url ?? null);
      setEmailLocal(data?.email ?? user.email ?? '');
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      toast.error('Erro ao carregar dados do perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const cleanNome = nome.trim();
    if (cleanNome.length < 2) {
      toast.error('Informe um nome com pelo menos 2 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { 
            user_id: user.id, 
            empresa_id: empresa?.id,
            email: user.email ?? emailLocal, 
            nome: cleanNome,
            cargo: cargo.trim(),
            avatar_url: avatarUrl
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
      
      // Emit custom event for immediate sync
      window.dispatchEvent(new CustomEvent('profile-updated'));
      
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0 || !user) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      setAvatarUrl(`${publicUrl}${publicUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
      toast.success('Foto carregada! Clique em salvar para confirmar.');
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao carregar imagem.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto border-l border-primary/10 bg-white/95 backdrop-blur-xl">
        <SheetHeader className="mb-8">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="w-20 h-20 border-2 border-primary/20 transition-all group-hover:border-primary/50">
                <AvatarImage src={avatarUrl ? (avatarUrl.includes('?') ? `${avatarUrl}&t=${Date.now()}` : `${avatarUrl}?t=${Date.now()}`) : ''} className="object-cover" />
                <AvatarFallback className="bg-primary/5 text-primary text-2xl font-display">
                  {nome ? nome.substring(0, 1).toUpperCase() : <UserIcon className="w-8 h-8" />}
                </AvatarFallback>
              </Avatar>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*" 
              />
            </div>
            <div className="text-left">
              <SheetTitle className="text-2xl font-display font-bold text-slate-800">Meu Perfil</SheetTitle>
              <SheetDescription className="text-slate-500">Ajuste sua identidade no sistema</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-slate-400 font-medium">Carregando seus dados...</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-sm font-semibold text-slate-700">Nome Completo</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all h-11"
                  maxLength={80}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cargo" className="text-sm font-semibold text-slate-700">Cargo / Função</Label>
                <Input
                  id="cargo"
                  value={cargo}
                  onChange={e => setCargo(e.target.value)}
                  placeholder="Ex: Comprador, Gerente..."
                  className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all h-11"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700">E-mail Corporativo</Label>
                <Input 
                  id="email" 
                  value={emailLocal} 
                  disabled 
                  className="bg-slate-100 border-slate-200 opacity-70 h-11" 
                />
                <p className="text-[11px] text-slate-400 italic">O e-mail é a sua chave de acesso e não pode ser alterado.</p>
              </div>
            </div>

            <Separator className="bg-slate-100" />

            <div className="space-y-3">
              <Button 
                onClick={handleSave} 
                disabled={saving || uploading} 
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all rounded-xl"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                ) : 'Salvar Alterações'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => { onOpenChange(false); signOut(); }}
                className="w-full h-11 text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sair da conta
              </Button>
            </div>
            
            <div className="pt-4 border-t border-slate-50">
              <p className="text-center text-xs text-slate-400">
                Seus dados são usados para identificar suas cotações e comunicações com fornecedores.
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default PerfilPanel;