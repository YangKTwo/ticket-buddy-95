-- 修复：replies 表权限（在 Supabase Dashboard → SQL Editor 中执行）
-- 如果 migration 已经执行但权限有问题，运行此脚本

GRANT SELECT ON public.replies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.replies TO authenticated;
GRANT ALL ON public.replies TO service_role;

ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read replies" ON public.replies;
DROP POLICY IF EXISTS "Authenticated can insert replies" ON public.replies;
DROP POLICY IF EXISTS "Authenticated can update replies" ON public.replies;
DROP POLICY IF EXISTS "Authenticated can delete replies" ON public.replies;

CREATE POLICY "Anyone can read replies"
ON public.replies FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Authenticated can insert replies"
ON public.replies FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update replies"
ON public.replies FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete replies"
ON public.replies FOR DELETE
TO authenticated
USING (true);
