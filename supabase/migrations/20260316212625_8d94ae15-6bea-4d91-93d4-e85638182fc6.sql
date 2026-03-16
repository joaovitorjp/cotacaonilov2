
-- Add deadline column to listas
ALTER TABLE public.listas ADD COLUMN prazo TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Enable realtime for respostas table
ALTER PUBLICATION supabase_realtime ADD TABLE public.respostas;
