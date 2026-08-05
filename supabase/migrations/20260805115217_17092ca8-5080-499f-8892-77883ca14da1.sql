CREATE OR REPLACE FUNCTION public.default_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
    (SELECT e.id FROM public.empresas e ORDER BY e.created_at NULLS LAST LIMIT 1)
  )
$$;

ALTER TABLE public.listas ALTER COLUMN empresa_id SET DEFAULT public.default_empresa_id();
ALTER TABLE public.respostas ALTER COLUMN empresa_id SET DEFAULT public.default_empresa_id();
ALTER TABLE public.links_cotacao ALTER COLUMN empresa_id SET DEFAULT public.default_empresa_id();
ALTER TABLE public.fornecedores ALTER COLUMN empresa_id SET DEFAULT public.default_empresa_id();
ALTER TABLE public.profiles ALTER COLUMN empresa_id SET DEFAULT public.default_empresa_id();