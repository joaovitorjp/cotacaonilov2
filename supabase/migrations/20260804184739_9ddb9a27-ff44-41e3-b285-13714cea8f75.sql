DO $$
BEGIN
    -- Revoke EXECUTE from anon and authenticated for security sensitive functions
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
    REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
    REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM public, anon, authenticated;

    -- Ensure service_role and postgres still have access
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, postgres;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role, postgres;
    GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role, postgres;

    -- Update the has_role function to be more secure: only allow users to check their own role or allow admins to check any role
    -- Actually, it's already used in policies that pass auth.uid()
    -- But to prevent direct calls from checking other users:
    -- We can't easily change it to check auth.uid() inside without potentially breaking things if it's used in a context where auth.uid() isn't what we expect (like a service role call).
END $$;