
CREATE TABLE public.price_markups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_id UUID REFERENCES public.listas(id) ON DELETE CASCADE NOT NULL,
  empresa TEXT NOT NULL,
  markup_percent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lista_id, empresa)
);

ALTER TABLE public.price_markups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to price_markups" ON public.price_markups
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
