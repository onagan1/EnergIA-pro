-- Drop the old per-user read policy
DROP POLICY IF EXISTS "Users can read own profile commissions" ON public.commission_tables;

-- Add global read policy for all authenticated users
CREATE POLICY "All authenticated users can read commissions"
ON public.commission_tables
FOR SELECT
TO authenticated
USING (true);