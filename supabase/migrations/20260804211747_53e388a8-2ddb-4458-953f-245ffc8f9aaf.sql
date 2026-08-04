DO $$ 
BEGIN
    UPDATE public.profiles SET network_id = '339d7b85-036f-4a7a-beee-5d926126b62c' WHERE network_id IS NULL;
    UPDATE public.listas SET network_id = '339d7b85-036f-4a7a-beee-5d926126b62c' WHERE network_id IS NULL;
    UPDATE public.fornecedores SET network_id = '339d7b85-036f-4a7a-beee-5d926126b62c' WHERE network_id IS NULL;
END $$;