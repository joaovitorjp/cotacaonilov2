
-- Tabela de uploads
CREATE TABLE public.estoques_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loja TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('vendas', 'estoque')),
  referencia TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estoques_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own estoques_uploads" ON public.estoques_uploads
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_estoques_uploads_user_loja ON public.estoques_uploads(user_id, loja);

-- Tabela de resultados calculados
CREATE TABLE public.estoques_resultados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loja TEXT NOT NULL,
  codigo_produto TEXT NOT NULL,
  estoque_atual NUMERIC NOT NULL DEFAULT 0,
  media_vendas NUMERIC NOT NULL DEFAULT 0,
  dias_cobertura NUMERIC,
  meses_considerados INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, loja, codigo_produto)
);

ALTER TABLE public.estoques_resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own estoques_resultados" ON public.estoques_resultados
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_estoques_resultados_user_loja ON public.estoques_resultados(user_id, loja);
CREATE INDEX idx_estoques_resultados_codigo ON public.estoques_resultados(user_id, codigo_produto);
CREATE INDEX idx_estoques_resultados_dias ON public.estoques_resultados(user_id, dias_cobertura);

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public) VALUES ('estoques', 'estoques', false);

CREATE POLICY "Users read own estoques files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'estoques' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own estoques files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'estoques' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own estoques files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'estoques' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own estoques files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'estoques' AND auth.uid()::text = (storage.foldername(name))[1]);
