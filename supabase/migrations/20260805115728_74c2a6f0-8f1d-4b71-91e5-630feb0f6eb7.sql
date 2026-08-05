DROP POLICY IF EXISTS "Usuários acessam apenas seu próprio perfil ou admins da mesma" ON public.profiles;

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
$$;

DROP POLICY IF EXISTS "Listas acessíveis por empresa" ON public.listas;
CREATE POLICY "Listas acessíveis por empresa" ON public.listas
FOR ALL TO authenticated
USING (empresa_id = public.current_empresa_id())
WITH CHECK (empresa_id = public.current_empresa_id());

DROP POLICY IF EXISTS "Respostas acessíveis por empresa" ON public.respostas;
CREATE POLICY "Respostas acessíveis por empresa" ON public.respostas
FOR ALL TO authenticated
USING (empresa_id = public.current_empresa_id())
WITH CHECK (empresa_id = public.current_empresa_id());

DROP POLICY IF EXISTS "Links acessíveis por empresa" ON public.links_cotacao;
CREATE POLICY "Links acessíveis por empresa" ON public.links_cotacao
FOR ALL TO authenticated
USING (empresa_id = public.current_empresa_id())
WITH CHECK (empresa_id = public.current_empresa_id());

DROP POLICY IF EXISTS "Fornecedores acessíveis por empresa" ON public.fornecedores;
CREATE POLICY "Fornecedores acessíveis por empresa" ON public.fornecedores
FOR ALL TO authenticated
USING (empresa_id = public.current_empresa_id())
WITH CHECK (empresa_id = public.current_empresa_id());