"""Contre-verification par source independante (Wikipedia) — lecture seule.

Le correctif pcs_deobfuscate repare l'ordre DOM de PCS. Le valider contre PCS
lui-meme serait circulaire. Ce harnais confronte trois sources :

  W = Wikipedia (wikitext brut, parse deterministe, aucune dependance a PCS)
  P = PCS refetche par le chemin de production, correctif actif
  B = la base de prod

et repond a deux questions :
  1. P == W  ->  le correctif produit bien la verite (validation du correctif)
  2. B vs W  ->  l'ampleur reelle du bug en base (mesure independante)

Wikipedia ne publie que le top 10 par etape. La couverture est donc partielle,
mais c'est exactement la zone ou se concentrent les ecarts (30 des 54 sur les
rangs 1-10), et c'est la zone qui pese le plus en XP.

Usage :
    .venv/bin/python ../.scratch/pcs-import-integrity/verif/wikipedia_crosscheck.py
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

RACE = "race/vuelta-a-espana/2026"
WIKI = ROOT / "fixtures" / "wikipedia"
SWEEP = ROOT / "fixtures" / "sweep"
OUT = ROOT / "wikipedia-crosscheck-2026-09-14.json"

# Etape 3 annulee (meteo). Trou legitime.
STAGES = [s for s in range(1, 22) if s != 3]


def norm(s: str) -> frozenset:
    """Nom -> jeu de tokens ascii, insensible a l'ordre et aux diacritiques."""
    s = (s or "").lower()
    for a, b in (("ø", "o"), ("ł", "l"), ("đ", "d"), ("ß", "ss"), ("æ", "ae")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = " ".join(t for t in s.split() if t)
    s = ALIASES.get(s, s)
    return frozenset(s.split())


# --- W : Wikipedia -----------------------------------------------------------

# Le 2e argument peut contenir un lien pipe : [[Nom (cyclist)|Nom]]. Il faut
# donc consommer les [[...]] entiers avant de s'arreter sur un | de template.
RESULT_ROW = re.compile(r"\{\{cyclingresult\|(\d+)\|((?:\[\[[^\]]*\]\]|[^|}\n])+)")

# Variantes de nommage legitimes entre Wikipedia et PCS. Ce ne sont PAS des
# erreurs de rang : les deux sources designent le meme coureur. Chaque entree
# est verifiee a la main (nationalite + equipe + rang identiques des deux cotes).
ALIASES = {
    "alexey lutsenko": "aleksey lutsenko",
    "eddie dunbar": "edward irl dunbar",
    "ivo oliveira": "ivo emanuel alves",
    "pau marti": "pau marti soriano",
    "david gonzalez": "david gonzalez lopez",
    "cristian rodriguez": "cristian rodriguez",
}


def wiki_link_text(raw: str) -> str:
    """[[Matthew Brennan (cyclist)|Matthew Brennan]] -> Matthew Brennan"""
    raw = raw.strip()
    m = re.match(r"^\[\[(.+?)\]\]$", raw)
    if m:
        inner = m.group(1)
        return inner.split("|", 1)[1] if "|" in inner else inner
    return raw


def parse_wikipedia() -> dict[int, dict[int, str]]:
    """-> {stage: {rank: nom}} pour les tables 'Stage N Result' uniquement."""
    text = ""
    for f in sorted(WIKI.glob("*.json")):
        text += json.load(open(f, encoding="utf-8"))["parse"]["wikitext"]["*"] + "\n"

    out: dict[int, dict[int, str]] = {}
    # Decoupe sur chaque debut de table, en gardant son titre.
    blocks = re.split(r"\{\{cyclingresult start\|title=", text)
    for block in blocks[1:]:
        title = block.split("\n", 1)[0]
        m = re.match(r"Stage (\d+) Result", title)
        if not m:
            continue  # table de classement general / final : hors perimetre
        stage = int(m.group(1))
        body = block.split("{{cyclingresult end}}", 1)[0]
        rows = {}
        for rank, name in RESULT_ROW.findall(body):
            rows[int(rank)] = wiki_link_text(name)
        if stage in out:
            raise SystemExit(f"table 'Stage {stage} Result' vue deux fois")
        out[stage] = rows
    return out


# Erreurs Wikipedia connues, validees a la main par l'utilisateur (2026-09-14).
# Etape 1 (ITT, page PCS non brouillee : data-id="" et zero regle CSS) :
# Wikipedia inverse deux coequipiers Decathlon a 1" d'ecart. Bisiaux est 6e.
WIKIPEDIA_KNOWN_ERRORS = {
    (1, 6): "Léo Bisiaux",
    (1, 7): "Oscar Chamberlain",
}

# --- P : PCS refetche, correctif actif ---------------------------------------


def parse_pcs(stage: int) -> dict[int, str]:
    """-> {rank: rider_url} depuis la page en cache, chemin de prod."""
    html = (SWEEP / f"stage-{stage}.html").read_text(encoding="utf-8")
    slug = f"{RACE}/stage-{stage}"
    return {
        e["rank"]: (e.get("rider_url") or "")
        for e in Stage(slug, html=html, update_html=False).results()
        if e.get("rank")
    }


# --- B : la base --------------------------------------------------------------


def parse_base(sb, stage: int) -> dict[int, tuple[str, str]]:
    """-> {rank: (pcs_slug, full_name)}"""
    slug = f"{RACE}/stage-{stage}"
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


def main() -> None:
    wiki = parse_wikipedia()
    sb = get_supabase()
    report: dict[str, object] = {}
    per_stage = {}

    tot_pw_cmp = tot_pw_bad = 0
    tot_bw_cmp = tot_bw_bad = 0

    for st in STAGES:
        w = wiki.get(st)
        if not w:
            per_stage[st] = {"error": "absent de Wikipedia"}
            print(f"stage-{st:<2} ABSENT de Wikipedia", flush=True)
            continue

        p = parse_pcs(st)
        b = parse_base(sb, st)

        pcs_vs_wiki, base_vs_wiki = [], []
        pw_cmp = bw_cmp = 0

        for rank, wname in sorted(w.items()):
            wname = WIKIPEDIA_KNOWN_ERRORS.get((st, rank), wname)
            wn = norm(wname)

            if rank in p:
                pw_cmp += 1
                if not (norm(p[rank]) >= wn):
                    pcs_vs_wiki.append(
                        {"rank": rank, "wikipedia": wname, "pcs_repare": p[rank]}
                    )

            if rank in b:
                bw_cmp += 1
                bslug, bname = b[rank]
                if not (norm(bslug) >= wn):
                    base_vs_wiki.append(
                        {
                            "rank": rank,
                            "wikipedia": wname,
                            "base": bname or bslug,
                            "base_slug": bslug,
                        }
                    )

        tot_pw_cmp += pw_cmp
        tot_pw_bad += len(pcs_vs_wiki)
        tot_bw_cmp += bw_cmp
        tot_bw_bad += len(base_vs_wiki)

        per_stage[st] = {
            "wiki_ranks": len(w),
            "pcs_compared": pw_cmp,
            "pcs_vs_wiki": pcs_vs_wiki,
            "base_compared": bw_cmp,
            "base_vs_wiki": base_vs_wiki,
        }
        flag = "  <-- PCS repare DIVERGE" if pcs_vs_wiki else ""
        print(
            f"stage-{st:<2} PCS/wiki {len(pcs_vs_wiki)}/{pw_cmp}   "
            f"base/wiki {len(base_vs_wiki)}/{bw_cmp}{flag}",
            flush=True,
        )

    report["per_stage"] = per_stage
    report["totaux"] = {
        "pcs_repare_vs_wikipedia": {"compares": tot_pw_cmp, "ecarts": tot_pw_bad},
        "base_vs_wikipedia": {"compares": tot_bw_cmp, "ecarts": tot_bw_bad},
    }
    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print()
    print(f"PCS repare vs Wikipedia : {tot_pw_bad} ecart(s) sur {tot_pw_cmp} rangs compares")
    print(f"Base       vs Wikipedia : {tot_bw_bad} ecart(s) sur {tot_bw_cmp} rangs compares")
    print(f"Detail : {OUT}")
    if tot_pw_bad:
        print("\nATTENTION : le correctif diverge d'une source independante. Ne pas ecrire en prod.")


if __name__ == "__main__":
    main()
