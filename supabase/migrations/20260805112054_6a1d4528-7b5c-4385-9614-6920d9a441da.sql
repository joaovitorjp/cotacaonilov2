-- Adiciona a coluna slug à tabela empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS slug TEXT;

-- Cria um índice para buscas rápidas pelo slug
CREATE INDEX IF NOT EXISTS idx_empresas_slug ON public.empresas(slug);

-- Atualiza a empresa Nilo com o slug padrão
UPDATE public.empresas SET slug = 'nilo' WHERE nome = 'Rede Nilo' AND slug IS NULL;

-- Garante que o slug seja único se não for nulo
ALTER TABLE public.empresas ADD CONSTRAINT unique_empresas_slug UNIQUE (slug);
