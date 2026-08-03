ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS cargo TEXT;

-- Storage policies for profiles bucket
-- Ensure policies don't already exist to avoid errors
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public profiles are viewable by everyone' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Public profiles are viewable by everyone" 
        ON storage.objects FOR SELECT 
        TO public 
        USING (bucket_id = 'profiles');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload their own profile picture' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Users can upload their own profile picture" 
        ON storage.objects FOR INSERT 
        TO authenticated 
        WITH CHECK (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile picture' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Users can update their own profile picture" 
        ON storage.objects FOR UPDATE 
        TO authenticated 
        USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own profile picture' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Users can delete their own profile picture" 
        ON storage.objects FOR DELETE 
        TO authenticated 
        USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);
    END IF;
END $$;
