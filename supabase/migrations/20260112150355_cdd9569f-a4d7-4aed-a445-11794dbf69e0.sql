-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Service role full access" ON public.extracted_prices_cache;

-- Create policy for authenticated users to read
CREATE POLICY "Authenticated users can read cache"
ON public.extracted_prices_cache
FOR SELECT
TO authenticated
USING (true);

-- Create policy for service role to do all operations (for edge functions)
CREATE POLICY "Service role full access"
ON public.extracted_prices_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Also fix the profiles table to require authentication
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);