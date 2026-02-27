-- Fix auction_bids visibility:
-- During an open auction, resolved bids (won/outbid) should be visible
-- to all league members — only ACTIVE bids (next round) remain secret.

drop policy if exists "auction_bids_select" on public.auction_bids;

create policy "auction_bids_select" on public.auction_bids for select using (
  exists (
    select 1 from public.auctions a
    join public.league_members lm on lm.league_id = a.league_id
    where a.id = auction_id
      and lm.user_id = auth.uid()
      and (
        -- closed auction: all bids visible
        a.status = 'closed'
        -- open/resolving: resolved bids visible to all; active bids only to own team
        or (
          a.status in ('open', 'resolving')
          and (
            -- anyone in the league can see won/outbid (already resolved)
            status in ('won', 'outbid', 'cancelled')
            or
            -- own active bids only
            exists (
              select 1 from public.teams t
              where t.id = team_id and t.user_id = auth.uid()
            )
          )
        )
      )
  )
);
