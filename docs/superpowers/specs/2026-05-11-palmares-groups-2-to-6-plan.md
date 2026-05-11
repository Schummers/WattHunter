# Palmares Roadmap — Groups 2 to 6

> Dictated 2026-05-11. Group 1 (Monuments individual, 15 cards) is already shipped on prod (commit `f3ddbf4`). This doc covers the next 26 cards across 4 new groups.

## How to use this doc (for fresh-context chat)

This doc is self-contained — a chat with no prior history should be able to pick it up and execute. Workflow proposed:

1. Walk through each card in the tables below with the user, one at a time
2. For each card, validate in order : **name** → **condition wording** → **tier** → **badge prompt** → **banner prompt**
3. Once a batch of prompts is validated, run the Higgsfield CLI for the badges (Nano Banana Pro) and banners (FLUX.2), drop assets in `apps/web/public/achievements/<group>/`
4. Once all assets are in, extend `lib/achievements.ts` + the unlock detection in `page.tsx` in a single commit per group

The user wants to **validate one row at a time**, not bulk batches. Ask one question, wait for answer, move to the next field.

## Context for fresh-context implementer

The Palmares system is a collection of unlockable badges + banners that teams can equip. Already live:

- **Catalog** : `apps/web/lib/achievements.ts` (static, code-defined slugs)
- **DB** : `teams.equipped_achievement_slug TEXT` column
- **Unlock detection** : `apps/web/app/(game)/league/[leagueId]/achievements/page.tsx` queries `rider_xp_daily` (for team ownership at scoring time) JOIN `race_results` (for rank)
- **UI** : `apps/web/components/achievement-card.tsx` + `achievement-badge.tsx`
- **Tiers** : `victory` / `podium` / `top10` / `dynamic`, each with their own badge ring color and animation

## Already shipped — Group 1 catalog (do not collide on slugs)

The following 15 slugs are LIVE in `apps/web/lib/achievements.ts` and must not be reused. Each has a badge + banner image at `apps/web/public/achievements/monuments/`.

| Slug | Name | Tier |
|------|------|------|
| `paris-roubaix-victory` | Hell of the North | victory |
| `paris-roubaix-podium`  | Survivor of the North | podium |
| `paris-roubaix-top10`   | Hell Participant | top10 |
| `flandres-victory` | Patron of Flanders | victory |
| `flandres-podium`  | Soldier of Flanders | podium |
| `flandres-top10`   | Flemish Contender | top10 |
| `lbl-victory` | La Doyenne | victory |
| `lbl-podium`  | Dame de Bronze | podium |
| `lbl-top10`   | Ardennes Raider | top10 |
| `lombardia-victory` | Il Diavolo | victory |
| `lombardia-podium`  | L'Ombre de Côme | podium |
| `lombardia-top10`   | Autumn Racer | top10 |
| `milan-sanremo-victory` | Primavera | victory |
| `milan-sanremo-podium`  | Riviera Finisher | podium |
| `milan-sanremo-top10`   | Poggio Climber | top10 |

Assets present:
- Badges (1:1) : `badge-paris-roubaix.png`, `badge-flandres.png`, `badge-lbl.png`, `badge-lombardia.png`, `badge-milan-sanremo.png`
- Banners (16:9) : `banner-{race}.png` matching the above

Reference photos (used to anchor banner generation) live in `apps/web/public/achievements/references/` : `grammont.jpg`, `redoute.jpeg`, `adios-a-la-cabina-del-poggio.jpeg`.

## Tier system

| Tier name | Display label | Color | Ring | Use for |
|-----------|---------------|-------|------|---------|
| `top10`   | Silver / Top 10 | `#6b7280` gray  | flat, no glow | Basic / participation tier |
| `podium`  | Podium / Orange | `#f59e0b` amber | static glow   | Intermediate achievement |
| `victory` | Gold            | `#fbbf24` gold  | breathing 3s  | Major achievement |
| `dynamic` | Live            | `#22d3ee` cyan  | pulse 2.5s    | Real-time leaderboard (only one team holds it at a time) |

## Image generation conventions

From Group 1 we learned:
- **Badges** : Nano Banana Pro, 1:1 aspect, 3D realistic object on dark background, ring-clippable circular composition
- **Banners** : FLUX.2, 16:9 aspect, **documentary sport photography** style, riders visible in action, evocative of the race location
- **Reference photos** can be placed in `apps/web/public/achievements/references/` and passed via `--image ./path` flag to Higgsfield CLI
- The prompt style for badges has been "3D realistic object representing the race's iconic feature, dark background, single subject"
- The prompt style for banners has been "documentary sport photo, cyclists in pack, race-specific landmark visible"

Badge + banner prompts in the tables below are intentionally **left empty** — to be filled in pass 2 after names and tiers are validated.

## Race slug reference

### Monuments (one-day, `/result` suffix)
```
race/paris-roubaix/{year}/result
race/ronde-van-vlaanderen/{year}/result
race/liege-bastogne-liege/{year}/result
race/il-lombardia/{year}/result
race/milano-sanremo/{year}/result
```

### Grand Tours
```
race/giro-d-italia/{year}/stage-N/result     ← stage results in race_results
race/giro-d-italia/{year}/gc                  ← GC final standings in race_results (stage = "gc")
race/tour-de-france/{year}/...
race/vuelta-a-espana/{year}/...
```

### `gt_daily_classifications` table (the key one I missed earlier)

Populated by `import_daily_classifications()` after EACH stage of a Grand Tour. Stores top 50 GC / top 20 points / top 10 KOM per stage.

Schema (relevant cols) :
- `race_slug` — the stage slug (e.g. `race/giro-d-italia/2026/stage-3`)
- `stage` — `"stage-N"`
- `rider_id`
- `classification_type` — `"gc"` / `"points"` / `"kom"`
- `rank` — rider's rank in that classification AFTER that stage

**To get the FINAL winner of a classification at a GT** : query the row with the highest `stage` number where `classification_type = 'points'` (or `'kom'`) and `rank = 1`. Same logic for podium (`rank ≤ 3`).

### Jersey reference (for badge prompts later)

| GT | GC jersey | KOM jersey | Points jersey |
|----|-----------|------------|---------------|
| Giro    | Maglia Rosa (pink `#ed5298`) | Maglia Azzurra (blue `#4a90e2`) | Maglia Ciclamino (cyclamen `#d83cab`) |
| Tour    | Maillot Jaune (yellow `#f7e91c`) | Maillot à pois (white w/ red dots) | Maillot Vert (green `#00ad4e`) |
| Vuelta  | La Roja (red `#c2161a`) | Lunares (white w/ blue dots) | Maillot Verde (green) |

## DB feasibility legend

- ✅ Data already in DB, query is straightforward
- ⚠️ Data exists but query needs care (joins, aggregation across seasons, etc.)
- ❌ Data NOT in DB — needs a PCS-sync extension before this achievement can fire

---

## Group 2 — Monuments Combined (5 cards)

Names are first-pass proposals. User to validate before image generation.

| Slug | Name (proposed) | Condition | Tier | DB | Badge prompt | Banner prompt |
|------|-----------------|-----------|------|-----|---|---|
| `monuments-collector` | Monument Collector | Top 10 at each of the 5 Monuments in the same season | top10 | ✅ aggregate `race_results.rank ≤ 10` joined with `rider_xp_daily` team ownership, count distinct monument slugs = 5 per season | _TBD_ | _TBD_ |
| `monuments-hunter` | Monument Hunter | Top 5 on at least 3 different Monuments in the same season | podium | ✅ same shape, threshold rank ≤ 5, count distinct ≥ 3 | _TBD_ | _TBD_ |
| `monuments-double` | Two of Five _(name to validate — alt: "Double Crown")_ | Career: rider from your team wins 2 distinct Monuments | victory | ✅ count distinct monument slugs where rank = 1 across all seasons | _TBD_ | _TBD_ |
| `monument-man` | Monument Man | Highest cumulative XP across the 5 Monuments (real-time, one holder per league) | dynamic | ✅ SUM(`rider_xp_daily.xp_gained`) WHERE race_slug IN monuments, GROUP BY team_id, ORDER DESC LIMIT 1 | _TBD_ | _TBD_ |
| `classic-man` | Classic King _(name to validate — alt: "Classic Man")_ | Highest cumulative XP across all one-day WT races (real-time) | dynamic | ⚠️ same shape but need a "one-day race" filter — derive from race_slug NOT matching `/stage-` pattern, OR maintain explicit list of WT one-day slugs | _TBD_ | _TBD_ |

**Skipped from original spec** : "Le figurant des classiques" (rejected by user).

---

## Group 3 + 4 — Grand Tours Individual (12 cards)

Per GT, 4 cards: GC Victory (gold), GC Podium (orange), KOM Victory (gold), Points Victory (gold). KOM and Points do **not** have podium tiers.

### Giro d'Italia (4 cards)

| Slug | Name | Condition | Tier | DB | Badge prompt | Banner prompt |
|------|------|-----------|------|-----|---|---|
| `giro-gc-victory` | Maglia Rosa | A rider from your team wins the Giro GC | victory | ✅ `race_results.rank = 1` WHERE race_slug = `race/giro-d-italia/{year}/gc` | _TBD_ | _TBD_ |
| `giro-gc-podium`  | Rosa Podium _(name to validate)_ | A rider from your team finishes top 3 GC at the Giro | podium | ✅ rank ≤ 3 on the same GC slug | _TBD_ | _TBD_ |
| `giro-kom-victory` | Maglia Azzurra | A rider from your team wins the KOM at the Giro | victory | ✅ `gt_daily_classifications` WHERE race_slug matches last Giro stage AND classification_type=`kom` AND rank=1 | _TBD_ | _TBD_ |
| `giro-points-victory` | Maglia Ciclamino | A rider from your team wins the Points at the Giro | victory | ✅ same query, classification_type=`points` | _TBD_ | _TBD_ |

### Tour de France (4 cards)

| Slug | Name | Condition | Tier | DB | Badge prompt | Banner prompt |
|------|------|-----------|------|-----|---|---|
| `tour-gc-victory` | Maillot Jaune | A rider from your team wins the Tour GC | victory | ✅ same shape, slug `race/tour-de-france/{year}/gc` | _TBD_ | _TBD_ |
| `tour-gc-podium`  | Champs-Élysées Podium _(name to validate)_ | A rider from your team finishes top 3 GC at the Tour | podium | ✅ | _TBD_ | _TBD_ |
| `tour-kom-victory` | Polka Dot King _(or "Maillot à Pois")_ | A rider from your team wins the KOM at the Tour | victory | ✅ via `gt_daily_classifications` last Tour stage, type=`kom`, rank=1 | _TBD_ | _TBD_ |
| `tour-points-victory` | Maillot Vert | A rider from your team wins the Points at the Tour | victory | ✅ same shape, type=`points` | _TBD_ | _TBD_ |

### Vuelta a España (4 cards)

| Slug | Name | Condition | Tier | DB | Badge prompt | Banner prompt |
|------|------|-----------|------|-----|---|---|
| `vuelta-gc-victory` | La Roja | A rider from your team wins the Vuelta GC | victory | ✅ slug `race/vuelta-a-espana/{year}/gc` | _TBD_ | _TBD_ |
| `vuelta-gc-podium`  | Madrid Podium _(name to validate)_ | A rider from your team finishes top 3 GC at the Vuelta | podium | ✅ | _TBD_ | _TBD_ |
| `vuelta-kom-victory` | Lunares _(name to validate — alt: "Vuelta Climber")_ | A rider from your team wins the KOM at the Vuelta | victory | ✅ via `gt_daily_classifications` last Vuelta stage, type=`kom`, rank=1 | _TBD_ | _TBD_ |
| `vuelta-points-victory` | Maillot Verde | A rider from your team wins the Points at the Vuelta | victory | ✅ same shape, type=`points` | _TBD_ | _TBD_ |

**Banner direction (user-provided)** :
- GC Victory → final podium scene at the iconic finish line (Verona arena / Champs-Élysées / Madrid)
- GC Podium → wider podium / champagne / fans, less "winner-centric"
- KOM Victory → rider in mountain jersey attacking a climb, country backdrop (Italian Alps / French Pyrenees / Spanish Sierra)
- Points Victory → sprint celebration on the finish line, rider in points jersey doing a different victory salute each time

**Badge direction (user-provided)** : focus on the actual jersey — clean shot of the maillot floating/displayed, recognizable color + design.

---

## Group 5 — Grand Tours Combined (4 cards)

| Slug | Name | Condition | Tier | DB | Badge prompt | Banner prompt |
|------|------|-----------|------|-----|---|---|
| `gt-grand-podium` | The Grand Podium | A rider from your team finishes top 3 GC at all 3 Grand Tours in the same season | victory | ✅ aggregate 3 GC queries by season + team | _TBD_ | _TBD_ |
| `gt-all-mountains` | Vert Partout _(name to validate — alt: "Mountains Triple Crown")_ | Win KOM at all 3 Grand Tours in the same season | victory | ✅ aggregate KOM winners (last stage rank=1) across 3 GTs in one season | _TBD_ | _TBD_ |
| `gt-all-points` | Rouge Partout _(name to validate — alt: "Sprint Triple Crown")_ | Win Points at all 3 Grand Tours in the same season | victory | ✅ same shape for Points | _TBD_ | _TBD_ |
| `gt-king` | GT King | Highest cumulative XP across all 3 Grand Tours (real-time) | dynamic | ✅ SUM(`rider_xp_daily.xp_gained`) WHERE race_slug LIKE `race/giro%` OR `race/tour-de-france%` OR `race/vuelta-a-espana%` | _TBD_ | _TBD_ |

**Skipped from original spec** : "The Tourist" (rejected by user), "Triple Crown GC" (rejected — replaced by Grand Podium top-3-all-3).

---

## Group 6 — Stage Hunting (5 cards)

Single visual identity (same badge + same banner) reused across the 3 tier levels — the only thing that changes is the ring color (silver → orange → gold). Then 2 dynamic standalone cards.

| Slug | Name | Condition | Tier | DB | Badge prompt | Banner prompt |
|------|------|-----------|------|-----|---|---|
| `stage-hunter-silver` | Stage Hunter — Silver | 3 stage wins within a single Grand Tour | top10 | ✅ count `race_results.rank = 1` WHERE race_slug LIKE `race/{gt}/{year}/stage-%` GROUP BY team + GT | _TBD (shared)_ | _TBD (shared)_ |
| `stage-hunter-orange` | Stage Hunter — Orange | 5 stage wins within a single Grand Tour | podium | ✅ same query, threshold 5 | _TBD (shared)_ | _TBD (shared)_ |
| `stage-hunter-gold` | Stage Hunter — Gold | 7 stage wins within a single Grand Tour | victory | ✅ same query, threshold 7 | _TBD (shared)_ | _TBD (shared)_ |
| `cavendish` | Cavendish _(name to validate)_ | Most stage wins all-time across all GTs (real-time leaderboard) | dynamic | ✅ count `rank = 1` on all stage slugs, GROUP BY team, ORDER DESC LIMIT 1 | _TBD_ | _TBD_ |
| `eternal-second` | Eternal Second _(name to validate — alt: "Le Poulidor")_ | Most 2nd-place finishes across all race types (real-time) | dynamic | ✅ count `rank = 2` across ALL race_results (stages + one-day + GC), GROUP BY team | _TBD_ | _TBD_ |

**Skipped from original spec** : "Le Touriste" / "Sad Podium tiers" (rejected — only Eternal Second kept).

---

## Total counts

| Group | Cards | DB ready today |
|-------|-------|----------------|
| Group 1 — Monuments Individual (shipped) | 15 | ✅ |
| Group 2 — Monuments Combined | 5 | ✅ |
| Group 3+4 — GT Individual | 12 | ✅ all 12 (via `gt_daily_classifications`) |
| Group 5 — GT Combined | 4 | ✅ all 4 |
| Group 6 — Stage Hunting | 5 | ✅ |
| **TOTAL** | **41 cards** (26 new) | **all 26 ready — no DB blocker** |

## Open considerations (not blockers)

1. **"Classic Man" race scope** — define the source-of-truth list of one-day WT races. Either:
   - Filter by absence of `/stage-` in slug (cheap but fragile)
   - Maintain explicit `WT_ONE_DAY_SLUGS` constant alongside `WT_PARENT_SLUGS`
   - **Recommended** : explicit list for clarity

2. **"Last stage" detection for KOM/Points winners** — to know who won the green/polka-dot jersey at the end of a GT, we need to find the row in `gt_daily_classifications` for the LAST stage. Parse `stage` field (`stage-21` → 21) and take MAX per parent slug. Or use `wt_calendar_2026.json` to know the total stage count.

3. **Naming validation pass** — every row marked _(name to validate)_ needs user confirmation before badge prompts are written.

## Suggested implementation order

1. Validate all names (this doc) → user pass
2. Write badge + banner prompts in this doc → user pass on a sample then bulk
3. Generate images via Higgsfield CLI, place in `apps/web/public/achievements/<group>/`
4. Extend `lib/achievements.ts` with the 26 new entries
5. Extend unlock detection in `achievements/page.tsx`:
   - Add `MONUMENT_COMBINED_DETECTION` block
   - Add `GT_INDIVIDUAL_DETECTION` block (GC via race_results, KOM+Points via `gt_daily_classifications` last-stage lookup)
   - Add `GT_COMBINED_DETECTION` block (aggregate the above across 3 GTs same season)
   - Add `STAGE_HUNTING_DETECTION` block
   - Add `DYNAMIC_LEADERBOARD_DETECTION` block (server-side, recomputed per request — could be cached)
6. Extend `achievements-client.tsx` with new sections per group

## Open questions for user pass

- Validate proposed names (everything marked _(name to validate)_)
- Confirm "Vert partout / Rouge partout" interpretation (currently mapped: Vert = KOM all 3, Rouge = Points all 3)
- Confirm tier mapping for each row (some are first-pass guesses based on dictation tone)
- For Eternal Second: "Le Poulidor" reference works? Or stick with English "Eternal Second" / "The Bridesmaid"?
- For the stage-hunter set: single badge reused with ring color difference — confirm OK or want 3 variants?

---

## DB schema deep-dive (for unlock detection)

### Table : `race_results`
```
rider_id      uuid     — FK to riders.id
race_slug     text     — see formats below
race_name     text
race_date     date
stage         text     — "stage-1", "stage-2", …, or "gc" for GC final, NULL for one-day races
pcs_points    int      — PCS scoring system points (NOT the same as Points classification jersey)
rank          int      — finishing position
race_class    text     — "monument", "one-day", "stage-race", "gc"
is_itt        bool
```

Slug formats:
- One-day race result : `race/{race-name}/{year}/result` (e.g. `race/paris-roubaix/2026/result`)
- GT stage result : `race/{gt}/{year}/stage-N/result` (e.g. `race/giro-d-italia/2026/stage-3/result`)
- GT GC final : `race/{gt}/{year}/gc` (only populated AFTER the GT ends, via `import_gc_results`)

### Table : `gt_daily_classifications` (the key one for jerseys)
Populated after EACH stage of a GT by `import_daily_classifications()` in `services/pcs-sync/sync_race.py`.
```
race_slug             text     — the stage slug (e.g. "race/giro-d-italia/2026/stage-3")
stage                 text     — "stage-N"
rider_id              uuid
classification_type   text     — "gc" / "points" / "kom"
rank                  int      — rider's rank in that classification AFTER that stage
```

UNIQUE on `(race_slug, rider_id, classification_type)`.

To find the FINAL winner of a classification at a GT : query the row where the stage number is the highest for that GT + year (parse `stage-N` and `MAX(N)` or use the calendar to know total stages).

### Table : `rider_xp_daily` (for team ownership + XP totals)
```
race_slug    text     — same slug format as race_results
team_id      uuid     — which team owned the rider when they scored (CRITICAL for palmares)
rider_id     uuid
xp_gained    int      — game XP earned by this rider for this team on this race
date         date
```

This is the table to use whenever you need "did this team own the rider when they scored?" — covers released-then-rebought riders correctly. Group 1 detection uses this pattern (see `apps/web/app/(game)/league/[leagueId]/achievements/page.tsx:46-78`).

### Table : `contracts`
```
team_id      uuid
rider_id     uuid
status       text   — "active" / "released" / "notice"
released_at  timestamp
```

Useful for "current roster" queries but NOT for palmares (use `rider_xp_daily.team_id` instead — see Group 1 page.tsx for the reasoning).

### Table : `teams`
```
id                          uuid
name                        text
league_id                   uuid
equipped_achievement_slug   text     — added by migration 20260517000000, nullable
```

### Calendar file : `services/pcs-sync/wt_calendar_2026.json`
Contains for each WT race : `slug`, `name`, `type` (`one-day` / `stage-race`), `start_date`, `end_date`, and for stage races the total number of stages. Use this to know how many stages a GT has (needed for last-stage detection).

---

## SQL templates per detection type

> All templates assume `myTeamId` and `year` are bind variables from the page server component.

### 1. Monument top10 / podium / victory (Group 1 — already shipped reference)
See `apps/web/app/(game)/league/[leagueId]/achievements/page.tsx:46-78`. Pattern:
```sql
-- Step 1: which riders did *my team* own when they scored at this monument?
SELECT race_slug, rider_id
FROM rider_xp_daily
WHERE team_id = :myTeamId
  AND race_slug IN (
    'race/paris-roubaix/2026/result',
    'race/ronde-van-vlaanderen/2026/result',
    'race/liege-bastogne-liege/2026/result',
    'race/il-lombardia/2026/result',
    'race/milano-sanremo/2026/result'
  );

-- Step 2: rank for those (race, rider) pairs
SELECT race_slug, rider_id, rank
FROM race_results
WHERE race_slug IN (...) AND rider_id IN (...) AND rank <= 10;
```

### 2. Monument combined — Collector / Hunter (same season)
```sql
-- Count distinct monuments where my team had a rider in top X this season
SELECT COUNT(DISTINCT rr.race_slug)
FROM race_results rr
JOIN rider_xp_daily rxd USING (race_slug, rider_id)
WHERE rxd.team_id = :myTeamId
  AND rr.race_slug LIKE 'race/%/' || :year || '/result'
  AND rr.race_slug IN (... 5 monument slugs ...)
  AND rr.rank <= :threshold   -- 5 for Hunter, 10 for Collector
;
-- Unlock if result = 3 (Hunter), or = 5 (Collector)
```

### 3. Monument double — career
```sql
-- Count distinct monuments where my team had a winner, all-time
SELECT COUNT(DISTINCT regexp_replace(rr.race_slug, '/\d{4}/result$', ''))
FROM race_results rr
JOIN rider_xp_daily rxd USING (race_slug, rider_id)
WHERE rxd.team_id = :myTeamId
  AND rr.race_slug ~ '^race/(paris-roubaix|ronde-van-vlaanderen|liege-bastogne-liege|il-lombardia|milano-sanremo)/\d{4}/result$'
  AND rr.rank = 1
;
-- Unlock if >= 2
```

### 4. Dynamic leaderboard — Monument Man / Classic Man / GT King
```sql
-- Find the league's top team by raw XP on a category of races
SELECT team_id, SUM(xp_gained) as total_xp
FROM rider_xp_daily
WHERE race_slug IN (... category slugs ...)
  AND team_id IN (SELECT id FROM teams WHERE league_id = :leagueId)
GROUP BY team_id
ORDER BY total_xp DESC
LIMIT 1;
-- The returned team holds this dynamic achievement
```

### 5. GT GC Victory / Podium
```sql
-- Did my team own the GC winner / top 3 of GT X this year?
SELECT rr.rank
FROM race_results rr
JOIN rider_xp_daily rxd ON rxd.rider_id = rr.rider_id
WHERE rr.race_slug = 'race/' || :gt || '/' || :year || '/gc'
  AND rxd.team_id = :myTeamId
  -- ownership: rxd should be on any stage of that same GT
  AND rxd.race_slug LIKE 'race/' || :gt || '/' || :year || '/%'
  AND rr.rank <= 3
ORDER BY rr.rank ASC LIMIT 1;
-- rank=1 → victory; rank in (2,3) → podium
```

### 6. GT KOM / Points Victory
```sql
-- Find the last-stage row (MAX stage number) of the classification
WITH last_stage AS (
  SELECT MAX(CAST(substring(stage FROM 'stage-(\d+)') AS int)) as n
  FROM gt_daily_classifications
  WHERE race_slug LIKE 'race/' || :gt || '/' || :year || '/stage-%'
)
SELECT gdc.rider_id, gdc.rank
FROM gt_daily_classifications gdc, last_stage ls
JOIN rider_xp_daily rxd ON rxd.rider_id = gdc.rider_id
WHERE gdc.race_slug = 'race/' || :gt || '/' || :year || '/stage-' || ls.n
  AND gdc.classification_type = :type   -- 'points' or 'kom'
  AND gdc.rank = 1
  AND rxd.team_id = :myTeamId
  AND rxd.race_slug LIKE 'race/' || :gt || '/' || :year || '/%';
```

### 7. GT combined — Grand Podium / Vert Partout / Rouge Partout
Run the GT-individual queries 3× (Giro/Tour/Vuelta) for the same season, AND together.

### 8. Stage Hunter (3/5/7 in same GT)
```sql
SELECT COUNT(*)
FROM race_results rr
JOIN rider_xp_daily rxd USING (race_slug, rider_id)
WHERE rxd.team_id = :myTeamId
  AND rr.race_slug LIKE 'race/' || :gt || '/' || :year || '/stage-%/result'
  AND rr.rank = 1;
-- Compare result to 3, 5, 7 thresholds
```

### 9. Cavendish (most career stage wins, dynamic)
```sql
SELECT rxd.team_id, COUNT(*) as wins
FROM race_results rr
JOIN rider_xp_daily rxd USING (race_slug, rider_id)
WHERE rxd.team_id IN (SELECT id FROM teams WHERE league_id = :leagueId)
  AND rr.race_slug LIKE '%/stage-%/result'
  AND rr.rank = 1
GROUP BY rxd.team_id
ORDER BY wins DESC
LIMIT 1;
```

### 10. Eternal Second
Same as Cavendish but with `rr.rank = 2` and `LIKE '%/result'` (covers all races, not just stages).

---

## Code structure — where to add new pieces

### Catalog : `apps/web/lib/achievements.ts`
Add 26 new entries following the existing `monuments(...)` helper pattern. May need a new helper per category for cleaner slug derivation of asset URLs.

Existing helper :
```ts
const monuments = (slug, name, condition, tier, accentColor) => ({
  slug, category: "monuments", name, condition, tier,
  badgeUrl: `/achievements/monuments/badge-${slug.replace(/-victory|-podium|-top10/, "")}.png`,
  bannerUrl: `/achievements/monuments/banner-${slug.replace(/-victory|-podium|-top10/, "")}.png`,
  accentColor,
});
```

Plan : create `monumentCombined`, `grandTour`, `stageHunter` helpers similarly. Categories : `"monuments-combined"`, `"grand-tours"`, `"grand-tours-combined"`, `"stage-hunting"`.

But — the existing `AchievementCategory` type only has 4 values (`"monuments" | "budget" | "roster" | "league"`). The user already plans for `budget`, `roster`, `league` as separate tabs. So **all new groups 2-6 still belong to the `"monuments"` category in the UI** (they all show under the Monuments tab). Discuss with user if this changes — could add a separate "Grand Tours" tab.

### Unlock detection : `apps/web/app/(game)/league/[leagueId]/achievements/page.tsx`
Already structured as one query block per category. Append new query blocks following the Group 1 pattern (`rider_xp_daily` filter + `race_results` join). Push to `unlockedSlugs[]`.

### UI sections : `apps/web/app/(game)/league/[leagueId]/achievements/achievements-client.tsx`
Already uses `MONUMENT_GROUPS` array to render section headers per monument. Add similar arrays per new group (`MONUMENT_COMBINED_GROUPS`, `GT_GROUPS`, etc.) and a `<TabsContent>` block per category.

### Migration
**No new DB migrations needed** for the 26 new achievements — they all use existing tables. Only Group 1 needed the `equipped_achievement_slug` column.

---

## Higgsfield CLI workflow

From Group 1 session, the CLI is invoked via :
```bash
hf-cli generate --model nano_banana_2 --prompt "..." --aspect_ratio 1:1                # badges
hf-cli generate --model flux_2        --prompt "..." --aspect_ratio 16:9               # banners
hf-cli generate --model flux_2        --prompt "..." --aspect_ratio 16:9 --image ./ref  # banner with reference photo
```

Credit cost : NB Pro = 2 cr, FLUX.2 = 1 cr. Roughly 26 badges + 26 banners + a few retries ≈ 80 credits.

Save outputs to `apps/web/public/achievements/<group-folder>/badge-<slug>.png` and `banner-<slug>.png`. Use the slug *without* the tier suffix for shared assets (e.g. `badge-paris-roubaix.png` is shared across `paris-roubaix-victory`, `-podium`, `-top10`).

Reference photos for banners (anchor style) live in `apps/web/public/achievements/references/`. User can add new ones if needed for specific races.

---

## Known issues to avoid (from code review of Group 1)

The fresh-context implementer should NOT replicate these:

1. **❌ Year-locked unlock detection** — Group 1 currently uses `new Date().getFullYear()` to build the monument map. If a user opens Palmares in January 2027, their 2026 podium disappears. **Fix in new code** : detect unlocks across ALL years (use regex on race_slug pattern, not hardcoded year).

2. **❌ Equip server action has no unlock validation** — `apps/web/app/(game)/league/[leagueId]/achievements/actions.ts` accepts any valid slug. A user can craft a request and equip an achievement they haven't unlocked. **Fix in new code** : the action should re-run the detection logic before the UPDATE, or call a SECURITY DEFINER RPC.

3. **⚠️ rgba hex hardcoded in `achievement-card.tsx`** — `rgba(255,255,255,0.08)` and `rgba(6,182,212,0.12)` violate Rule #1. Use `color-mix(in srgb, var(--accent-default) 12%, transparent)` or define new tokens in `globals.css`.

4. **⚠️ `<style>` keyframes duplicated per badge** — N badges = N identical `<style>` tags in the DOM. Move keyframes to `apps/web/app/globals.css`.

These can be batched in a single follow-up "palmares hardening" commit at the end.

---

## Validation loop for the fresh-context chat

Once this doc is loaded, drive the validation as follows :

**Phase 1 — Names + tiers**
For each row in the tables, ask the user :
1. "For `<slug>`, I propose name **<proposed>** (alt: <alt>). Validate or change?"
2. "Tier **<tier>** sounds right? (silver/orange/gold/dynamic)"
3. Update the table inline as you go.

**Phase 2 — Condition wording**
Once names are locked, validate the user-facing `condition` string. Keep them parallel in structure to existing Group 1 conditions (`"A rider from your team wins X"`, `"A rider from your team finishes top N at X"`, etc.).

**Phase 3 — Badge + Banner prompts**
For each row, propose a detailed prompt for the badge (1:1, NB Pro) and banner (16:9, FLUX.2) following Group 1 style. Get user validation. Generate via Higgsfield CLI. Confirm output visually before moving on.

**Phase 4 — Code implementation**
Once all assets are in `public/achievements/`, do a single PR per group: catalog entries + detection block + UI section. Run typecheck + tests + visual smoke before commit. Push to main (auto-deploy via Vercel).
