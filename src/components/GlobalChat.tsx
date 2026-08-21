import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import UserAvatar from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { MessageCircle, X, Send, Loader2, Share2, FileSpreadsheet, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SharedLista {
  id: string;
  nome: string;
  status: string;
  produtos: any[];
}

interface GlobalMsg {
  id: string;
  user_id: string;
  autor_nome: string;
  autor_email: string;
  autor_avatar_path: string | null;
  content: string;
  created_at: string;
  shared_lista?: SharedLista | null;
  mentioned_user_id?: string | null;
  mentioned_nome?: string | null;
  saved_by?: string[] | null;
}

const MSG_COLS =
  'id, user_id, autor_nome, autor_email, autor_avatar_path, content, created_at, shared_lista, mentioned_user_id, mentioned_nome, saved_by';

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideBubble?: boolean;
}

const GlobalChat: React.FC<Props> = ({ open: openProp, onOpenChange, hideBubble }) => {
  const { user } = useAuth();
  const { avatarPath } = useAvatar();
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOpenState(v));

  const [messages, setMessages] = useState<GlobalMsg[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [listas, setListas] = useState<SharedLista[]>([]);
  const [listaId, setListaId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [sharing, setSharing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [profile, setProfile] = useState<{ nome: string; email: string } | null>(null);


  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('nome, email')
        .eq('user_id', user.id)
        .maybeSingle();
      setProfile({
        nome: (data as any)?.nome || (user.user_metadata as any)?.nome || '',
        email: (data as any)?.email || user.email || '',
      });
    })();
  }, [user]);

  const resolveAvatars = useCallback(async (msgs: GlobalMsg[]) => {
    const paths = Array.from(
      new Set(msgs.map(m => m.autor_avatar_path).filter(Boolean) as string[])
    );
    const missing = paths.filter(p => !avatarUrls[p]);
    if (missing.length === 0) return;
    const entries: [string, string][] = [];
    for (const p of missing) {
      const { data } = await supabase.storage.from('profiles').createSignedUrl(p, 60 * 60);
      if (data?.signedUrl) entries.push([p, data.signedUrl]);
    }
    if (entries.length) setAvatarUrls(prev => ({ ...prev, ...Object.fromEntries(entries) }));
  }, [avatarUrls]);

  useEffect(() => {
    if (!user || !open) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('mensagens_globais')
        .select(MSG_COLS)
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) toast.error('Não foi possível carregar o chat.');
      const list = (data ?? []) as unknown as GlobalMsg[];
      setMessages(list);
      void resolveAvatars(list);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, open]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('mensagens-globais')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_globais' },
        payload => {
          const msg = payload.new as GlobalMsg;
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
          void resolveAvatars([msg]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, resolveAvatars]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open && !sending) inputRef.current?.focus();
  }, [open, sending]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !user) return;
    setSending(true);
    setInput('');
    const { data, error } = await supabase
      .from('mensagens_globais')
      .insert({
        user_id: user.id,
        autor_nome: profile?.nome || '',
        autor_email: profile?.email || user.email || '',
        autor_avatar_path: avatarPath,
        content: text,
      })
      .select('id, user_id, autor_nome, autor_email, autor_avatar_path, content, created_at')
      .maybeSingle();
    if (error) {
      toast.error('Falha ao enviar mensagem.');
      setInput(text);
    } else if (data) {
      const msg = data as GlobalMsg;
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const items = useMemo(() => messages, [messages]);

  if (!user) return null;

  return (
    <>
      {!open && !hideBubble && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
          aria-label="Abrir chat global"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(92vw,420px)] h-[min(80vh,620px)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="font-display font-bold text-sm">Chat Global</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded hover:bg-white/10 flex items-center justify-center"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50">
            {loading && (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma mensagem ainda. Seja o primeiro a falar com a equipe!
              </div>
            )}
            {items.map(m => {
              const mine = m.user_id === user.id;
              const url = m.autor_avatar_path ? avatarUrls[m.autor_avatar_path] : null;
              return (
                <div key={m.id} className="flex gap-2 items-start">
                  <UserAvatar
                    src={url}
                    name={m.autor_nome}
                    email={m.autor_email}
                    className="w-8 h-8 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-display font-bold text-foreground truncate">
                        {m.autor_nome || m.autor_email || 'Usuário'}
                        {mine && ' (você)'}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(m.created_at)}
                      </span>
                    </div>
                    <div
                      className={`mt-1 inline-block max-w-full rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                        mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-2 flex gap-2 items-end bg-card">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder="Escreva uma mensagem para todos..."
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-32"
            />
            <Button onClick={sendMessage} disabled={sending || !input.trim()} size="icon">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalChat;
