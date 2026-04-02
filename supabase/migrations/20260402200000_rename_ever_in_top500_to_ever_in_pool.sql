-- Rename misleading column: pool is now top 600, not top 500
ALTER TABLE public.riders RENAME COLUMN ever_in_top500 TO ever_in_pool;
