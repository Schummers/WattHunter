# Refonte Équilibrage — Index & contexte partagé

> 2026-06-02 · Handoff maître. Les détails vivent dans `docs/superpowers/specs/2026-06-01-spec-{a,b,c}-*.md` et le journal `~/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/sessions/2026-05-31.md`.

## Pourquoi cette refonte

À la fin du Giro 2026 les écarts d'XP/argent explosent et le jeu perd son intérêt pour le peloton. But : **compresser l'écart sans tuer l'intérêt**. Découpé en 3 specs :
- **Spec A — Levels & Rôles & Scoring** : ralentir le leader (levels longs) + corriger les sur-boosts (GC final, rôles). **COMPLET.**
- **Spec B — Underdog** : faire remonter les faibles (rôle underdog + boost rang-absolu + squad élargi + réduc salaire). **Design quasi complet, reste l'UI.**
- **Spec C — Bonus & Sponsors** : économie 2-valeurs (1-sem | GT/Monument), goals par archétype. **~90%, 3 opens.**
- **UI** (transverse) : sponsor card 2 colonnes + affichage prix barré underdog. **À maquetter (HTML).**

## Données réelles de référence (ligue test)

- Ligue **"Classiques de l'individualisme"** (`league_id` préfixe `adaec367`), 8 équipes, non-démo.
- Standings projetés fin Giro (post GC final, sans mult) : Klimax 2607, Leopard 2559, AussieMate 1936, Goudal 1764, Peejee 1508, Dixon 1487, Muscat 1119, bigdaddy 961.
- Sponsors équipes : Leopard/Klimax/AussieMate=Decathlon, Peejee=Lidl-Trek, etc. (table `team_sponsors`).

## Outillage d'analyse (lecture seule, reproductible)

- **Le MCP Supabase ne s'est pas chargé** dans la session d'origine → on a requêté via le client Python de `services/pcs-sync` :
  ```bash
  cd services/pcs-sync
  .venv/bin/python  # avec dotenv load_dotenv(".env"), SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  ```
  Scripts jetables dans `/tmp/wh_*.py`. **Toujours filtrer `race_results` sur la colonne `stage` en `eq` (PAS `like("stage-2%")` qui aspire stage-20/21).**
- **Scrape PCS dry-run** (sans écriture DB) : `PYTHONPATH=. .venv/bin/python` avec `BrowserSession(headless=False)` + `fetch_html` + `Stage(...)`. Fenêtre Chrome visible, warm-up Cloudflare. Dump du stage 21 final : `/tmp/stage21.json` (peut être périmé — re-scraper si besoin).
- **Faits PCS validés** : GC final = points PCS 400/290/240… ; Points/KOM finals = 80/20/10 (top 3) ; Youth final = 0 (pas de points PCS) ; `breakaway_kms` exposé par la lib ; combativité NON exploitable pour le Giro (page renvoie le GC).

## Règles du projet à respecter

- CLAUDE.md Rule #1 (design system avant tout front), Rule #2 (migrations only), Rule #3 (ARCHITECTURE.md + MEMORY.md), pattern server action (Zod → rpc → forward), RLS jamais bypassé, app en anglais.
- Les specs sont des **drafts non committés**. Aucune écriture prod n'a été faite pendant le design.

## Comment continuer

Ouvre une discussion par spec. Colle le **prompt** fourni en bas de chaque handoff :
- `2026-06-02-spec-a-levels-roles-handoff.md`
- `2026-06-02-spec-b-underdog-handoff.md`
- `2026-06-02-spec-c-bonus-economy-handoff.md`
- `2026-06-02-ui-mockups-handoff.md`

Une fois chaque spec finalisé → `superpowers:writing-plans` pour le plan d'implémentation, puis exécution.
