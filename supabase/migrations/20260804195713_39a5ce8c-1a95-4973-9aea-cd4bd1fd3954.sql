-- Create user if not exists
-- Note: We can't set password directly in SQL for Auth easily without extensions, 
-- but we can ensure the role exists for this email if it ever signs up or if we use service role.
-- However, the user asked to "include" this user.

-- Ensure the 'admin' role exists for adrian33@redenilo.com.br if the user exists
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'adrian33@redenilo.com.br';
    
    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;
