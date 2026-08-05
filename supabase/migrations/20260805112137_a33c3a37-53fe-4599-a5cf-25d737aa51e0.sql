-- Habilita RLS em todas as tabelas críticas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_cotacao ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Empresas são visíveis para usuários autenticados" ON public.empresas;
DROP POLICY IF EXISTS "Usuários veem apenas sua própria empresa" ON public.empresas;
DROP POLICY IF EXISTS "Usuários podem ver apenas seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
DROP POLICY IF EXISTS "Listas isolation" ON public.listas;
DROP POLICY IF EXISTS "Fornecedores isolation" ON public.fornecedores;
DROP POLICY IF EXISTS "Respostas isolation" ON public.respostas;
DROP POLICY IF EXISTS "Links isolation" ON public.links_cotacao;

-- Políticas para empresas
CREATE POLICY "Empresas são visíveis para usuários autenticados"
ON public.empresas FOR SELECT
TO authenticated
USING (true);

-- Políticas para profiles
CREATE POLICY "Usuários acessam apenas seu próprio perfil ou admins da mesma empresa"
ON public.profiles FOR ALL
TO authenticated
USING (
  user_id = auth.uid() OR 
  (empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()) AND 
   EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
);

-- Políticas para listas
CREATE POLICY "Listas acessíveis por empresa"
ON public.listas FOR ALL
TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()));

-- Políticas para fornecedores
CREATE POLICY "Fornecedores acessíveis por empresa"
ON public.fornecedores FOR ALL
TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()));

-- Políticas para respostas
CREATE POLICY "Respostas acessíveis por empresa"
ON public.respostas FOR ALL
TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()));

-- Permitir acesso público para cotações via token (essencial para fornecedores)
CREATE POLICY "Acesso público via token para respostas"
ON public.respostas FOR SELECT
TO anon
USING (true);

CREATE POLICY "Acesso público via token para inserção de respostas"
ON public.respostas FOR INSERT
TO anon
WITH CHECK (true);

-- Políticas para links_cotacao
CREATE POLICY "Links acessíveis por empresa"
ON public.links_cotacao FOR ALL
TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Acesso público via token para links"
ON public.links_cotacao FOR SELECT
TO anon
USING (true);

-- GRANTs necessários
GRANT SELECT ON public.empresas TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.listas TO authenticated;
GRANT ALL ON public.fornecedores TO authenticated;
GRANT ALL ON public.respostas TO authenticated;
GRANT ALL ON public.links_cotacao TO authenticated;

GRANT SELECT ON public.links_cotacao TO anon;
GRANT SELECT, INSERT, UPDATE ON public.respostas TO anon;
