ALTER TABLE public.links_cotacao
  ADD COLUMN IF NOT EXISTS frete_mt text NOT NULL DEFAULT 'CIF',
  ADD COLUMN IF NOT EXISTS frete_go text NOT NULL DEFAULT 'CIF';

CREATE OR REPLACE FUNCTION public.get_cotacao_por_token(_token uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'link', jsonb_build_object(
      'id', lc.id,
      'lista_id', lc.lista_id,
      'empresa', lc.empresa,
      'respondido', lc.respondido,
      'estados', lc.estados,
      'tipo_preco', lc.tipo_preco,
      'tipo_preco_mt', lc.tipo_preco_mt,
      'tipo_preco_go', lc.tipo_preco_go,
      'frete_mt', lc.frete_mt,
      'frete_go', lc.frete_go
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
$function$;