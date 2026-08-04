-- 1. Create Tenancy structure
CREATE TABLE public.networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    custom_domain TEXT UNIQUE,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#0284c7',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Add network_id to existing tables
ALTER TABLE public.profiles ADD COLUMN network_id UUID REFERENCES public.networks(id);
ALTER TABLE public.cotacoes ADD COLUMN network_id UUID REFERENCES public.networks(id);
ALTER TABLE public.fornecedores ADD COLUMN network_id UUID REFERENCES public.networks(id);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.networks TO authenticated;
GRANT ALL ON public.networks TO service_role;

-- 4. RLS
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage networks" ON public.networks
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can see their own network" ON public.networks
    FOR SELECT TO authenticated
    USING (id IN (SELECT network_id FROM public.profiles WHERE id = auth.uid()));

-- 5. Seed Nilo Atacadista as the first network
INSERT INTO public.networks (name, slug) VALUES ('Nilo Atacadista', 'nilo') ON CONFLICT DO NOTHING;
