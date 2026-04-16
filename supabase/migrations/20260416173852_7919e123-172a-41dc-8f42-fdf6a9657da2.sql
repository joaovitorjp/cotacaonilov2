
-- Add user_id to listas
ALTER TABLE public.listas ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to fornecedores
ALTER TABLE public.fornecedores ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to respostas
ALTER TABLE public.respostas ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to links_cotacao
ALTER TABLE public.links_cotacao ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to price_markups
ALTER TABLE public.price_markups ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old admin policies
DROP POLICY IF EXISTS "Admin full access to listas" ON public.listas;
DROP POLICY IF EXISTS "Admin full access to fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Admin full access to respostas" ON public.respostas;
DROP POLICY IF EXISTS "Admin full access to links_cotacao" ON public.links_cotacao;
DROP POLICY IF EXISTS "Admin full access to price_markups" ON public.price_markups;

-- Listas: users see only their own
CREATE POLICY "Users manage own listas" ON public.listas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fornecedores: users see only their own
DROP POLICY IF EXISTS "Public read fornecedores" ON public.fornecedores;
CREATE POLICY "Users manage own fornecedores" ON public.fornecedores FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Respostas: users manage their own, anon can still insert/read/update (for cotacao responses)
CREATE POLICY "Users manage own respostas" ON public.respostas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Links_cotacao: users manage their own, anon can still read/update
CREATE POLICY "Users manage own links_cotacao" ON public.links_cotacao FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Price_markups: users manage their own
CREATE POLICY "Users manage own price_markups" ON public.price_markups FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_listas_user_id ON public.listas(user_id);
CREATE INDEX idx_fornecedores_user_id ON public.fornecedores(user_id);
CREATE INDEX idx_respostas_user_id ON public.respostas(user_id);
CREATE INDEX idx_links_cotacao_user_id ON public.links_cotacao(user_id);
CREATE INDEX idx_price_markups_user_id ON public.price_markups(user_id);
