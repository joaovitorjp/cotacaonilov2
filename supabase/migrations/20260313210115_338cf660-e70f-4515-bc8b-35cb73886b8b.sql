
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  contato text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to fornecedores"
ON public.fornecedores FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Public read fornecedores"
ON public.fornecedores FOR SELECT
TO anon
USING (true);
