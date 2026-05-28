"""Parity test: services/pcs-sync/demo_constants.py == apps/web/lib/demo-constants.ts."""
from __future__ import annotations

import re
from pathlib import Path

from demo_constants import as_dict


REPO_ROOT = Path(__file__).resolve().parents[3]
TS_FILE = REPO_ROOT / "apps" / "web" / "lib" / "demo-constants.ts"


def _ts_list(source: str, name: str) -> list[str]:
    m = re.search(rf"{name}\s*=\s*\[(.*?)\]\s*as const;", source, re.S)
    assert m, f"Could not find {name} in TS source"
    return [
        s.strip().strip(",").strip('"')
        for s in m.group(1).split(",")
        if s.strip().strip(",").strip('"')
    ]


def _ts_scalar(source: str, name: str) -> str:
    m = re.search(rf'{name}\s*=\s*"?([^"\n]+?)"?\s*as const;', source)
    assert m, f"Could not find {name} in TS source"
    return m.group(1)


def test_constants_parity() -> None:
    ts = TS_FILE.read_text(encoding="utf-8")
    py = as_dict()

    assert _ts_scalar(ts, "DEMO_LEAGUE_SLUG") == py["DEMO_LEAGUE_SLUG"]
    assert _ts_scalar(ts, "DEMO_LEAGUE_ID") == py["DEMO_LEAGUE_ID"]
    assert _ts_list(ts, "DEMO_TEAM_IDS") == py["DEMO_TEAM_IDS"]
    assert _ts_list(ts, "DEMO_USER_IDS") == py["DEMO_USER_IDS"]
    assert _ts_list(ts, "DEMO_TEAM_NAMES") == py["DEMO_TEAM_NAMES"]
    assert int(_ts_scalar(ts, "DEMO_VISITOR_TEAM_INDEX")) == py["DEMO_VISITOR_TEAM_INDEX"]
