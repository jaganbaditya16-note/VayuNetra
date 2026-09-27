alter policy "profiles own row" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "products owner access" on public.products
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

alter policy "api keys owner access" on public.api_keys
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_id and p.owner_id = (select auth.uid())
  ));

alter policy "events owner read" on public.buyer_events
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.owner_id = (select auth.uid())
  ));

alter policy "signals owner read" on public.buyer_signals
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.owner_id = (select auth.uid())
  ));;
