-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success' or 'failure'
    ip_address TEXT,
    details JSONB,
    user_id UUID REFERENCES auth.users(id)
);

-- Grant access
GRANT INSERT, SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow system to insert logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);
