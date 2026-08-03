-- Adiciona a coluna tipo_preco à tabela links_cotacao
ALTER TABLE public.links_cotacao ADD COLUMN tipo_preco text DEFAULT 'IPI_ST';

-- Atualiza os GRANTs para garantir que a API possa ler/escrever a nova coluna
GRANT ALL ON public.links_cotacao TO authenticated;
GRANT ALL ON public.links_cotacao TO service_role;
GRANT SELECT ON public.links_cotacao TO anon;
