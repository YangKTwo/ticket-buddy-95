
-- Replies table — stores admin/AI replies to tickets
CREATE TABLE public.replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissions
GRANT SELECT ON public.replies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.replies TO authenticated;
GRANT ALL ON public.replies TO service_role;

ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon users tracking their tickets) can read replies
CREATE POLICY "Anyone can read replies"
ON public.replies FOR SELECT
TO anon, authenticated
USING (true);

-- Only authenticated users (admins) can insert replies
CREATE POLICY "Authenticated can insert replies"
ON public.replies FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only authenticated users can update/delete their replies
CREATE POLICY "Authenticated can update replies"
ON public.replies FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete replies"
ON public.replies FOR DELETE
TO authenticated
USING (true);

CREATE INDEX replies_ticket_id_idx ON public.replies (ticket_id);
CREATE INDEX replies_created_at_idx ON public.replies (created_at DESC);
