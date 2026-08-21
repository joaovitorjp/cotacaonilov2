ALTER TABLE public.mensagens_globais
  ADD COLUMN IF NOT EXISTS shared_lista jsonb,
  ADD COLUMN IF NOT EXISTS mentioned_user_id uuid,
  ADD COLUMN IF NOT EXISTS mentioned_nome text,
  ADD COLUMN IF NOT EXISTS saved_by uuid[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS "Mentioned user can mark shared quote as saved" ON public.mensagens_globais;
CREATE POLICY "Mentioned user can mark shared quote as saved"
  ON public.mensagens_globais FOR UPDATE TO authenticated
  USING (auth.uid() = mentioned_user_id)
  WITH CHECK (auth.uid() = mentioned_user_id);