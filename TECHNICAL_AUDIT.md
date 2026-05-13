# WattHunter Technical & Performance Audit

## 1. Executive Summary
This report presents a deep-dive analysis of the WattHunter codebase (frontend, backend, microservices, and database layers). The goal is to provide a comprehensive diagnosis of the codebase robustness, scalability limits, and overall quality, focusing on "business rules" implementation (scoring, economy, multipliers).

Overall, the architecture correctly utilizes the monorepo pattern (`Turborepo`, `Next.js 16 App Router`, `FastAPI Python Microservice`, `Supabase`) and effectively offloads complex transaction logic to Supabase RPCs. However, there are significant bottlenecks and architectural fragilities to address before scaling from 10 to 1000 users.

## 2. Backend & Game Logic (`services/pcs-sync` & Supabase)

### 2.1 Database Schema & RLS (Row Level Security)
**Observations:**
*   **RPC-Heavy Logic**: Critical actions (`place_bid`, `confirm_phase_setup`, `grant_xp`) have been migrated to `SECURITY DEFINER` RPCs. This is an excellent pattern for preventing race conditions and ensuring atomic operations during high-traffic phases (e.g., closing of an auction).
*   **Protection Triggers**: Sensitive fields (`cumulative_xp`, `level`, `treasury`) are protected via `BEFORE UPDATE` triggers (e.g., `teams_protect_sensitive_fields`), which blocks direct modifications by users and enforces the use of RPCs.
*   **RLS Implementation**: The fix on `league_members_select` avoiding infinite recursion via `is_league_member` function is well executed. The structure is robust for multi-tenant (multi-league) scaling.

**Risks & Improvements:**
*   **Scalability limit on `place_bid`:** The `place_bid` RPC heavily queries `contracts`, `auction_bids`, and calculates `co_unlock` levels for every bid dynamically. With 1000 concurrent users bidding at the last minute of an auction round, this could severely stress the free-tier Supabase database.
    *   *Recommendation*: Index columns queried heavily in RPCs (`league_id` and `team_id` are already indexed, but check indexes on `rider_id` in `auction_bids`, and `pcs_rank` in `riders`).

### 2.2 Python Microservice (Scoring & Economy)
**Observations:**
*   The `scoring.py` and `sponsor_bonus.py` modules act as background jobs crunching complex pipelines.
*   The pipeline relies heavily on iterating through `team_contracts` and matching logic per-rider using dictionaries and loops.
*   **Remontada System**: Effectively detects overtakes based on daily snapshot comparisons and inserts triggers.

**Risks & Improvements:**
*   **N+1 API Call Vulnerability (`scoring.py`)**:
    *   Currently fetching all contracts and strategies, then iterating over them. Updates to `rider_xp_daily` are performed via `supabase.table("rider_xp_daily").upsert(...)` *inside* a nested loop (`for team_id... for entry in race_entries...`).
    *   *Recommendation*: Batch these upserts! Supabase `upsert` accepts a list of dictionaries. Firing an individual HTTP POST request for every single rider scoring event will drastically slow down the sync job as user count grows, leading to timeout issues on serverless or low-tier environments.
*   **Idempotency vs Re-computation**: The script correctly tries to be idempotent (`delta_xp`), but recalculating full XP loops daily could be optimized by pushing some of the aggregation to SQL views.
*   **Error Handling**: Errors are appended to a list and returned at the end. Consider integrating an APM tool (e.g., Sentry) because swallowed exceptions inside the loop mean silently dropped XP for specific teams.

## 3. Frontend Architecture (Next.js App Router)

### 3.1 Data Fetching & Performance
**Observations:**
*   Pages like `/league/[leagueId]/team/page.tsx` and `/league/[leagueId]/auction/page.tsx` heavily utilize Server Components, fetching data directly via the Supabase client.
*   *Positive*: Good use of `Promise.all` to group parallel independent queries (e.g., fetching `contracts`, `teams`, `team_strategies` concurrently).

**Risks & Improvements:**
*   **Data Over-Fetching & Complex Client Mappings**:
    *   In `auction/page.tsx`, the server fetches a vast amount of data (`contracts`, `draft_bids`, `team_strategies`, `rider_xp_daily`, etc.) and performs heavy Array `.map()` and `.filter()` operations (e.g., `riderBoosts` calculation, building `rosterRiders` and `drafts`) on the Node.js server before sending it to the client.
    *   *Impact*: High compute time on Vercel Edge/Serverless functions. This is likely why "it takes a bit of time to load when navigating between pages".
    *   *Recommendation*: Move these heavy joins and aggregations (especially Rider Boosts and XP summaries) to a Supabase **View** or **RPC**. Postgres is highly optimized for joining and calculating these relationships. The Next.js server should ideally just fetch a pre-computed JSON structure.
*   **UI Thread Blocking**: The massive prop generation blocks rendering. The client receives heavily serialized data.
*   **Caching Strategy**: There is little to no evidence of Next.js Cache utilization (`unstable_cache` or `fetch` caching). Navigating between pages re-runs the entire DB query and calculation logic every single time.
    *   *Recommendation*: For static data (like `riders` list or race definitions), implement aggressive caching.

### 3.2 Design System Adherence
**Observations:**
*   The `watthunter-design-system-v3.md` lays out clear rules for tokens (`var(--type-*)`, `var(--text-*)`, `var(--space-*)`).
*   In the pages reviewed (e.g., `team/page.tsx`), Tailwind arbitrary values are used to enforce these tokens: `text-[length:var(--type-body)]`, `text-[var(--text-mid)]`, `bg-[var(--bg-surface)]`.
*   This approach is technically compliant but verbose.
*   *Recommendation (for the future DS task)*: The Tailwind configuration (`tailwind.config.ts` or v4 CSS variables) should map these CSS variables to actual utility classes. Instead of writing `text-[length:var(--type-body)] text-[var(--text-mid)]`, you should be able to write `text-body text-mid`. This will drastically simplify the code.

## 4. Key Recommendations Summary

1.  **Batch Database Operations in Python**: Refactor `scoring.py` and `sponsor_bonus.py` to collect all `upsert` and `update` dictionaries in memory, then execute a single (or chunked) bulk `supabase.table(...).upsert(list_of_dicts).execute()` call. This is the #1 fix for backend scalability.
2.  **Shift Heavy Compute to the Database**: Refactor the Next.js Server Components (`team/page.tsx`, `auction/page.tsx`). Create Supabase Views that pre-join `contracts`, `riders`, and `team_strategies` to return a fully hydrated roster object, bypassing the need for Next.js to do heavy array manipulation.
3.  **Implement Next.js Caching**: Wrap slow, non-mutating queries with Next.js caching mechanisms to speed up page transitions and reduce the load on the free-tier Supabase database.
4.  **Database Indexing Audit**: Ensure all foreign keys (`team_id`, `rider_id`, `league_id`) used in the `WHERE` clauses of the App Router and RPCs are explicitly indexed in Postgres.

## Conclusion
The architecture is solid and standard for a modern stack. The current "slowness" and scaling fears are rooted primarily in **N+1 HTTP requests in the Python sync scripts** and **heavy un-cached Node.js compute for data aggregation on the Next.js server**. Addressing these two points will allow the application to easily handle 1000+ users on the current free tiers.
