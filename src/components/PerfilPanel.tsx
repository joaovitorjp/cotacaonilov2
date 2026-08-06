import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar, notifyAvatarUpdated } from '@/hooks/useAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { LogOut, User as UserIcon, Camera, Trash2, Loader2 } from 'lucide-react';

interface PerfilPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const PerfilPanel: React.FC<PerfilPanelProps> = ({ open, onOpenChange }) => {
  const { user, signOut } = useAuth();
  const { avatarUrl, avatarPath, refresh } = useAvatar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState('');
  const [emailLocal, setEmailLocal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('Imagem muito grande. Máximo 2 MB.');
      return;
    }

    setUploading(true);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('profiles')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      setUploading(false);
      toast.error('Erro ao enviar a imagem.');
      return;
    }

    const { error: dbErr } = await supabase
      .from('profiles')
      .upsert(
        { user_id: user.id, email: user.email ?? emailLocal, nome: nome.trim() || 'Usuário', avatar_url: path },
        { onConflict: 'user_id' }
      );

    if (dbErr) {
      setUploading(false);
      toast.error('Erro ao salvar a foto no perfil.');
      return;
    }

    if (avatarPath && avatarPath !== path) {
      await supabase.storage.from('profiles').remove([avatarPath]);
    }

    await refresh();
    notifyAvatarUpdated();
    setUploading(false);
    toast.success('Foto de perfil atualizada!');
  };

  const removeAvatar = async () => {
    if (!user || !avatarPath) return;
    setUploading(true);
    await supabase.storage.from('profiles').remove([avatarPath]);
    await supabase.from('profiles').update({ avatar_url: null }).eq('user_id', user.id);
    await refresh();
    notifyAvatarUpdated();
    setUploading(false);
    toast.success('Foto removida.');
  };

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
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-primary" />
              )}
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
          <div className="mt-6 space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Foto de perfil do usuário" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                {uploading && (
                  <div className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFile}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-2" /> {avatarUrl ? 'Trocar foto' : 'Enviar foto'}
                  </Button>
                  {avatarUrl && (
                    <Button size="sm" variant="ghost" disabled={uploading} onClick={removeAvatar} className="text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP • até 2 MB</p>
              </div>
            </div>

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
