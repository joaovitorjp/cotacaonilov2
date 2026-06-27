
CREATE POLICY "Admins can view all listas"
  ON public.listas FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all respostas"
  ON public.respostas FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all links_cotacao"
  ON public.links_cotacao FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all price_markups"
  ON public.price_markups FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
