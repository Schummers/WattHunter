"""Ticket 02 — outillage de correction du Tour de France 2026, a cible explicite.

Un seul script pour les tickets 3, 4, 5 (local) et 6 (prod) : ce qui a ete
valide en local est litteralement ce qui est rejoue en prod, etape par etape.

    python correct_tdf2026.py <etape> --target local|prod [--write]

Etapes : baseline · reimport · import-events · rescore · diff

Deux garde-fous, tous deux dans le code et non dans une consigne ecrite :

  * **la cible est obligatoire** (`--target`), il n'y a pas de defaut ;
  * **la prod exige `--write`** en plus. Sans lui, `--target prod` prend le
    baseline puis s'arrete : c'est un dry-run, aucune ecriture.

Le fetch HTML est **remplace par une lecture du cache** `fixtures/sweep-tdf/`
(25 pages photographiees le 2026-09-14). Une URL absente du cache fait echouer
le script : le brouillage anti-scraping de PCS tourne dans le temps, refetcher
en direct au milieu d'une correction rejouerait un autre etat de PCS que celui
sur lequel le diagnostic a ete chiffre.

Perimetre fige dans le code : etapes 2 a 21 + /gc + /points /kom /youth.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve()
SCRATCH = HERE.parent
REPO = HERE.parents[2]
PCS = REPO / "services" / "pcs-sync"
CACHE = REPO / ".scratch" / "pcs-import-integrity" / "fixtures" / "sweep-tdf"
SNAPSHOTS = SCRATCH / "snapshots"

sys.path.insert(0, str(PCS))

RACE = "race/tour-de-france/2026"
RACE_NAME = "Tour de France"
LEAGUE = "00000000-0000-4000-8000-c1a551c2026e"  # Classiques de l'individualisme V2
PARIS = ZoneInfo("Europe/Paris")

# --- Perimetre -------------------------------------------------------------
# stage-1 est VOLONTAIREMENT exclue. C'est un contre-la-montre par equipes :
# `race_results` y stocke les positions INDIVIDUELLES au general apres l'etape 1
# (contournement GC-as-stage-1, memoire `tdf2026_stage1_ttt_via_gc`), alors que
# la page PCS `stage-1` publie un classement PAR EQUIPES (huit coureurs au rang
# 1, huit au rang 2). La reimporter ecraserait des rangs justes par des rangs
# d'equipe et casserait les 951,5 XP distribues sur cette etape. Elle a ete
# verifiee exacte a la main contre Wikipedia (ticket 09, section « L'etape 1 est
# propre »).
STAGE_TARGETS = [f"stage-{n}" for n in range(2, 22)]
SECONDARY_TARGETS = ["points", "kom", "youth"]
TARGETS = STAGE_TARGETS + ["gc"] + SECONDARY_TARGETS

STAGE_SLUGS = [f"{RACE}/{t}" for t in STAGE_TARGETS]
GC_SLUG = f"{RACE}/gc"
SECONDARY_SLUGS = [f"{RACE}/{t}" for t in SECONDARY_TARGETS]
STAGE_1_SLUG = f"{RACE}/stage-1"
# stage-1 entre dans le baseline et dans le diff (on veut voir si elle bouge,
# elle ne doit pas), jamais dans le reimport ni dans le rescore.
ALL_SLUGS = [STAGE_1_SLUG] + STAGE_SLUGS + [GC_SLUG] + SECONDARY_SLUGS
SCORED_SLUGS = STAGE_SLUGS + [GC_SLUG] + SECONDARY_SLUGS
# Les EVENEMENTS, eux, couvrent bien les 21 etapes. L'exclusion de stage-1 porte
# sur `race_results` (rangs par equipes contre positions au general stockees) ;
# `import_stage_events` n'ecrit que dans `stage_event_results` et ne touche
# aucun rang, donc les cotes et le sprint de l'etape 1 sont importables sans
# risque — et le rescore les attend.
EVENT_SLUGS = [STAGE_1_SLUG] + STAGE_SLUGS


# --- Cible -----------------------------------------------------------------
def resolve_target(target: str) -> tuple[str, str]:
    """-> (url, service_role_key) pour `local` ou `prod`. Jamais de defaut."""
    if target == "prod":
        from dotenv import load_dotenv

        load_dotenv(PCS / ".env")
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise SystemExit("prod : SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents de services/pcs-sync/.env")
        if "127.0.0.1" in url or "localhost" in url:
            raise SystemExit(f"prod : l'URL du .env pointe en local ({url}). Refus.")
        return url, key

    # local : on interroge le CLI plutot que de coder en dur une cle de demo.
    url = os.environ.get("TDF_LOCAL_SUPABASE_URL")
    key = os.environ.get("TDF_LOCAL_SERVICE_ROLE_KEY")
    if url and key:
        return url, key
    try:
        out = subprocess.run(
            ["supabase", "status", "-o", "env"],
            cwd=REPO, capture_output=True, text=True, check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        raise SystemExit(
            "local : la stack Supabase locale ne repond pas "
            "(`supabase start`, ticket 01). Detail : " + str(exc)
        )
    env = {}
    for line in out.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    url = env.get("API_URL", "")
    key = env.get("SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise SystemExit("local : `supabase status -o env` ne rend ni API_URL ni SERVICE_ROLE_KEY.")
    return url, key


def client(target: str):
    url, key = resolve_target(target)
    # sync.py lit ces deux variables AU MOMENT DE L'IMPORT du module : il faut
    # donc les poser avant, et repointer aussi les constantes deja figees.
    os.environ["SUPABASE_URL"] = url
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = key
    import sync

    sync.SUPABASE_URL = url
    sync.SUPABASE_KEY = key
    print(f"[cible] {target} -> {url}")
    return sync.get_supabase()


# --- Cache HTML ------------------------------------------------------------
def cached_html(url: str) -> str:
    """Lit la page dans le cache. Echoue si absente — jamais de fetch direct."""
    target = url.rsplit("/", 1)[-1]
    path = CACHE / f"{target}.html"
    if not path.exists():
        raise SystemExit(
            f"URL hors cache : {url} (attendu {path}). Le cache est la seule "
            "trace de l'etat de PCS au 2026-09-14 ; refetcher en direct "
            "rejouerait un autre brouillage. Refus."
        )
    return path.read_text(encoding="utf-8")


def install_cache_fetch() -> None:
    """Remplace fetch_html par la lecture du cache, partout ou il est resolu."""
    import sync
    import sync_race
    from pcs_deobfuscate import deobfuscate

    async def _fetch(page, url: str, delay: float = 4.0) -> str:
        html = cached_html(url)
        # Le cache a ete ecrit par fetch_tdf2026.py, qui passe deja par
        # fetch_html donc par le correctif. On le rejoue quand meme : il est
        # idempotent sur une page saine, et c'est lui qui doit refuser une page
        # qu'il ne sait pas reparer, pas un commentaire.
        html, _ = deobfuscate(html, source=url)
        return html

    sync.fetch_html = _fetch
    sync_race.fetch_html = _fetch
    print(f"[cache] fetch_html -> {CACHE.relative_to(REPO)}")


# --- Baseline / snapshots --------------------------------------------------
# Cle de tri stable, obligatoire : sans `order`, PostgREST pagine sur un ordre
# non garanti et `_fetch_all` peut rendre deux fois la meme ligne et en sauter
# une autre. Toutes ces tables n'ont pas de colonne `id` — `stage_profiles`,
# `gt_final_classifications` et `stage_event_results` sont clefees autrement.
ORDER_KEY = {
    "teams": ["id"],
    "race_results": ["id"],
    "rider_xp_daily": ["id"],
    "team_ranking_daily": ["id"],
    "stage_profiles": ["race_slug"],
    "gt_final_classifications": ["race_slug", "rider_id"],
    "stage_event_results": ["race_slug", "rider_id", "event_type", "rank"],
}


def _fetch_all(sb, table: str, select: str, apply=None):
    from db_utils import _fetch_all as fa

    keys = ORDER_KEY[table]

    def factory():
        q = sb.table(table).select(select)
        if apply:
            q = apply(q)
        for k in keys:
            q = q.order(k)
        return q

    return fa(factory)


def take_snapshot(sb, label: str) -> Path:
    """Snapshot date, restreint aux slugs du Tour et aux 9 equipes de la ligue."""
    teams = _fetch_all(
        sb, "teams", "id,name,cumulative_xp,level,league_id",
        lambda q: q.eq("league_id", LEAGUE),
    )
    team_ids = [t["id"] for t in teams]

    snap = {
        "taken_at": datetime.now(PARIS).isoformat(),
        "label": label,
        "race": RACE,
        "league": LEAGUE,
        "slugs": ALL_SLUGS,
        "teams": sorted(
            [
                {
                    "id": t["id"], "name": t["name"],
                    "cumulative_xp": t["cumulative_xp"], "level": t["level"],
                }
                for t in teams
            ],
            key=lambda t: -float(t["cumulative_xp"] or 0),
        ),
        "race_results": _fetch_all(
            sb, "race_results", "rider_id,race_slug,rank,pcs_points,race_date,is_itt,profile_icon,breakaway_kms",
            lambda q: q.in_("race_slug", ALL_SLUGS),
        ),
        "gt_final_classifications": _fetch_all(
            sb, "gt_final_classifications", "race_slug,classification_type,rider_id,rank,race_date",
            lambda q: q.in_("race_slug", SECONDARY_SLUGS),
        ),
        "stage_event_results": _fetch_all(
            sb, "stage_event_results", "race_slug,rider_id,event_type,category,rank",
            lambda q: q.in_("race_slug", ALL_SLUGS),
        ),
        "rider_xp_daily": _fetch_all(
            sb, "rider_xp_daily", "*",
            lambda q: q.in_("race_slug", ALL_SLUGS).in_("team_id", team_ids),
        ),
        "team_ranking_daily": _fetch_all(
            sb, "team_ranking_daily", "*",
            lambda q: q.in_("team_id", team_ids),
        ),
    }

    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(PARIS).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOTS / f"{stamp}-{label}.json"
    path.write_text(json.dumps(snap, indent=2, ensure_ascii=False, default=str), encoding="utf-8")

    counts = {k: len(v) for k, v in snap.items() if isinstance(v, list)}
    print(f"[baseline] {path.relative_to(REPO)}")
    for k, v in counts.items():
        print(f"           {k:26s} {v:>6}")
    return path


# --- Dates d'etape ---------------------------------------------------------
def stage_dates(sb) -> dict[str, str]:
    """race_date par slug, lue dans stage_profiles.

    JAMAIS la date de cloture : le cutoff des roles (11h Europe/Paris) se
    calcule sur la date de l'etape. Confondre les deux a fait scorer la Vuelta
    avec les escouades du jour de la cloture (runbook
    `vuelta2026-closeout-2026-09-14.md`).
    """
    rows = _fetch_all(
        sb, "stage_profiles", "race_slug,race_date",
        lambda q: q.in_("race_slug", STAGE_SLUGS),
    )
    dates = {r["race_slug"]: str(r["race_date"]) for r in rows if r.get("race_date")}
    missing = [s for s in STAGE_SLUGS if s not in dates]
    if missing:
        raise SystemExit(
            "stage_profiles sans race_date pour : " + ", ".join(missing)
            + "\nLancer `run_pipeline.py startlists --race " + RACE + "` d'abord."
        )
    # /gc et les maillots se scorent a la date de la derniere etape.
    last = dates[STAGE_SLUGS[-1]]
    for slug in [GC_SLUG] + SECONDARY_SLUGS:
        dates[slug] = last
    return dates


def cutoff_for(day: str) -> datetime:
    y, m, d = (int(x) for x in day.split("-"))
    return datetime(y, m, d, 11, 0, 0, tzinfo=PARIS)


# --- Etapes ----------------------------------------------------------------
async def step_reimport(sb, dates: dict[str, str]) -> None:
    """Ticket 03 — rangs des etapes 2-21 + /gc, depuis le cache."""
    from sync_race import import_race_results, import_gc_results, import_final_classifications

    for slug in STAGE_SLUGS:
        res = await import_race_results(
            sb, None, race_slug=RACE, race_name=RACE_NAME,
            race_date=dates[slug], stage_url=slug,
        )
        swaps = len(res.get("deobfuscated") or [])
        print(f"  {slug.rsplit('/', 1)[1]:9s} imported={res['imported']:>3} "
              f"skipped={res['skipped']:>3} deob={swaps:>2} errors={len(res['errors'])}")

    res = await import_gc_results(
        sb, None, race_slug=RACE, race_name=RACE_NAME, race_date=dates[GC_SLUG]
    )
    print(f"  {'gc':9s} imported={res['imported']:>3} skipped={res['skipped']:>3} "
          f"deob={len(res.get('deobfuscated') or []):>2}")

    counts = await import_final_classifications(
        sb, None, race_slug=RACE, race_name=RACE_NAME, race_date=dates[GC_SLUG]
    )
    print(f"  finaux    points={counts['points']} kom={counts['kom']} youth={counts['youth']}")


async def step_import_events(sb, dates: dict[str, str]) -> None:
    """Ticket 04 — cotes et sprints intermediaires, depuis le meme cache.

    `import_race_results` les importe deja au passage sur une etape de GT, mais
    seulement sur les etapes qu'il reimporte, donc 2 a 21. Cette etape existe
    pour les rejouer seules, sans retoucher aux rangs, et surtout pour couvrir
    **l'etape 1**, que le reimport laisse volontairement de cote.

    `import_stage_events` est idempotente : elle supprime les lignes de l'etape
    avant de reinserer, quand le parse a produit des evenements.
    """
    from procyclingstats import Stage
    from stage_events import import_stage_events
    from db_utils import _fetch_all as fa

    riders = fa(lambda: sb.table("riders").select("id, pcs_slug"))
    rider_map = {r["pcs_slug"]: r["id"] for r in riders}

    total = 0
    for slug in EVENT_SLUGS:
        html = cached_html(slug)
        from pcs_deobfuscate import deobfuscate

        html, _ = deobfuscate(html, source=slug)
        stage = Stage(slug, html=html, update_html=False)
        res = import_stage_events(
            sb, stage_slug=slug, stage=stage, html=html, rider_map=rider_map
        )
        total += res["imported"]
        print(f"  {slug.rsplit('/', 1)[1]:9s} kom={res['kom_events']:>2} "
              f"sprint={res['sprint_events']:>2} imported={res['imported']:>3} "
              f"unmapped={res['skipped_unmapped']:>3} errors={len(res['errors'])}")
    print(f"  total lignes stage_event_results ecrites : {total}")


async def step_rescore(sb, dates: dict[str, str]) -> None:
    """Ticket 05 — rescore au code d'aujourd'hui, UNE etape par appel.

    `calculate_daily_scores` calcule un cutoff unique par appel, depuis la date
    du premier slug (« all slugs in one call share a date »). Passer les 24
    slugs ensemble scorerait les 24 avec l'escouade du jour de l'etape 2.
    """
    from scoring import calculate_daily_scores

    for slug in SCORED_SLUGS:
        day = dates[slug]
        out = await calculate_daily_scores(
            sb, race_slugs=[slug], role_cutoff=cutoff_for(day)
        )
        # Deux formes de retour : le chemin complet rend `teams_processed`,
        # les sorties anticipees rendent `processed`. Afficher les deux, sinon
        # un slug sorti en « aucun resultat trouve » passe pour un succes.
        print(f"  {slug.rsplit('/', 1)[1]:9s} cutoff={day} 11:00 "
              f"-> {out.get('status')} teams_processed={out.get('teams_processed')} "
              f"early_exit={out.get('message') or '-'} "
              f"errors={len(out.get('errors') or [])}")


def step_diff(before_path: Path, after_path: Path) -> None:
    before = json.loads(before_path.read_text(encoding="utf-8"))
    after = json.loads(after_path.read_text(encoding="utf-8"))

    names = {t["id"]: t["name"] for t in before["teams"]}
    names.update({t["id"]: t["name"] for t in after["teams"]})

    def by_id(snap, key, field):
        return {t["id"]: t.get(field) for t in snap[key]}

    xp_b, xp_a = by_id(before, "teams", "cumulative_xp"), by_id(after, "teams", "cumulative_xp")
    lv_b, lv_a = by_id(before, "teams", "level"), by_id(after, "teams", "level")

    def xp_by_slug(snap):
        out = defaultdict(float)
        for r in snap["rider_xp_daily"]:
            out[(r["team_id"], r["race_slug"])] += float(r.get("xp_gained") or 0)
        return out

    sb_, sa_ = xp_by_slug(before), xp_by_slug(after)

    def rank_rows(snap):
        return len(snap["team_ranking_daily"])

    print("\n" + "=" * 86)
    print(f"DIFF  {before_path.name}  ->  {after_path.name}")
    print("=" * 86)
    print(f"\n{'Equipe':<24}{'cumulative_xp':>28}{'delta':>12}{'level':>12}")
    for tid in sorted(names, key=lambda t: -float(xp_a.get(t) or 0)):
        b, a = float(xp_b.get(tid) or 0), float(xp_a.get(tid) or 0)
        lb, la = lv_b.get(tid), lv_a.get(tid)
        lvl = f"{lb}" if lb == la else f"{lb} -> {la}"
        print(f"{names[tid]:<24}{b:>12.2f} -> {a:>12.2f}{a - b:>+12.2f}{lvl:>12}")

    print(f"\n{'Equipe':<24}{'slug':<12}{'XP avant':>12}{'XP apres':>12}{'delta':>12}")
    for key in sorted(set(sb_) | set(sa_)):
        tid, slug = key
        b, a = sb_.get(key, 0.0), sa_.get(key, 0.0)
        if abs(a - b) < 0.005:
            continue
        print(f"{names.get(tid, tid[:8]):<24}{slug.rsplit('/', 1)[1]:<12}"
              f"{b:>12.2f}{a:>12.2f}{a - b:>+12.2f}")

    print(f"\nteam_ranking_daily : {rank_rows(before)} ligne(s) avant, "
          f"{rank_rows(after)} apres ({rank_rows(after) - rank_rows(before):+d})")


# --- CLI -------------------------------------------------------------------
def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("step", choices=["baseline", "reimport", "import-events", "rescore", "diff"])
    p.add_argument("--target", choices=["local", "prod"], required=True,
                   help="obligatoire, sans defaut")
    p.add_argument("--write", action="store_true",
                   help="prod uniquement : autorise l'ecriture. Sans lui, dry-run.")
    p.add_argument("--before", type=Path, help="diff : snapshot avant")
    p.add_argument("--after", type=Path, help="diff : snapshot apres")
    args = p.parse_args()

    if args.step == "diff":
        if not args.before or not args.after:
            raise SystemExit("diff : --before et --after sont requis.")
        step_diff(args.before, args.after)
        return 0

    writes = args.step in ("reimport", "import-events", "rescore")
    if writes and args.target == "prod" and not args.write:
        print("\n*** DRY-RUN PROD *** — `--write` absent.")
        sb = client(args.target)
        take_snapshot(sb, f"dryrun-{args.step}")
        print(f"\nBaseline pris, arret avant `{args.step}`. Aucune ecriture.")
        print("Pour executer reellement : ajouter --write (ticket 06, apres validation humaine).")
        return 0

    sb = client(args.target)

    if args.step == "baseline":
        take_snapshot(sb, "baseline")
        return 0

    # Toute ecriture est precedee de son propre baseline, sur disque, sans exception.
    take_snapshot(sb, f"avant-{args.step}")
    install_cache_fetch()
    dates = stage_dates(sb)

    if args.step == "reimport":
        asyncio.run(step_reimport(sb, dates))
    elif args.step == "import-events":
        asyncio.run(step_import_events(sb, dates))
    elif args.step == "rescore":
        asyncio.run(step_rescore(sb, dates))

    take_snapshot(sb, f"apres-{args.step}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
