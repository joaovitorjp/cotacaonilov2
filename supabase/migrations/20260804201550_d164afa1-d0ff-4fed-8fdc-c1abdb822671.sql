-- Passo 1: Criar enum de roles se não existir
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Passo 2: Tabela de Redes (Tenants)
CREATE TABLE IF NOT EXISTS public.networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.networks TO authenticated;
GRANT ALL ON public.networks TO service_role;

-- Passo 3: Adicionar colunas de rede nas tabelas que existem
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN network_id UUID REFERENCES public.networks(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.listas ADD COLUMN network_id UUID REFERENCES public.networks(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN network_id UUID REFERENCES public.networks(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Passo 4: Tabela de Roles (Segurança) já existe mas vamos garantir permissões
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Passo 5: Função de verificação de role (Security Definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Passo 6: Ativar RLS e Criar Políticas básicas
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage networks" ON public.networks;
CREATE POLICY "Admins can manage networks" ON public.networks
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Passo 7: Inserir a rede padrão "Nilo Atacadista" se não houver nenhuma
INSERT INTO public.networks (name, slug)
SELECT 'Nilo Atacadista', 'nilo'
WHERE NOT EXISTS (SELECT 1 FROM public.networks LIMIT 1);

-- Passo 8: Garantir que o usuário master tenha a role admin
DO $$ 
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'adrian33@redenilo.com.br';
    
    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;
