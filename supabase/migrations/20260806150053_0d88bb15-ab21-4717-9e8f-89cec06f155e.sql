-- Add info_preco column to links_cotacao
ALTER TABLE public.links_cotacao ADD COLUMN IF NOT EXISTS info_preco TEXT;

-- Update existing links based on state:
-- MT = IPI + ST
-- GO = PRECO NOTA
UPDATE public.links_cotacao 
SET info_preco = CASE 
    WHEN estados = 'GO' THEN 'PRECO NOTA' 
    ELSE 'IPI + ST' 
END
WHERE info_preco IS NULL;
