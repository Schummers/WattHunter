-- Allow commissioners to update auction round dates
DROP POLICY IF EXISTS "auctions_update_commissioner" ON public.auctions;
CREATE POLICY "auctions_update_commissioner" ON public.auctions
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()
    )
  )
  WITH CHECK (
    league_id IN (
      SELECT id FROM public.leagues WHERE commissioner_id = auth.uid()
    )
  );
