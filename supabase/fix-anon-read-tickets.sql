-- 允许匿名用户查询工单（用于用户追踪页面）
-- 在 Supabase Dashboard → SQL Editor 中执行

DROP POLICY IF EXISTS "Anyone can read tickets by email" ON public.tickets;

-- 允许任何人查看工单（用户通过邮箱查询自己的工单）
CREATE POLICY "Anyone can read tickets"
ON public.tickets FOR SELECT
TO anon, authenticated
USING (true);
