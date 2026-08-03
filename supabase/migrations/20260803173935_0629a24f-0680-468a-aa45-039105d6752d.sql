ALTER TABLE public.fornecedores 
ADD COLUMN IF NOT EXISTS codigo_interno_ciss TEXT,
ADD COLUMN IF NOT EXISTS codigo_interno_consinco TEXT;

UPDATE public.fornecedores 
SET codigo_interno_ciss = codigo_interno
WHERE codigo_interno IS NOT NULL AND codigo_interno_ciss IS NULL;
