
-- Create table for lists (quotation lists)
CREATE TABLE public.listas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'finalizada')),
  produtos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for quotation links
CREATE TABLE public.links_cotacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_id UUID NOT NULL REFERENCES public.listas(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  respondido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for responses
CREATE TABLE public.respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_id UUID NOT NULL REFERENCES public.listas(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL,
  resposta JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.listas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_cotacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required for this simple system)
CREATE POLICY "Allow all access to listas" ON public.listas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to links_cotacao" ON public.links_cotacao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to respostas" ON public.respostas FOR ALL USING (true) WITH CHECK (true);

-- Create unique index on token for link lookup
CREATE UNIQUE INDEX idx_links_cotacao_token ON public.links_cotacao(token);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_listas_updated_at
  BEFORE UPDATE ON public.listas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
