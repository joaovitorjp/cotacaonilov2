DO $$
BEGIN
    -- Revoke public execution from security definer functions
    REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;

    -- Adjust policies for tables mentioned in the linter
    -- Table: public.avarias
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'avarias' AND schemaname = 'public') THEN
        DROP POLICY IF EXISTS "auth read avarias" ON public.avarias;
        CREATE POLICY "auth read avarias" ON public.avarias FOR SELECT TO authenticated USING (true);
        
        DROP POLICY IF EXISTS "admin update avarias" ON public.avarias;
        CREATE POLICY "admin update avarias" ON public.avarias FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
        
        DROP POLICY IF EXISTS "admin delete avarias" ON public.avarias;
        CREATE POLICY "admin delete avarias" ON public.avarias FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
        
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.avarias TO authenticated;
        GRANT ALL ON public.avarias TO service_role;
    END IF;

    -- Table: public.avarias_uploads
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'avarias_uploads' AND schemaname = 'public') THEN
        DROP POLICY IF EXISTS "auth read avarias_uploads" ON public.avarias_uploads;
        CREATE POLICY "auth read avarias_uploads" ON public.avarias_uploads FOR SELECT TO authenticated USING (true);
        
        DROP POLICY IF EXISTS "admin update avarias_uploads" ON public.avarias_uploads;
        CREATE POLICY "admin update avarias_uploads" ON public.avarias_uploads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
        
        DROP POLICY IF EXISTS "admin delete avarias_uploads" ON public.avarias_uploads;
        CREATE POLICY "admin delete avarias_uploads" ON public.avarias_uploads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
        
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.avarias_uploads TO authenticated;
        GRANT ALL ON public.avarias_uploads TO service_role;
    END IF;

    -- Table: public.chat_messages
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'chat_messages' AND schemaname = 'public') THEN
        DROP POLICY IF EXISTS "users manage own chat messages" ON public.chat_messages;
        CREATE POLICY "users manage own chat messages" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
        GRANT ALL ON public.chat_messages TO service_role;
    END IF;

    -- Table: public.estoques_manuais
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'estoques_manuais' AND schemaname = 'public') THEN
        DROP POLICY IF EXISTS "Users manage own estoques_manuais" ON public.estoques_manuais;
        CREATE POLICY "Users manage own estoques_manuais" ON public.estoques_manuais FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoques_manuais TO authenticated;
        GRANT ALL ON public.estoques_manuais TO service_role;
    END IF;

    -- Table: public.estoques_resultados
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'estoques_resultados' AND schemaname = 'public') THEN
        DROP POLICY IF EXISTS "Users manage own estoques_resultados" ON public.estoques_resultados;
        CREATE POLICY "Users manage own estoques_resultados" ON public.estoques_resultados FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoques_resultados TO authenticated;
        GRANT ALL ON public.estoques_resultados TO service_role;
    END IF;

    -- Table: public.estoques_uploads
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'estoques_uploads' AND schemaname = 'public') THEN
        DROP POLICY IF EXISTS "Users manage own estoques_uploads" ON public.estoques_uploads;
        CREATE POLICY "Users manage own estoques_uploads" ON public.estoques_uploads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoques_uploads TO authenticated;
        GRANT ALL ON public.estoques_uploads TO service_role;
    END IF;
END $$;