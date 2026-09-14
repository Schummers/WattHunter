"""Ticket 09 — triangulation Wikipedia / PCS refetche / base, Tour de France 2026.

Adapte de `wikipedia_crosscheck.py` (Vuelta). Trois differences de fond :

  * les pages Tour capitalisent le template (`{{Cyclingresult start`) et
    titrent « Stage N result » en minuscule — regex insensibles a la casse ;
  * l'etape 1 est un TTT score via GC : Wikipedia n'y publie pas de top 10
    individuel, elle est exclue et traitee a part ;
  * la comparaison est etendue au top 15. Wikipedia ne valide que 1-10 ; les
    rangs 11-15 ne sont compares qu'entre la base et PCS repare, et sont
    etiquetes comme tels dans la sortie.

Lecture seule. Aucune ecriture en base.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve()
ROOT = HERE.parents[1]
PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PCS / ".env")

import sync_race  # noqa: E402,F401  (monkey-patch format_time, comme en prod)
from procyclingstats import Stage  # noqa: E402
from sync import get_supabase  # noqa: E402
from db_utils import _fetch_all  # noqa: E402

RACE = "race/tour-de-france/2026"
WIKI = ROOT / "fixtures" / "wikipedia-tdf"
SWEEP = ROOT / "fixtures" / "sweep-tdf"
OUT = ROOT / "crosscheck-tdf2026-2026-09-14.json"

# Etape 1 : TTT score via GC (memoire `tdf2026_stage1_ttt_via_gc`). Wikipedia
# n'y donne qu'un classement d'equipes. Hors crosscheck, traitee a part.
STAGES = list(range(2, 22))
DEEP = 15  # profondeur comparee base <-> PCS repare

# Variantes de nommage legitimes entre Wikipedia et PCS, verifiees a la main
# (meme nationalite, meme equipe, meme rang des deux cotes). Pas des erreurs.
ALIASES = {
    "josh tarling": "joshua tarling",
}


def norm(s: str) -> frozenset:
    s = (s or "").lower()
    for a, b in (("ø", "o"), ("ł", "l"), ("đ", "d"), ("ß", "ss"), ("æ", "ae")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = " ".join(t for t in s.split() if t)
    s = ALIASES.get(s, s)
    return frozenset(s.split())


# --- W : Wikipedia -----------------------------------------------------------

RESULT_ROW = re.compile(
    r"\{\{[Cc]yclingresult\|(\d+)\|((?:\[\[[^\]]*\]\]|[^|}\n])+)"
)
TABLE_START = re.compile(r"\{\{[Cc]yclingresult start\|title=")
TABLE_END = re.compile(r"\{\{[Cc]yclingresult end\}\}")


def wiki_link_text(raw: str) -> str:
    raw = raw.strip()
    m = re.match(r"^\[\[(.+?)\]\]$", raw)
    if m:
        inner = m.group(1)
        return inner.split("|", 1)[1] if "|" in inner else inner
    return raw


def parse_wikipedia() -> tuple[dict[int, dict[int, str]], dict[int, str]]:
    """-> ({stage: {rank: nom}}, {rank: nom} pour la GC finale)."""
    text = ""
    for f in sorted(WIKI.glob("*.json")):
        text += json.load(open(f, encoding="utf-8"))["parse"]["wikitext"]["*"] + "\n"

    stages: dict[int, dict[int, str]] = {}
    gc_final: dict[int, str] = {}
    for block in TABLE_START.split(text)[1:]:
        title = block.split("\n", 1)[0]
        body = TABLE_END.split(block, 1)[0]
        rows = {int(r): wiki_link_text(n) for r, n in RESULT_ROW.findall(body)}

        m = re.match(r"Stage (\d+) result", title, re.I)
        if m:
            st = int(m.group(1))
            if st in stages:
                raise SystemExit(f"table 'Stage {st} result' vue deux fois")
            stages[st] = rows
            continue
        if re.match(r"General classification after stage 21", title, re.I):
            gc_final = rows
    return stages, gc_final


# --- P : PCS refetche, correctif actif ---------------------------------------


def parse_pcs(target: str) -> dict[int, str]:
    """Chemin de prod : `.results()` pour une etape, `.gc()` pour la page /gc.

    `Stage.results()` sur une page /gc rend le classement par points, pas le
    general : `import_gc_results` appelle bien `.gc()`, il faut faire pareil.
    """
    html = (SWEEP / f"{target}.html").read_text(encoding="utf-8")
    slug = f"{RACE}/{target}"
    stage = Stage(slug, html=html, update_html=False)
    if target == "gc":
        entries = stage.gc()
    elif target in ("points", "kom", "youth"):
        # Chemin de `import_final_classifications` : le getter dedie, pas
        # `.results()`, qui sur ces pages rend la table de la derniere etape.
        entries = getattr(stage, target)() or []
    else:
        entries = stage.results()
    return {
        e["rank"]: (e.get("rider_url") or "")
        for e in entries
        if e.get("rank")
    }


# --- B : la base --------------------------------------------------------------


def parse_base(sb, target: str) -> dict[int, tuple[str, str]]:
    """Les maillots Points/KOM/Youth ne sont PAS dans `race_results` : ils ont
    leur table dediee `gt_final_classifications` (Spec A A2)."""
    slug = f"{RACE}/{target}"
    if target in ("points", "kom", "youth"):
        rows = _fetch_all(
            lambda: sb.table("gt_final_classifications")
            .select("rank,riders(pcs_slug,full_name)")
            .eq("race_slug", slug)
            .order("rank")
        )
        return {
            r["rank"]: (
                (r.get("riders") or {}).get("pcs_slug") or "",
                (r.get("riders") or {}).get("full_name") or "",
            )
            for r in rows
            if r.get("rank")
        }
    rows = _fetch_all(
        lambda: sb.table("race_results")
        .select("rank,riders(pcs_slug,full_name)")
        .eq("race_slug", slug)
        .order("rank")
    )
    return {
        r["rank"]: (
            (r.get("riders") or {}).get("pcs_slug") or "",
            (r.get("riders") or {}).get("full_name") or "",
        )
        for r in rows
        if r.get("rank")
    }


def compare(target: str, wiki: dict[int, str], sb) -> dict:
    try:
        p = parse_pcs(target)
    except FileNotFoundError:
        return {"error": f"page PCS absente du cache : {target}.html"}
    b = parse_base(sb, target)

    pcs_vs_wiki, base_vs_wiki, base_vs_pcs = [], [], []
    pw_cmp = bw_cmp = bp_cmp = 0

    for rank, wname in sorted(wiki.items()):
        wn = norm(wname)
        if rank in p:
            pw_cmp += 1
            if not (norm(p[rank]) >= wn):
                pcs_vs_wiki.append({"rank": rank, "wikipedia": wname, "pcs_repare": p[rank]})
        if rank in b:
            bw_cmp += 1
            bslug, bname = b[rank]
            if not (norm(bslug) >= wn):
                base_vs_wiki.append(
                    {"rank": rank, "wikipedia": wname, "base": bname or bslug, "base_slug": bslug}
                )

    for rank in range(1, DEEP + 1):
        if rank in p and rank in b:
            bp_cmp += 1
            bslug, bname = b[rank]
            if norm(bslug) != norm(p[rank]):
                base_vs_pcs.append(
                    {
                        "rank": rank,
                        "pcs_repare": p[rank],
                        "base": bname or bslug,
                        "base_slug": bslug,
                        "valide_par_wikipedia": rank in wiki,
                    }
                )

    return {
        "wiki_ranks": len(wiki),
        "pcs_compared": pw_cmp,
        "pcs_vs_wiki": pcs_vs_wiki,
        "base_compared": bw_cmp,
        "base_vs_wiki": base_vs_wiki,
        "base_pcs_compared": bp_cmp,
        "base_vs_pcs_top15": base_vs_pcs,
    }


def main() -> None:
    wiki_stages, wiki_gc = parse_wikipedia()
    sb = get_supabase()
    per_target: dict[str, dict] = {}

    t = {"pw_c": 0, "pw_b": 0, "bw_c": 0, "bw_b": 0, "bp_c": 0, "bp_b": 0}

    for st in STAGES:
        w = wiki_stages.get(st)
        if not w:
            per_target[f"stage-{st}"] = {"error": "absent de Wikipedia"}
            print(f"stage-{st:<3} ABSENT de Wikipedia", flush=True)
            continue
        r = compare(f"stage-{st}", w, sb)
        per_target[f"stage-{st}"] = r
        if "error" in r:
            print(f"stage-{st:<3} {r['error']}", flush=True)
            continue
        t["pw_c"] += r["pcs_compared"]; t["pw_b"] += len(r["pcs_vs_wiki"])
        t["bw_c"] += r["base_compared"]; t["bw_b"] += len(r["base_vs_wiki"])
        t["bp_c"] += r["base_pcs_compared"]; t["bp_b"] += len(r["base_vs_pcs_top15"])
        flag = "  <-- PCS repare DIVERGE" if r["pcs_vs_wiki"] else ""
        print(
            f"stage-{st:<3} PCS/wiki {len(r['pcs_vs_wiki'])}/{r['pcs_compared']}   "
            f"base/wiki {len(r['base_vs_wiki'])}/{r['base_compared']}   "
            f"base/PCS top15 {len(r['base_vs_pcs_top15'])}/{r['base_pcs_compared']}{flag}",
            flush=True,
        )

    if wiki_gc:
        r = compare("gc", wiki_gc, sb)
        per_target["gc"] = r
        if "error" not in r:
            print(
                f"{'gc':<9} PCS/wiki {len(r['pcs_vs_wiki'])}/{r['pcs_compared']}   "
                f"base/wiki {len(r['base_vs_wiki'])}/{r['base_compared']}   "
                f"base/PCS top15 {len(r['base_vs_pcs_top15'])}/{r['base_pcs_compared']}",
                flush=True,
            )
        else:
            print(f"{'gc':<9} {r['error']}", flush=True)

    # points / kom / youth : pas de source Wikipedia exploitable ici, on ne
    # compare que base <-> PCS repare.
    for target in ("points", "kom", "youth"):
        r = compare(target, {}, sb)
        per_target[target] = r
        if "error" in r:
            print(f"{target:<9} {r['error']}", flush=True)
        else:
            print(
                f"{target:<9} base/PCS top15 "
                f"{len(r['base_vs_pcs_top15'])}/{r['base_pcs_compared']}",
                flush=True,
            )

    report = {
        "race": RACE,
        "per_target": per_target,
        "totaux_etapes": {
            "pcs_repare_vs_wikipedia": {"compares": t["pw_c"], "ecarts": t["pw_b"]},
            "base_vs_wikipedia": {"compares": t["bw_c"], "ecarts": t["bw_b"]},
            "base_vs_pcs_top15": {"compares": t["bp_c"], "ecarts": t["bp_b"]},
        },
    }
    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print()
    print(f"PCS repare vs Wikipedia : {t['pw_b']} ecart(s) / {t['pw_c']} rangs")
    print(f"Base       vs Wikipedia : {t['bw_b']} ecart(s) / {t['bw_c']} rangs")
    print(f"Base vs PCS repare 1-15 : {t['bp_b']} ecart(s) / {t['bp_c']} rangs")
    print(f"Detail : {OUT}")
    if t["pw_b"]:
        print("\nATTENTION : le correctif diverge d'une source independante.")


if __name__ == "__main__":
    main()
