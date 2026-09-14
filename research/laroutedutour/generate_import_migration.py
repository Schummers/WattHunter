"""Generate the historical palmares migration from rankings.csv.

The archive is 187 rows that will never change again: a generated SQL migration
beats a runtime importer. `supabase db reset` rebuilds it identically, there is
no Python to run in production, and the idempotency is the ON CONFLICT clause
rather than a script anyone has to remember to run twice safely.

  python3 research/laroutedutour/generate_import_migration.py

Rewrites supabase/migrations/20260914000200_historical_palmares.sql in place.
"""
from __future__ import annotations

import csv
import html
from pathlib import Path

RESEARCH = Path(__file__).resolve().parent
REPO = RESEARCH.parents[1]
CSV_PATH = RESEARCH / "rankings.csv"
OUT = REPO / "supabase" / "migrations" / "20260914000200_historical_palmares.sql"

# One-week races are out of the palmares perimeter (PRD, "Règles transverses").
EXCLUDED_TYPES = {"Paris-Nice", "Critérium du Dauphiné"}

# Merged identities: the same person played under two pseudonyms.
ALIASES = {"kli_max": "Klimax", "Sandy Chazar": "David Choncoutié"}

# La Route du Tour pseudonym -> WattHunter account display name.
# Always the WattHunter account, never the LRDT pseudonym (PRD).
ACCOUNTS = {
    "Alpaga": "Jonathan Schummers",
    "Benny Lee": "Dixon Hormous",
    "Marseillais": "Muscat Romain",
    "PeeJee": "Peejee",
    "Marino": "Marino Alex",
    "Klimax": "Klimax",
    "David Choncoutié": "David Choncoutié",
    "bigdaddy": "bigdaddy",
    "Patron": "TheAussieMate",
}

# Played before WattHunter, never had an account. Kept in the archive: JibsEPAULE
# won the 2019 Tour de France and two jerseys, dropping him would leave nine wins
# listed for ten Tours played.
FORMER_PLAYERS = {"Fangio", "JibsEPAULE", "JoeDills"}

EVENT_TYPE = {
    "Classiques": "classics",
    "Giro": "giro",
    "Tour de France": "tour-de-france",
    "Vuelta": "vuelta",
}

POINT_COLUMNS = [
    "bonus", "combative", "mountain", "intermediate_sprint", "stage_finish",
    "stage_total", "gc_points", "young_rider", "sprinter", "climber",
    "general_total", "total",
]


def q(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    tours: dict[str, dict] = {}
    results: list[dict] = []

    with open(CSV_PATH, encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row["canonical_type"] in EXCLUDED_TYPES:
                continue
            player_key = ALIASES.get(row["user"], row["user"])
            tour_id = int(row["tour_id"])
            tours.setdefault(tour_id, {
                "tour_id": tour_id,
                "season_year": int(row["year"]),
                "event_type": EVENT_TYPE[row["canonical_type"]],
                # `&gt;` and friends survived the scrape of the original tour names.
                "tour_name": html.unescape(row["tour_name"]),
                "canonical_name": html.unescape(row["canonical_name"]),
            })
            results.append({
                "tour_id": tour_id,
                "player_key": player_key,
                "display_name": ACCOUNTS.get(player_key, player_key),
                "is_former_player": player_key in FORMER_PLAYERS,
                "team_name": html.unescape(row["team"]),
                "rank": int(row["rank"]),
                **{col: int(row[col]) for col in POINT_COLUMNS},
            })

    years = sorted({t["season_year"] for t in tours.values()})
    tour_rows = sorted(tours.values(), key=lambda t: (t["season_year"], t["tour_id"]))
    results.sort(key=lambda r: (r["tour_id"], r["rank"]))

    lines: list[str] = []
    w = lines.append

    w("-- Ticket 06 — Historical palmares of the group, 2017 to 2025.")
    w("--")
    w("-- GENERATED FILE. Source: research/laroutedutour/rankings.csv.")
    w("-- Regenerate with: python3 research/laroutedutour/generate_import_migration.py")
    w("--")
    w("-- The archive is closed: nine seasons that will never gain a row. A generated")
    w("-- migration beats a runtime importer — `supabase db reset` rebuilds it")
    w("-- identically, nothing has to run in production, and the idempotency is the")
    w("-- ON CONFLICT clause rather than a script someone has to remember to re-run")
    w("-- safely.")
    w("--")
    w("-- NEVER fake leagues or teams with this data. These seasons were played on")
    w("-- another game, with another scale; only ranks compare across the two eras,")
    w("-- which is why the raw category points are stored as they were and never")
    w("-- converted into XP.")
    w("")
    w(f"-- {len(tour_rows)} events retained out of 30 (one-week races excluded),")
    w(f"-- {len(results)} results, {len(years)} seasons.")
    w("")

    w("create table if not exists public.historical_tours (")
    w("  -- The La Route du Tour tour id: the only stable key. Tour names repeat")
    w("  -- (two different tours are both called \"C'est la reprise\").")
    w("  tour_id integer primary key,")
    w("  season_year integer not null references public.seasons (year),")
    w("  event_type text not null check (event_type in ('classics', 'giro', 'tour-de-france', 'vuelta')),")
    w("  tour_name text not null,")
    w("  canonical_name text not null")
    w(");")
    w("")
    w("comment on table public.historical_tours is")
    w("  'One row per event played on La Route du Tour, 2017-2025. One-week races excluded.';")
    w("")
    w("create index if not exists idx_historical_tours_season on public.historical_tours (season_year);")
    w("")

    w("create table if not exists public.historical_results (")
    w("  tour_id integer not null references public.historical_tours (tour_id) on delete cascade,")
    w("  -- Canonical player key, merged identities applied (kli_max = Klimax,")
    w("  -- Sandy Chazar = David Choncoutié). Aggregates key on this, never on the")
    w("  -- team name, which changed at every single event.")
    w("  player_key text not null,")
    w("  -- The WattHunter account name, which is what any screen displays.")
    w("  display_name text not null,")
    w("  -- Played before WattHunter and never opened an account.")
    w("  is_former_player boolean not null default false,")
    w("  team_name text not null,")
    w("  rank integer not null check (rank >= 1),")
    w("  -- Raw category points, exactly as the original game scored them.")
    for col in POINT_COLUMNS:
        w(f"  {col} integer not null default 0,")
    w("  primary key (tour_id, player_key)")
    w(");")
    w("")
    w("comment on table public.historical_results is")
    w("  'One row per player per historical event: original rank, original team name, raw category points. Never converted to XP.';")
    w("")
    w("create index if not exists idx_historical_results_player on public.historical_results (player_key);")
    w("")

    w("-- The archived seasons have to exist before a tour can point at one.")
    w("insert into public.seasons (year) values")
    w(",\n".join(f"  ({y})" for y in years) + "\non conflict (year) do nothing;")
    w("")

    w("insert into public.historical_tours (tour_id, season_year, event_type, tour_name, canonical_name) values")
    w(",\n".join(
        f"  ({t['tour_id']}, {t['season_year']}, {q(t['event_type'])}, {q(t['tour_name'])}, {q(t['canonical_name'])})"
        for t in tour_rows
    ))
    w("on conflict (tour_id) do update set")
    w("  season_year = excluded.season_year,")
    w("  event_type = excluded.event_type,")
    w("  tour_name = excluded.tour_name,")
    w("  canonical_name = excluded.canonical_name;")
    w("")

    cols = ["tour_id", "player_key", "display_name", "is_former_player", "team_name", "rank"] + POINT_COLUMNS
    w(f"insert into public.historical_results ({', '.join(cols)}) values")
    value_rows = []
    for r in results:
        parts = [
            str(r["tour_id"]), q(r["player_key"]), q(r["display_name"]),
            "true" if r["is_former_player"] else "false",
            q(r["team_name"]), str(r["rank"]),
        ] + [str(r[c]) for c in POINT_COLUMNS]
        value_rows.append("  (" + ", ".join(parts) + ")")
    w(",\n".join(value_rows))
    w("on conflict (tour_id, player_key) do update set")
    w(",\n".join(
        f"  {c} = excluded.{c}" for c in cols if c not in ("tour_id", "player_key")
    ) + ";")
    w("")

    w("alter table public.historical_tours enable row level security;")
    w("alter table public.historical_results enable row level security;")
    w("")
    w("-- A closed archive of a game everyone in the group played: readable by all,")
    w("-- written by migrations only.")
    w("drop policy if exists historical_tours_select_all on public.historical_tours;")
    w("create policy historical_tours_select_all on public.historical_tours")
    w("  for select to anon, authenticated using (true);")
    w("")
    w("drop policy if exists historical_results_select_all on public.historical_results;")
    w("create policy historical_results_select_all on public.historical_results")
    w("  for select to anon, authenticated using (true);")
    w("")
    w("grant select on public.historical_tours to anon, authenticated;")
    w("grant select on public.historical_results to anon, authenticated;")

    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(REPO)}: {len(tour_rows)} tours, {len(results)} results, seasons {years[0]}-{years[-1]}")


if __name__ == "__main__":
    main()
