CREATE TABLE public.mensagens_globais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  autor_nome text NOT NULL DEFAULT '',
  autor_email text NOT NULL DEFAULT '',
  autor_avatar_path text,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens_globais TO authenticated;
GRANT ALL ON public.mensagens_globais TO service_role;

ALTER TABLE public.mensagens_globais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all global messages"
  ON public.mensagens_globais FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own global messages"
  ON public.mensagens_globais FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own global messages"
  ON public.mensagens_globais FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_mensagens_globais_created_at ON public.mensagens_globais (created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_globais;