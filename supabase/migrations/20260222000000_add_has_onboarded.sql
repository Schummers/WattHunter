-- Add has_onboarded flag to users table
alter table public.users add column has_onboarded boolean not null default false;
