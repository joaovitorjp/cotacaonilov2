ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS codigo_interno_ciss_mt text,
  ADD COLUMN IF NOT EXISTS codigo_interno_ciss_go text,
  ADD COLUMN IF NOT EXISTS codigo_interno_consinco_mt text,
  ADD COLUMN IF NOT EXISTS codigo_interno_consinco_go text;

UPDATE public.fornecedores
SET codigo_interno_ciss_mt = COALESCE(codigo_interno_ciss_mt, codigo_interno_ciss),
    codigo_interno_consinco_mt = COALESCE(codigo_interno_consinco_mt, codigo_interno_consinco)
WHERE COALESCE(upper(codigo_estado), 'MT') = 'MT';

UPDATE public.fornecedores
SET codigo_interno_ciss_go = COALESCE(codigo_interno_ciss_go, codigo_interno_ciss),
    codigo_interno_consinco_go = COALESCE(codigo_interno_consinco_go, codigo_interno_consinco)
WHERE upper(codigo_estado) = 'GO';