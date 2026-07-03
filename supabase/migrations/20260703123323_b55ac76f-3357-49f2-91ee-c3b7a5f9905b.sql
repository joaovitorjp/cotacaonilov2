
CREATE TABLE public.avarias_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sessao TEXT NOT NULL,
  comprador TEXT NOT NULL,
  filename TEXT,
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  total_rows INTEGER NOT NULL DEFAULT 0,
  total_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avarias_uploads TO authenticated;
GRANT ALL ON public.avarias_uploads TO service_role;
ALTER TABLE public.avarias_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read avarias_uploads" ON public.avarias_uploads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert avarias_uploads" ON public.avarias_uploads
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());
CREATE POLICY "admin update avarias_uploads" ON public.avarias_uploads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete avarias_uploads" ON public.avarias_uploads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.avarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID NOT NULL REFERENCES public.avarias_uploads(id) ON DELETE CASCADE,
  sessao TEXT NOT NULL,
  comprador TEXT NOT NULL,
  loja_numero TEXT NOT NULL,
  loja_nome TEXT NOT NULL,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  fornecedor_codigo TEXT,
  fornecedor_nome TEXT,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 0,
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avarias TO authenticated;
GRANT ALL ON public.avarias TO service_role;
ALTER TABLE public.avarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read avarias" ON public.avarias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert avarias" ON public.avarias
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update avarias" ON public.avarias
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete avarias" ON public.avarias
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_avarias_upload ON public.avarias(upload_id);
CREATE INDEX idx_avarias_sessao ON public.avarias(sessao);
CREATE INDEX idx_avarias_loja ON public.avarias(loja_numero);
CREATE INDEX idx_avarias_data ON public.avarias(data_referencia);
