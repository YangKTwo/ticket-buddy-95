
-- Tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT INSERT ON public.tickets TO anon;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can submit a ticket
CREATE POLICY "Anyone can insert tickets"
ON public.tickets FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only authenticated users (admins) can read tickets
CREATE POLICY "Authenticated can read tickets"
ON public.tickets FOR SELECT
TO authenticated
USING (true);

-- Only authenticated users (admins) can update tickets
CREATE POLICY "Authenticated can update tickets"
ON public.tickets FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tickets_set_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX tickets_created_at_idx ON public.tickets (created_at DESC);
CREATE INDEX tickets_status_idx ON public.tickets (status);
