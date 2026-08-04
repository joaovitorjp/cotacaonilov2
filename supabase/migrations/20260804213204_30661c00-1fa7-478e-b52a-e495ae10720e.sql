
-- 1. Garantir que todas as tabelas tenham network_id
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listas' AND column_name='network_id') THEN
        ALTER TABLE public.listas ADD COLUMN network_id UUID REFERENCES public.networks(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='links_cotacao' AND column_name='network_id') THEN
        ALTER TABLE public.links_cotacao ADD COLUMN network_id UUID REFERENCES public.networks(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='respostas' AND column_name='network_id') THEN
        ALTER TABLE public.respostas ADD COLUMN network_id UUID REFERENCES public.networks(id);
    END IF;
END $$;

-- 2. Atualizar políticas RLS para isolamento por rede
-- LISTAS
DROP POLICY IF EXISTS "Admin full access to listas" ON public.listas;
DROP POLICY IF EXISTS "Public read listas" ON public.listas;

CREATE POLICY "Users can manage their network lists" ON public.listas
    FOR ALL TO authenticated
    USING (
        network_id IN (SELECT network_id FROM public.profiles WHERE user_id = auth.uid()) 
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        network_id IN (SELECT network_id FROM public.profiles WHERE user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Public read lists by token" ON public.listas
    FOR SELECT TO anon
    USING (id IN (SELECT lista_id FROM public.links_cotacao));

-- LINKS_COTACAO
DROP POLICY IF EXISTS "Admin full access to links_cotacao" ON public.links_cotacao;
DROP POLICY IF EXISTS "Public read links_cotacao by token" ON public.links_cotacao;
DROP POLICY IF EXISTS "Public update links_cotacao respondido" ON public.links_cotacao;

CREATE POLICY "Users can manage their network links" ON public.links_cotacao
    FOR ALL TO authenticated
    USING (
        network_id IN (SELECT network_id FROM public.profiles WHERE user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        network_id IN (SELECT network_id FROM public.profiles WHERE user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Public access links by token" ON public.links_cotacao
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- RESPOSTAS
DROP POLICY IF EXISTS "Admin full access to respostas" ON public.respostas;
DROP POLICY IF EXISTS "Public insert respostas" ON public.respostas;
DROP POLICY IF EXISTS "Public update respostas" ON public.respostas;
DROP POLICY IF EXISTS "Public read respostas" ON public.respostas;

CREATE POLICY "Users can manage their network responses" ON public.respostas
    FOR ALL TO authenticated
    USING (
        network_id IN (SELECT network_id FROM public.profiles WHERE user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        network_id IN (SELECT network_id FROM public.profiles WHERE user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Public access responses" ON public.respostas
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- FORNECEDORES
DROP POLICY IF EXISTS "Users can manage their network suppliers" ON public.fornecedores;
CREATE POLICY "Users can manage their network suppliers" ON public.fornecedores
    FOR ALL TO authenticated
    USING (
        network_id IN (SELECT network_id FROM public.profiles WHERE user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        network_id IN (SELECT network_id FROM public.profiles WHERE user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );
