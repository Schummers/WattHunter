"""Shared Supabase/PostgREST helpers for the PCS Sync pipelines.

Pagination helper — PostgREST caps responses at 1000 rows by default. GT
pipelines fetch entire grand tours (1500+ rows across stages) and league-wide
tables (contracts, team_sponsors), so bare `.execute()` truncates silently as
the data grows — late-stage results (e.g. an ITT on stage 10) get dropped and
goals/bonuses silently fail to credit. Always paginate league/GT-wide fetches
through `_fetch_all`.
"""
from __future__ import annotations


def _fetch_all(query_factory, page_size: int = 1000) -> list[dict]:
    """Run a Supabase query repeatedly with .range() until all rows are fetched.

    Args:
        query_factory: callable returning a fresh, unrun query builder.
        page_size: rows per page (matches PostgREST default cap).

    Returns:
        Flat list of all rows.
    """
    all_rows: list[dict] = []
    offset = 0
    while True:
        resp = query_factory().range(offset, offset + page_size - 1).execute()
        rows = resp.data or []
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
    return all_rows
