-- Adiciona novas colunas para separar os códigos internos
ALTER TABLE public.fornecedores 
ADD COLUMN codigo_interno_ciss TEXT,
ADD COLUMN codigo_interno_consinco TEXT;

-- Migra dados existentes de codigo_interno para codigo_interno_ciss (como fallback padrão)
UPDATE public.fornecedores 
SET codigo_interno_ciss = codigo_interno
WHERE codigo_interno IS NOT NULL;

-- Mantém a coluna antiga por enquanto para não quebrar o código antes do deploy,
-- mas removemos o uso no frontend no próximo passo.
