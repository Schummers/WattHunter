-- Auto-create public.users row when a new auth.users row is inserted.
-- This is the standard Supabase pattern to keep public.users in sync.
-- Belt-and-suspenders: the app callback also does this, but the trigger
-- guarantees the row exists regardless of the client flow.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
