-- RLS policies for the restaurants table.
-- Authenticated users can create rows they own; owners can edit/delete their own rows.
-- Existing SELECT policy is assumed to already exist (public read of restaurants is
-- expected so the customer map can render them).

CREATE POLICY "Users can create their own restaurants"
  ON public.restaurants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their own restaurants"
  ON public.restaurants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their own restaurants"
  ON public.restaurants
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

NOTIFY pgrst, 'reload schema';
