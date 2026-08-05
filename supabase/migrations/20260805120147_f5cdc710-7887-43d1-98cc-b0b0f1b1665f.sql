DROP POLICY IF EXISTS "Listas acessíveis por empresa" ON public.listas;
DROP POLICY IF EXISTS "Users can manage their network lists" ON public.listas;

DROP POLICY IF EXISTS "Respostas acessíveis por empresa" ON public.respostas;
DROP POLICY IF EXISTS "Users can manage their network responses" ON public.respostas;

DROP POLICY IF EXISTS "Links acessíveis por empresa" ON public.links_cotacao;
DROP POLICY IF EXISTS "Users can manage their network links" ON public.links_cotacao;

DROP POLICY IF EXISTS "Fornecedores acessíveis por empresa" ON public.fornecedores;
DROP POLICY IF EXISTS "Users can manage their network suppliers" ON public.fornecedores;

DROP POLICY IF EXISTS "Admins can view all fornecedores" ON public.fornecedores;
CREATE POLICY "Admins can view all fornecedores"
ON public.fornecedores
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));