-- Self-host rider photos in Supabase Storage.
--
-- Why: procyclingstats.com (Cloudflare) now returns a 403 challenge page for any
-- direct image request lacking a cf_clearance cookie. Rider photos are rendered as
-- plain browser <img> pointing at procyclingstats.com/images/..., so every photo
-- broke at once. A server-side proxy can't fix it (datacenter IPs are blocked even
-- harder). Fix: the local scraper (which holds cf_clearance via nodriver) downloads
-- the photos once and uploads them here; the browser then loads from the Supabase CDN.
--
-- Product decision: only the top 300 riders (pcs_rank <= 300) get a self-hosted photo.
-- Ranks 301-600 get no photo (photo_url = NULL) so the avatar falls back to initials.

-- Public bucket: objects are readable anonymously via /storage/v1/object/public/...
-- Uploads go through the service_role key (scraper), which bypasses RLS — no policy needed.
insert into storage.buckets (id, name, public)
values ('rider-photos', 'rider-photos', true)
on conflict (id) do nothing;

-- Clear the now-broken PCS hotlink paths for riders outside the top 300.
-- NB: we deliberately do NOT touch the top 300 here — the backfill script reads the
-- existing PCS path from photo_url to know which image to download, then overwrites
-- it with the Supabase Storage URL.
update public.riders
set photo_url = null
where pcs_rank is null or pcs_rank > 300;
