-- Adicionar coluna codigo_interno na tabela fornecedores
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS codigo_interno TEXT;

-- Atualizar permissões (GRANT já deve existir, mas garantindo)
GRANT ALL ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
