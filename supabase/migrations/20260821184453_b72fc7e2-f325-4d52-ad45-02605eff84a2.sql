CREATE OR REPLACE FUNCTION public.listar_usuarios_chat()
RETURNS TABLE (user_id uuid, nome text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.nome, p.email
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.user_id <> auth.uid()
  ORDER BY p.nome
$$;

REVOKE ALL ON FUNCTION public.listar_usuarios_chat() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_chat() TO authenticated;