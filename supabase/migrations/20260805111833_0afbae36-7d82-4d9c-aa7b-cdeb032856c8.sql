-- ETAPA 1: Reestruturação do Banco de Dados (Tenantização)

-- 1. Nova Tabela empresas
CREATE TABLE IF NOT EXISTS public.empresas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    cnpj text,
    logo_url text,
    cor_primaria text DEFAULT '#3B82F6',
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresas são visíveis para usuários autenticados"
ON public.empresas FOR SELECT TO authenticated USING (true);

-- 2. Modificação de Tabelas Existentes
-- Adicionar empresa_id em perfis (profiles)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.profiles ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    END IF;
END $$;

-- Adicionar empresa_id em listas (cotações)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listas' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.listas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    END IF;
END $$;

-- Adicionar empresa_id em fornecedores
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fornecedores' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.fornecedores ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    END IF;
END $$;

-- Adicionar empresa_id em respostas
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'respostas' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.respostas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    END IF;
END $$;

-- Adicionar empresa_id em links_cotacao
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'links_cotacao' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.links_cotacao ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    END IF;
END $$;

-- ETAPA 2: Migração Segura de Dados (Nilo Atacadista)

-- 1. Inserir registro para "Rede Nilo"
INSERT INTO public.empresas (nome, cor_primaria)
VALUES ('Rede Nilo', '#1E40AF')
ON CONFLICT (nome) DO NOTHING;

-- 2. Atualizar todas as tabelas para associar dados à "Rede Nilo"
DO $$
DECLARE
    nilo_id uuid;
BEGIN
    SELECT id INTO nilo_id FROM public.empresas WHERE nome = 'Rede Nilo' LIMIT 1;

    UPDATE public.profiles SET empresa_id = nilo_id WHERE empresa_id IS NULL;
    UPDATE public.listas SET empresa_id = nilo_id WHERE empresa_id IS NULL;
    UPDATE public.fornecedores SET empresa_id = nilo_id WHERE empresa_id IS NULL;
    UPDATE public.respostas SET empresa_id = nilo_id WHERE empresa_id IS NULL;
    UPDATE public.links_cotacao SET empresa_id = nilo_id WHERE empresa_id IS NULL;

    -- 3. Tornar empresa_id NOT NULL
    ALTER TABLE public.profiles ALTER COLUMN empresa_id SET NOT NULL;
    ALTER TABLE public.listas ALTER COLUMN empresa_id SET NOT NULL;
    ALTER TABLE public.fornecedores ALTER COLUMN empresa_id SET NOT NULL;
    ALTER TABLE public.respostas ALTER COLUMN empresa_id SET NOT NULL;
    ALTER TABLE public.links_cotacao ALTER COLUMN empresa_id SET NOT NULL;
END $$;

-- ETAPA 5: Adicionar is_super_admin
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_super_admin') THEN
        ALTER TABLE public.profiles ADD COLUMN is_super_admin boolean DEFAULT false;
    END IF;
END $$;

-- Definindo usuário específico como Super Admin
UPDATE public.profiles
SET is_super_admin = true
WHERE email = 'joaovitorjp2003@gmail.com';
