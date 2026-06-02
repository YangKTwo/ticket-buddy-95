-- 修复：加载工单失败 permission denied for table tickets
-- 在 Supabase Dashboard → SQL Editor 中整段执行（可重复执行）

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT INSERT ON public.tickets TO anon;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated can read tickets" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated can update tickets" ON public.tickets;

-- 匿名/登录用户均可提交工单（首页）
CREATE POLICY "Anyone can insert tickets"
ON public.tickets FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 仅登录用户（管理员）可查看工单列表
CREATE POLICY "Authenticated can read tickets"
ON public.tickets FOR SELECT
TO authenticated
USING (true);

-- 仅登录用户可更新工单状态
CREATE POLICY "Authenticated can update tickets"
ON public.tickets FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
