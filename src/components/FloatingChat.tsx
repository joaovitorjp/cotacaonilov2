import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, Send, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChatMsg {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface FloatingChatProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideBubble?: boolean;
}

const FloatingChat: React.FC<FloatingChatProps> = ({ open: openProp, onOpenChange, hideBubble }) => {
  const { user } = useAuth();
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setOpenState(v);
  };
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user || !open) return;
    (async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, role, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100);
      if (data) {
        setMessages(
          data
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any) => ({ id: m.id, role: m.role, content: m.content }))
        );
      }
    })();
  }, [user, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => {
    if (open && !loading) inputRef.current?.focus();
  }, [open, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || !user) return;
    const userMsg: ChatMsg = { role: 'user', content: text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);
    setStreaming('');

    // Persist user msg
    supabase.from('chat_messages').insert({ user_id: user.id, role: 'user', content: text });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectUrl = (supabase as any).supabaseUrl as string;
      const resp = await fetch(`${projectUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ messages: newMsgs.map(m => ({ role: m.role, content: m.content })) }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => '');
        let errMsg = 'Erro ao consultar IA.';
        try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
        if (resp.status === 429) errMsg = 'Limite de uso atingido. Tente em instantes.';
        if (resp.status === 402) errMsg = 'Créditos de IA esgotados.';
        toast.error(errMsg);
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setStreaming(assistantText);
            }
          } catch {}
        }
      }

      if (assistantText) {
        setMessages(prev => [...prev, { role: 'assistant', content: assistantText }]);
        supabase.from('chat_messages').insert({ user_id: user.id, role: 'assistant', content: assistantText });
      }
      setStreaming('');
    } catch (e) {
      toast.error('Falha de conexão com a IA.');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    if (!confirm('Limpar todo o histórico desta conversa?')) return;
    await supabase.from('chat_messages').delete().eq('user_id', user.id);
    setMessages([]);
    toast.success('Histórico limpo.');
  };

  if (!user) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
          aria-label="Abrir chat IA"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(92vw,400px)] h-[min(80vh,600px)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="font-display font-bold text-sm">Assistente IA</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearHistory}
                className="h-7 w-7 rounded hover:bg-white/10 flex items-center justify-center"
                title="Limpar histórico"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded hover:bg-white/10 flex items-center justify-center"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
            {messages.length === 0 && !streaming && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Olá! Sou o assistente do sistema. Posso responder sobre suas cotações, fornecedores e como usar as funcionalidades.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-muted text-foreground">
                  {streaming}
                </div>
              </div>
            )}
            {loading && !streaming && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 text-sm bg-muted text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-2 flex gap-2 items-end bg-card">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              placeholder="Pergunte sobre suas cotações..."
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-32"
              disabled={loading}
            />
            <Button onClick={sendMessage} disabled={loading || !input.trim()} size="icon">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingChat;
