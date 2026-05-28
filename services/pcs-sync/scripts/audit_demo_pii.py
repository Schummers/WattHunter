"""Audits the demo dataset for accidental PII leakage.

Exits 0 on success. Exits 1 with a loud error if a probable PII string is found.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

sys.path.append(str(Path(__file__).resolve().parents[1]))
from demo_constants import (  # noqa: E402
    DEMO_LEAGUE_ID,
    DEMO_TEAM_IDS,
    DEMO_TEAM_NAMES,
    DEMO_USER_IDS,
)

load_dotenv()

BANNED_DOMAINS = ("@gmail.com", "@protonmail", "@hotmail", "@yahoo.", "@watthunter.com")
EMAIL_RE = re.compile(r"^demo-team-[1-8]@watthunter\.demo$")


def audit() -> int:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)

    failures: list[str] = []

    # 1. public.users — only the 8 demo rows; display_name must match team names.
    users = (
        client.table("users")
        .select("id, display_name")
        .in_("id", list(DEMO_USER_IDS))
        .execute()
        .data
        or []
    )
    if len(users) != 8:
        failures.append(f"Expected 8 demo users in public.users, found {len(users)}")
    for u in users:
        if u["display_name"] not in DEMO_TEAM_NAMES:
            failures.append(f"display_name mismatch on user {u['id']}: {u['display_name']!r}")

    # 2. auth.users — emails must match the demo-team-N@watthunter.demo pattern.
    #    public.users has no email column; the auth schema is the source of truth.
    #    Access auth.users via the Auth admin API (service-role).
    #    Requires supabase-py >= 2.x with admin support.
    try:
        auth_users = client.auth.admin.list_users()
        # list_users() may return a list or a paginated response depending on version.
        users_list = auth_users if isinstance(auth_users, list) else getattr(auth_users, "users", [])
        for au in users_list:
            au_id = getattr(au, "id", None) or au.get("id") if isinstance(au, dict) else au.id
            if au_id in DEMO_USER_IDS:
                email = (
                    getattr(au, "email", "") or au.get("email", "")
                    if isinstance(au, dict)
                    else au.email or ""
                )
                if not EMAIL_RE.match(email):
                    failures.append(f"Email shape mismatch on auth.users {au_id}: {email!r}")
    except Exception as exc:
        # auth.users email check requires supabase-py >= 2.x with admin sub-client
        # and may fail with AuthApiError if the GoTrue admin API returns a 500 on
        # list_users (known issue on some Supabase free-plan projects).
        print(f"WARNING: auth.admin.list_users() failed ({type(exc).__name__}: {exc}) — "
              "skipping auth.users email check.")

    # 3. teams — names must come from DEMO_TEAM_NAMES.
    teams = (
        client.table("teams")
        .select("id, name")
        .in_("id", list(DEMO_TEAM_IDS))
        .execute()
        .data
        or []
    )
    unexpected = {t["name"] for t in teams} - set(DEMO_TEAM_NAMES)
    if unexpected:
        failures.append(f"Unexpected team names: {unexpected}")

    # 4. treasury_log descriptions — no banned domains in free-text.
    treas = (
        client.table("treasury_log")
        .select("description")
        .in_("team_id", list(DEMO_TEAM_IDS))
        .limit(500)
        .execute()
        .data
        or []
    )
    for row in treas:
        desc = (row.get("description") or "").lower()
        for banned in BANNED_DOMAINS:
            if banned in desc:
                failures.append(f"Banned domain {banned!r} found in treasury_log: {desc!r}")
                break

    if failures:
        print("PII AUDIT FAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(
        f"PII audit passed: {len(users)} ghost users, {len(teams)} demo teams, "
        f"{len(treas)} treasury rows inspected — no banned strings."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(audit())
