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

  const pushMsg = (msg: GlobalMsg) =>
    setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));

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
      .select(MSG_COLS)
      .maybeSingle();
    if (error) {
      toast.error('Falha ao enviar mensagem.');
      setInput(text);
    } else if (data) {
      pushMsg(data as unknown as GlobalMsg);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  /** Usuários conhecidos = autores/mencionados presentes no histórico do chat. */
  const participantes = useMemo(() => {
    const map = new Map<string, string>();
    messages.forEach(m => {
      if (m.user_id !== user?.id) map.set(m.user_id, m.autor_nome || m.autor_email || 'Usuário');
      if (m.mentioned_user_id && m.mentioned_user_id !== user?.id)
        map.set(m.mentioned_user_id, m.mentioned_nome || 'Usuário');
    });
    return Array.from(map, ([id, nome]) => ({ id, nome }));
  }, [messages, user?.id]);

  const openShare = async () => {
    if (!user) return;
    setShareOpen(true);
    const { data } = await supabase
      .from('listas')
      .select('id, nome, status, produtos')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setListas((data ?? []) as unknown as SharedLista[]);
  };

  const shareLista = async () => {
    if (!user || !listaId || !targetId) return;
    const lista = listas.find(l => l.id === listaId);
    const alvo = participantes.find(p => p.id === targetId);
    if (!lista || !alvo) return;
    setSharing(true);
    const { data, error } = await supabase
      .from('mensagens_globais')
      .insert({
        user_id: user.id,
        autor_nome: profile?.nome || '',
        autor_email: profile?.email || user.email || '',
        autor_avatar_path: avatarPath,
        content: `@${alvo.nome} compartilhei a cotação "${lista.nome}".`,
        shared_lista: {
          id: lista.id,
          nome: lista.nome,
          status: lista.status,
          produtos: Array.isArray(lista.produtos) ? lista.produtos : [],
        } as any,
        mentioned_user_id: alvo.id,
        mentioned_nome: alvo.nome,
      })
      .select(MSG_COLS)
      .maybeSingle();
    setSharing(false);
    if (error) {
      toast.error('Falha ao compartilhar a cotação.');
      return;
    }
    if (data) pushMsg(data as unknown as GlobalMsg);
    setShareOpen(false);
    setListaId('');
    setTargetId('');
    toast.success('Cotação compartilhada.');
  };

  const salvarCotacao = async (m: GlobalMsg) => {
    if (!user || !m.shared_lista) return;
    setSavingId(m.id);
    const { error } = await supabase.from('listas').insert({
      nome: `${m.shared_lista.nome} (de ${m.autor_nome || m.autor_email})`,
      status: 'finalizada',
      produtos: (m.shared_lista.produtos ?? []) as any,
      user_id: user.id,
    });
    if (error) {
      setSavingId(null);
      toast.error('Não foi possível salvar a cotação.');
      return;
    }
    const saved = Array.from(new Set([...(m.saved_by ?? []), user.id]));
    await supabase.from('mensagens_globais').update({ saved_by: saved }).eq('id', m.id);
    setMessages(prev => prev.map(x => (x.id === m.id ? { ...x, saved_by: saved } : x)));
    setSavingId(null);
    toast.success('Cotação salva em Cotações Finalizadas.');
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

                    {m.shared_lista && (
                      <div className="mt-2 rounded-lg border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-display font-bold text-foreground">
                          <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate">{m.shared_lista.nome}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(m.shared_lista.produtos?.length ?? 0)} produtos · para{' '}
                          <span className="font-semibold">{m.mentioned_nome}</span>
                        </div>
                        {m.mentioned_user_id === user.id &&
                          ((m.saved_by ?? []).includes(user.id) ? (
                            <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                              <Check className="h-3.5 w-3.5" /> Salva em Cotações Finalizadas
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              className="w-full"
                              disabled={savingId === m.id}
                              onClick={() => void salvarCotacao(m)}
                            >
                              {savingId === m.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Salvar em Finalizadas'
                              )}
                            </Button>
                          ))}
                      </div>
                    )}
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
            <Button variant="outline" size="icon" onClick={openShare} title="Compartilhar cotação">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button onClick={sendMessage} disabled={sending || !input.trim()} size="icon">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>Compartilhar cotação</DialogTitle>
            <DialogDescription>
              Escolha a cotação e o usuário que poderá salvá-la nas cotações finalizadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Cotação</label>
              <select
                value={listaId}
                onChange={e => setListaId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {listas.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.nome} ({l.status})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Marcar usuário</label>
              <select
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {participantes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              {participantes.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nenhum outro usuário no chat ainda. Peça para ele enviar uma mensagem primeiro.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void shareLista()} disabled={!listaId || !targetId || sharing}>
              {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Compartilhar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>

  );
};

export default GlobalChat;
