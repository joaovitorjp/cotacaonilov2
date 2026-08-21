DROP POLICY IF EXISTS "auth read avarias" ON public.avarias;
CREATE POLICY "owner or admin read avarias" ON public.avarias
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.avarias_uploads u
    WHERE u.id = avarias.upload_id AND u.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "auth read avarias_uploads" ON public.avarias_uploads;
CREATE POLICY "owner or admin read avarias_uploads" ON public.avarias_uploads
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());