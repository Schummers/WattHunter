"""Remet la base LOCALE dans l'etat d'un snapshot, pour les trois tables que le
rescore ecrit : rider_xp_daily, teams (cumulative_xp, level) et team_ranking_daily.

Sert a defaire un rescore rate sans repartir du dump de prod. **Local uniquement** :
la cible est resolue par `supabase status`, jamais par le .env de prod.

    python restaure_local_depuis_snapshot.py <snapshot.json>
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
REPO = HERE.parents[2]
sys.path.insert(0, str(REPO / "services" / "pcs-sync"))

snap = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))

out = subprocess.run(["supabase", "status", "-o", "env"], cwd=REPO,
                     capture_output=True, text=True, check=True).stdout
env = dict(l.split("=", 1) for l in out.splitlines() if "=" in l)
url = env["API_URL"].strip('"')
if "127.0.0.1" not in url and "localhost" not in url:
    raise SystemExit(f"cible non locale ({url}). Refus.")

from supabase import create_client  # noqa: E402

sb = create_client(url, env["SERVICE_ROLE_KEY"].strip('"'))
print(f"[cible] {url}")

for row in snap["teams"]:
    sb.table("teams").update(
        {"cumulative_xp": row["cumulative_xp"], "level": row["level"]}
    ).eq("id", row["id"]).execute()
print(f"teams               {len(snap['teams'])} lignes restaurees")

for chunk in (snap["rider_xp_daily"][i:i + 200]
              for i in range(0, len(snap["rider_xp_daily"]), 200)):
    sb.table("rider_xp_daily").upsert(chunk, on_conflict="id").execute()
print(f"rider_xp_daily      {len(snap['rider_xp_daily'])} lignes restaurees")

for chunk in (snap["team_ranking_daily"][i:i + 200]
              for i in range(0, len(snap["team_ranking_daily"]), 200)):
    sb.table("team_ranking_daily").upsert(chunk, on_conflict="id").execute()
print(f"team_ranking_daily  {len(snap['team_ranking_daily'])} lignes restaurees")
