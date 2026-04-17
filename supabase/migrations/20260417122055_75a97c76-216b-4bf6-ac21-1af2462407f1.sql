CREATE TABLE public.estoques_manuais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  loja TEXT NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  venda NUMERIC NOT NULL DEFAULT 0,
  estoque NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, loja, mes)
);

ALTER TABLE public.estoques_manuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own estoques_manuais"
ON public.estoques_manuais
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_estoques_manuais_updated_at
BEFORE UPDATE ON public.estoques_manuais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();