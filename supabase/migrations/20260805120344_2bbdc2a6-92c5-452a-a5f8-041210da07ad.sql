DROP POLICY IF EXISTS "Public read listas" ON public.listas;
DROP POLICY IF EXISTS "Public read lists by token" ON public.listas;
DROP POLICY IF EXISTS "Acesso público via token para links" ON public.links_cotacao;
DROP POLICY IF EXISTS "Public access links by token" ON public.links_cotacao;
DROP POLICY IF EXISTS "Public read links_cotacao by token" ON public.links_cotacao;
DROP POLICY IF EXISTS "Public update links_cotacao respondido" ON public.links_cotacao;
DROP POLICY IF EXISTS "Acesso público via token para inserção de respostas" ON public.respostas;
DROP POLICY IF EXISTS "Acesso público via token para respostas" ON public.respostas;
DROP POLICY IF EXISTS "Public access responses" ON public.respostas;
DROP POLICY IF EXISTS "Public insert respostas" ON public.respostas;
DROP POLICY IF EXISTS "Public update respostas" ON public.respostas;
DROP POLICY IF EXISTS "Public read respostas" ON public.respostas;

REVOKE ALL ON public.listas FROM anon;
REVOKE ALL ON public.links_cotacao FROM anon;
REVOKE ALL ON public.respostas FROM anon;

CREATE OR REPLACE FUNCTION public.get_cotacao_por_token(_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'link', jsonb_build_object(
      'id', lc.id,
      'lista_id', lc.lista_id,
      'empresa', lc.empresa,
      'respondido', lc.respondido,
      'estados', lc.estados,
      'tipo_preco', lc.tipo_preco
    ),
    'lista', jsonb_build_object(
      'id', l.id,
      'nome', l.nome,
      'status', l.status,
      'produtos', l.produtos,
      'prazo', l.prazo
    ),
    'resposta', (
      SELECT jsonb_build_object('id', r.id, 'resposta', r.resposta)
      FROM public.respostas r
      WHERE r.lista_id = lc.lista_id
        AND r.empresa = lc.empresa
        AND r.user_id = lc.user_id
      ORDER BY r.created_at DESC
      LIMIT 1
    )
  )
  FROM public.links_cotacao lc
  JOIN public.listas l
    ON l.id = lc.lista_id
   AND l.user_id = lc.user_id
  WHERE lc.token = _token
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.enviar_resposta_cotacao(
  _token uuid,
  _resposta jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link public.links_cotacao%ROWTYPE;
  _resposta_id uuid;
BEGIN
  SELECT * INTO _link
  FROM public.links_cotacao
  WHERE token = _token
  FOR UPDATE;

  IF _link.id IS NULL THEN
    RAISE EXCEPTION 'Link de cotação inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.listas l
    WHERE l.id = _link.lista_id
      AND l.user_id = _link.user_id
      AND l.status = 'aberta'
      AND (l.prazo IS NULL OR l.prazo >= now())
  ) THEN
    RAISE EXCEPTION 'Cotação indisponível ou encerrada';
  END IF;

  SELECT r.id INTO _resposta_id
  FROM public.respostas r
  WHERE r.lista_id = _link.lista_id
    AND r.empresa = _link.empresa
    AND r.user_id = _link.user_id
  ORDER BY r.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF _resposta_id IS NULL THEN
    INSERT INTO public.respostas (
      lista_id, empresa, resposta, user_id, network_id, empresa_id
    ) VALUES (
      _link.lista_id,
      _link.empresa,
      _resposta,
      _link.user_id,
      _link.network_id,
      _link.empresa_id
    )
    RETURNING id INTO _resposta_id;
  ELSE
    UPDATE public.respostas
    SET resposta = _resposta
    WHERE id = _resposta_id;
  END IF;

  UPDATE public.links_cotacao
  SET respondido = true
  WHERE id = _link.id;

  RETURN _resposta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cotacao_por_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enviar_resposta_cotacao(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cotacao_por_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_resposta_cotacao(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cotacao_por_token(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enviar_resposta_cotacao(uuid, jsonb) TO service_role;