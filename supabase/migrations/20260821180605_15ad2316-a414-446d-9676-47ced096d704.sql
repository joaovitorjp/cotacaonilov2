CREATE OR REPLACE FUNCTION public.enviar_resposta_cotacao(_token uuid, _resposta jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _link public.links_cotacao%ROWTYPE;
  _resposta_id uuid;
  _item jsonb;
  _allow_mt boolean;
  _allow_go boolean;
  _v text;
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

  IF jsonb_typeof(_resposta) <> 'array' THEN
    RAISE EXCEPTION 'Formato de resposta inválido';
  END IF;

  _allow_mt := _link.estados IN ('MT', 'AMBOS');
  _allow_go := _link.estados IN ('GO', 'AMBOS');

  FOR _item IN SELECT * FROM jsonb_array_elements(_resposta) LOOP
    _v := NULLIF(trim(COALESCE(_item->>'preco_mt', '')), '');
    IF _v IS NOT NULL THEN
      IF NOT _allow_mt THEN
        RAISE EXCEPTION 'Preços de MT não são permitidos neste link';
      END IF;
      IF replace(_v, ',', '.') !~ '^[0-9]+(\.[0-9]+)?$' THEN
        RAISE EXCEPTION 'Preço inválido informado (MT): %', _v;
      END IF;
    END IF;

    _v := NULLIF(trim(COALESCE(_item->>'preco_go', '')), '');
    IF _v IS NOT NULL THEN
      IF NOT _allow_go THEN
        RAISE EXCEPTION 'Preços de GO não são permitidos neste link';
      END IF;
      IF replace(_v, ',', '.') !~ '^[0-9]+(\.[0-9]+)?$' THEN
        RAISE EXCEPTION 'Preço inválido informado (GO): %', _v;
      END IF;
    END IF;
  END LOOP;

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
$function$;