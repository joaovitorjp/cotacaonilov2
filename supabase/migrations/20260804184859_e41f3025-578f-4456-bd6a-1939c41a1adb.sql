DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'avarias', 'avarias_uploads', 'chat_messages', 'estoques_manuais', 
        'estoques_resultados', 'estoques_uploads', 'fornecedores', 
        'links_cotacao', 'listas', 'respostas', 'user_roles', 'profiles', 
        'price_markups', 'perfil'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
            EXECUTE format('REVOKE ALL ON public.%I FROM authenticated;', t);
            
            -- Re-grant based on standard practices: 
            -- link_cotacao, respostas, listas need SELECT for anon (via UUID token in app)
            -- respostass also needs INSERT/UPDATE for anon
            IF t IN ('links_cotacao', 'respostas', 'listas') THEN
                EXECUTE format('GRANT SELECT ON public.%I TO anon;', t);
                IF t = 'respostas' THEN
                    EXECUTE format('GRANT INSERT, UPDATE ON public.%I TO anon;', t);
                END IF;
                IF t = 'links_cotacao' THEN
                    EXECUTE format('GRANT UPDATE ON public.%I TO anon;', t);
                END IF;
            END IF;

            -- Authenticated users need full access to their own data
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
            EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
        END IF;
    END LOOP;
END $$;