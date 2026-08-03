ALTER TABLE public.fornecedores 
ADD COLUMN IF NOT EXISTS nome_representante TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.fornecedores.nome IS 'Nome fantasia da empresa';
COMMENT ON COLUMN public.fornecedores.nome_representante IS 'Nome do representante do fornecedor';
COMMENT ON COLUMN public.fornecedores.email IS 'E-mail de contato';
