"""One-shot cleanup script — disable Remontada Boost mechanic.

- Reverts all rider_xp_daily rows with remontada_mult > 1 to mult=1.0 and
  recomputes xp_gained without the boost
- Recomputes teams.cumulative_xp delta for affected teams
- Truncates remontada_boosts and remontada_boost_triggers
- Idempotent: re-running has no effect after first cleanup
"""
import os
from supabase import create_client
from dotenv import load_dotenv
load_dotenv()
sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

print('=== Step 1 — Revert rider_xp_daily rows with remontada_mult > 1 ===')
rows = sb.table('rider_xp_daily').select(
    'id, team_id, race_slug, raw_pcs_points, strategy_bonus, gt_role_mult, gt_classif_bonus, nemesis_modifier, remontada_mult, xp_gained'
).gt('remontada_mult', 1).execute()

delta_by_team: dict[str, float] = {}
for r in rows.data:
    raw = float(r['raw_pcs_points'] or 0)
    strat = float(r['strategy_bonus'] or 0)
    role = float(r['gt_role_mult'] or 1.0)
    classif = float(r['gt_classif_bonus'] or 0)
    nem = float(r['nemesis_modifier'] or 1.0)
    new_xp = max(0, round((raw * role * (1 + strat) + classif) * 1.0 * nem, 2))
    old_xp = float(r['xp_gained'])
    delta = old_xp - new_xp
    delta_by_team[r['team_id']] = delta_by_team.get(r['team_id'], 0) + delta
    print(f"  {r['race_slug'].split('/')[-1]} (team {r['team_id'][:8]}): {old_xp} -> {new_xp}")
    sb.table('rider_xp_daily').update({'remontada_mult': 1.0, 'xp_gained': new_xp}).eq('id', r['id']).execute()
print(f"  {len(rows.data)} rows reverted")

print()
print('=== Step 2 — Recompute teams.cumulative_xp ===')
for tid, delta in delta_by_team.items():
    t = sb.table('teams').select('name, cumulative_xp').eq('id', tid).single().execute()
    old_cum = float(t.data['cumulative_xp'])
    new_cum = round(old_cum - delta, 2)
    print(f"  {t.data['name']}: {old_cum} -> {new_cum} (delta {-delta:+.2f})")
    sb.table('teams').update({'cumulative_xp': new_cum}).eq('id', tid).execute()

print()
print('=== Step 3 — Truncate remontada_boosts and remontada_boost_triggers ===')
b = sb.table('remontada_boosts').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
print(f"  remontada_boosts: {len(b.data)} rows deleted")
# triggers has composite PK, delete with a always-true filter
t = sb.table('remontada_boost_triggers').delete().gte('triggered_at_stage', 0).execute()
print(f"  remontada_boost_triggers: {len(t.data)} rows deleted")

print()
print('=== Final ===')
teams = sb.table('teams').select('name, cumulative_xp').execute()
for t in sorted(teams.data, key=lambda x: -float(x['cumulative_xp'] or 0)):
    print(f"  {t['name']:<20} {float(t['cumulative_xp']):>10.2f}")

# Sanity check
print()
remaining = sb.table('rider_xp_daily').select('id', count='exact').gt('remontada_mult', 1).execute()
print(f"  rider_xp_daily with mult > 1: {remaining.count}")
boosts_left = sb.table('remontada_boosts').select('id', count='exact').execute()
print(f"  remontada_boosts remaining: {boosts_left.count}")
trigs_left = sb.table('remontada_boost_triggers').select('league_id', count='exact').execute()
print(f"  remontada_boost_triggers remaining: {trigs_left.count}")
