-- Add codigo_interno to fornecedores table
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS codigo_interno TEXT;

-- Verify RLS policies are correct for the new column (usually inherited)
-- Ensure admin has full access if not already
GRANT ALL ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
