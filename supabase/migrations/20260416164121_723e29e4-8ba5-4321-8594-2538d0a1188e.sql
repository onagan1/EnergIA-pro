DROP POLICY IF EXISTS "Users can view own comparisons" ON public.comparisons;
DROP POLICY IF EXISTS "Users can create own comparisons" ON public.comparisons;
DROP POLICY IF EXISTS "Users can update own comparisons" ON public.comparisons;
DROP POLICY IF EXISTS "Users can delete own comparisons" ON public.comparisons;

CREATE POLICY "Users can view own comparisons" ON public.comparisons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own comparisons" ON public.comparisons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comparisons" ON public.comparisons FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comparisons" ON public.comparisons FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Admins can view all comparisons
CREATE POLICY "Admins can view all comparisons" ON public.comparisons FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));