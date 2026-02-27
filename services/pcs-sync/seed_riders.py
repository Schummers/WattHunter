"""
Seed script — inserts fake but realistic riders for dev/testing.
Covers the 5 alpha ProTeams with ~6 riders each.
Run: python3 seed_riders.py
"""
import os
import json
import urllib.request
import urllib.error

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://uuvshpykvpnhpeondqjt.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# CONVERSION_RATE: €/PCS point (placeholder as per CLAUDE.md)
CONVERSION_RATE = 500
SALARY_FLOOR = 5_000
SALARY_CAP = 300_000

def calc_salary(pcs_points: int) -> int:
    annual = (pcs_points / 1000) * 500_000
    monthly = annual / 12
    return max(SALARY_FLOOR, min(SALARY_CAP, int(monthly)))

# Fake but realistic riders — 6 per team
RIDERS = [
    # Tudor Pro Cycling
    {"pcs_id": "tudor-marcos-frau", "full_name": "Marcos Frau", "team_pcs_id": "tudor-pro-cycling-2026", "team_name": "Tudor Pro Cycling", "nationality": "ES", "age": 24, "specialty": "climber", "pcs_points_1yr": 280, "pcs_rank": 145},
    {"pcs_id": "tudor-alberto-dainese", "full_name": "Alberto Dainese", "team_pcs_id": "tudor-pro-cycling-2026", "team_name": "Tudor Pro Cycling", "nationality": "IT", "age": 26, "specialty": "sprinter", "pcs_points_1yr": 540, "pcs_rank": 72},
    {"pcs_id": "tudor-stefan-kung", "full_name": "Stefan Küng", "team_pcs_id": "tudor-pro-cycling-2026", "team_name": "Tudor Pro Cycling", "nationality": "CH", "age": 30, "specialty": "time_trialist", "pcs_points_1yr": 820, "pcs_rank": 38},
    {"pcs_id": "tudor-mattias-skjelmose", "full_name": "Mattias Skjelmose", "team_pcs_id": "tudor-pro-cycling-2026", "team_name": "Tudor Pro Cycling", "nationality": "DK", "age": 23, "specialty": "all_rounder", "pcs_points_1yr": 1240, "pcs_rank": 18},
    {"pcs_id": "tudor-julius-johansen", "full_name": "Julius Johansen", "team_pcs_id": "tudor-pro-cycling-2026", "team_name": "Tudor Pro Cycling", "nationality": "DK", "age": 22, "specialty": "climber", "pcs_points_1yr": 120, "pcs_rank": 310},
    {"pcs_id": "tudor-arjen-livyns", "full_name": "Arjen Livyns", "team_pcs_id": "tudor-pro-cycling-2026", "team_name": "Tudor Pro Cycling", "nationality": "BE", "age": 29, "specialty": "puncheur", "pcs_points_1yr": 380, "pcs_rank": 110},

    # Cofidis
    {"pcs_id": "cofidis-bryan-coquard", "full_name": "Bryan Coquard", "team_pcs_id": "cofidis-2026", "team_name": "Cofidis", "nationality": "FR", "age": 32, "specialty": "sprinter", "pcs_points_1yr": 620, "pcs_rank": 58},
    {"pcs_id": "cofidis-ruben-fernandez", "full_name": "Rubén Fernández", "team_pcs_id": "cofidis-2026", "team_name": "Cofidis", "nationality": "ES", "age": 33, "specialty": "climber", "pcs_points_1yr": 210, "pcs_rank": 195},
    {"pcs_id": "cofidis-pierre-luc-perichon", "full_name": "Pierre-Luc Périchon", "team_pcs_id": "cofidis-2026", "team_name": "Cofidis", "nationality": "FR", "age": 35, "specialty": "all_rounder", "pcs_points_1yr": 95, "pcs_rank": 420},
    {"pcs_id": "cofidis-axel-zingle", "full_name": "Axel Zingle", "team_pcs_id": "cofidis-2026", "team_name": "Cofidis", "nationality": "FR", "age": 26, "specialty": "sprinter", "pcs_points_1yr": 480, "pcs_rank": 88},
    {"pcs_id": "cofidis-harold-tejada", "full_name": "Harold Tejada", "team_pcs_id": "cofidis-2026", "team_name": "Cofidis", "nationality": "CO", "age": 27, "specialty": "climber", "pcs_points_1yr": 340, "pcs_rank": 128},
    {"pcs_id": "cofidis-adria-moreno", "full_name": "Adrià Moreno", "team_pcs_id": "cofidis-2026", "team_name": "Cofidis", "nationality": "ES", "age": 23, "specialty": "climber", "pcs_points_1yr": 65, "pcs_rank": 580},

    # Q36.5 Pro Cycling
    {"pcs_id": "q365-louis-meintjes", "full_name": "Louis Meintjes", "team_pcs_id": "q36-5-pro-cycling-team-2026", "team_name": "Q36.5 Pro Cycling", "nationality": "ZA", "age": 32, "specialty": "climber", "pcs_points_1yr": 760, "pcs_rank": 45},
    {"pcs_id": "q365-marco-brenner", "full_name": "Marco Brenner", "team_pcs_id": "q36-5-pro-cycling-team-2026", "team_name": "Q36.5 Pro Cycling", "nationality": "DE", "age": 22, "specialty": "all_rounder", "pcs_points_1yr": 420, "pcs_rank": 98},
    {"pcs_id": "q365-jonas-rapp", "full_name": "Jonas Rapp", "team_pcs_id": "q36-5-pro-cycling-team-2026", "team_name": "Q36.5 Pro Cycling", "nationality": "DE", "age": 25, "specialty": "climber", "pcs_points_1yr": 180, "pcs_rank": 225},
    {"pcs_id": "q365-reto-hollenstein", "full_name": "Reto Hollenstein", "team_pcs_id": "q36-5-pro-cycling-team-2026", "team_name": "Q36.5 Pro Cycling", "nationality": "CH", "age": 38, "specialty": "time_trialist", "pcs_points_1yr": 55, "pcs_rank": 640},
    {"pcs_id": "q365-alexis-vuillermoz", "full_name": "Alexis Vuillermoz", "team_pcs_id": "q36-5-pro-cycling-team-2026", "team_name": "Q36.5 Pro Cycling", "nationality": "FR", "age": 36, "specialty": "puncheur", "pcs_points_1yr": 290, "pcs_rank": 140},
    {"pcs_id": "q365-andrea-vendrame", "full_name": "Andrea Vendrame", "team_pcs_id": "q36-5-pro-cycling-team-2026", "team_name": "Q36.5 Pro Cycling", "nationality": "IT", "age": 30, "specialty": "puncheur", "pcs_points_1yr": 510, "pcs_rank": 80},

    # TotalEnergies
    {"pcs_id": "total-peter-sagan", "full_name": "Peter Sagan", "team_pcs_id": "totalenergies-2026", "team_name": "TotalEnergies", "nationality": "SK", "age": 36, "specialty": "puncheur", "pcs_points_1yr": 310, "pcs_rank": 135},
    {"pcs_id": "total-thibaut-pinot", "full_name": "Thibaut Pinot", "team_pcs_id": "totalenergies-2026", "team_name": "TotalEnergies", "nationality": "FR", "age": 35, "specialty": "climber", "pcs_points_1yr": 195, "pcs_rank": 210},
    {"pcs_id": "total-danny-van-poppel", "full_name": "Danny van Poppel", "team_pcs_id": "totalenergies-2026", "team_name": "TotalEnergies", "nationality": "NL", "age": 31, "specialty": "sprinter", "pcs_points_1yr": 460, "pcs_rank": 92},
    {"pcs_id": "total-mathieu-burgaudeau", "full_name": "Mathieu Burgaudeau", "team_pcs_id": "totalenergies-2026", "team_name": "TotalEnergies", "nationality": "FR", "age": 26, "specialty": "puncheur", "pcs_points_1yr": 720, "pcs_rank": 48},
    {"pcs_id": "total-pierre-latour", "full_name": "Pierre Latour", "team_pcs_id": "totalenergies-2026", "team_name": "TotalEnergies", "nationality": "FR", "age": 30, "specialty": "climber", "pcs_points_1yr": 280, "pcs_rank": 148},
    {"pcs_id": "total-cyril-barthe", "full_name": "Cyril Barthe", "team_pcs_id": "totalenergies-2026", "team_name": "TotalEnergies", "nationality": "FR", "age": 28, "specialty": "climber", "pcs_points_1yr": 130, "pcs_rank": 295},

    # Caja Rural
    {"pcs_id": "cajarural-antonio-pedrero", "full_name": "Antonio Pedrero", "team_pcs_id": "caja-rural-seguros-rga-2026", "team_name": "Caja Rural - Seguros RGA", "nationality": "ES", "age": 33, "specialty": "climber", "pcs_points_1yr": 390, "pcs_rank": 105},
    {"pcs_id": "cajarural-lluis-mas", "full_name": "Lluís Mas", "team_pcs_id": "caja-rural-seguros-rga-2026", "team_name": "Caja Rural - Seguros RGA", "nationality": "ES", "age": 30, "specialty": "all_rounder", "pcs_points_1yr": 560, "pcs_rank": 68},
    {"pcs_id": "cajarural-raul-garcia", "full_name": "Raúl García Pierna", "team_pcs_id": "caja-rural-seguros-rga-2026", "team_name": "Caja Rural - Seguros RGA", "nationality": "ES", "age": 27, "specialty": "climber", "pcs_points_1yr": 220, "pcs_rank": 185},
    {"pcs_id": "cajarural-pau-miquel", "full_name": "Pau Miquel", "team_pcs_id": "caja-rural-seguros-rga-2026", "team_name": "Caja Rural - Seguros RGA", "nationality": "ES", "age": 24, "specialty": "climber", "pcs_points_1yr": 85, "pcs_rank": 460},
    {"pcs_id": "cajarural-david-gonzalez", "full_name": "David González", "team_pcs_id": "caja-rural-seguros-rga-2026", "team_name": "Caja Rural - Seguros RGA", "nationality": "ES", "age": 26, "specialty": "puncheur", "pcs_points_1yr": 155, "pcs_rank": 255},
    {"pcs_id": "cajarural-rein-taaramae", "full_name": "Rein Taaramäe", "team_pcs_id": "caja-rural-seguros-rga-2026", "team_name": "Caja Rural - Seguros RGA", "nationality": "EE", "age": 37, "specialty": "climber", "pcs_points_1yr": 175, "pcs_rank": 235},
]


def upsert_riders():
    payload = []
    for r in RIDERS:
        salary = calc_salary(r["pcs_points_1yr"])
        payload.append({
            "pcs_slug": r["pcs_id"],
            "full_name": r["full_name"],
            "real_team": r["team_name"],
            "team_type": "ProTeam",
            "nationality": r["nationality"],
            "age": r["age"],
            "specialty": r["specialty"],
            "pcs_points_1yr": r["pcs_points_1yr"],
            "pcs_rank": r["pcs_rank"],
            "monthly_salary": salary,
            "photo_url": None,
            "is_active_in_game": True,
        })

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/riders",
        data=data,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            print(f"OK — {len(payload)} riders seeded (HTTP {resp.status})")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"ERROR {e.code}: {body}")


if __name__ == "__main__":
    if not SUPABASE_KEY:
        # Try reading from apps/web/.env.local
        import pathlib
        env_path = pathlib.Path(__file__).parent.parent.parent / "apps" / "web" / ".env.local"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                    SUPABASE_KEY = line.split("=", 1)[1].strip()
                    break

    if not SUPABASE_KEY:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY not found")
        exit(1)

    print(f"Seeding {len(RIDERS)} riders into {SUPABASE_URL}...")
    upsert_riders()
