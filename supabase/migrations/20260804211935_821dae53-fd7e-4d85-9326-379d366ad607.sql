CREATE TABLE public.master_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id UUID REFERENCES public.networks(id) ON DELETE CASCADE,
    performed_by UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL, -- 'vincular', 'excluir', 'editar'
    entity_type TEXT NOT NULL, -- 'profile', 'lista', 'fornecedor'
    entity_id UUID NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT, INSERT ON public.master_audit_logs TO authenticated;
GRANT ALL ON public.master_audit_logs TO service_role;

ALTER TABLE public.master_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to see logs for their networks if needed, or master admins
CREATE POLICY "Master admins can manage all logs" 
ON public.master_audit_logs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin')); -- Adjusting to the project's 'admin' role check