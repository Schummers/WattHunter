# Audit Playbook v2 — leçons du run 2026-06-11

> Mode d'emploi pour le prochain audit orchestré. Basé sur les données réelles du premier run complet
> (run `wf_c9612001-650`, REPORT dans `review/runs/2026-06-11/`, verdicts dans `FIX_LOG.md`).
> Le script : `.claude/workflows/wh-audit.js`. Le contexte injecté : `review/WH_CONTEXT.md`.

---

## 1. Bilan chiffré du run v1 (référence)

| Métrique | Valeur |
|---|---|
| Cellules (surfaces × axes) | 45 |
| Agents totaux | ~185 (45 review + ~140 verify échoués + synthèse) |
| Tokens subagents | ~7,05 M |
| Durée | ~45 min |
| Findings bruts | 394 (P0: 33, P1: 137, P2: 224) |
| P0 contre-vérifiés à la main | ~14 familles → **2 faux positifs** (~85 % de précision) |
| Valeur réelle extraite | 5 trous RLS exploitables + 17 fetches non paginés + 1 bug temporel |
| Partie du rapport jamais lue | les 224 P2 (~60 % du volume) |

**Conclusion** : rentable, mais ~la moitié des tokens a produit du volume non lu (P2) ou des
verify échoués. Le run v2 doit produire la même valeur pour ~40 % du coût.

---

## 2. Où était la valeur (donnée empirique, pas intuition)

Tous les P0 confirmés appartiennent à **3 classes de bugs** :

1. **RLS / escalade de privilège** (axe security, surface D1) — policies trop larges, RPC sans
   REVOKE, colonnes non protégées par trigger.
2. **Pagination PostgREST 1000-rows + atomicité** (axe data) — fetches GT-wide non paginés,
   read-modify-write treasury non atomique.
3. **Idempotence pipeline / règles métier** (axe business-rules) — payouts non idempotents,
   fenêtres temporelles squad, no-cumul.

Les axes **performance** et **techdebt** ont aussi "trouvé" des P0… mais c'étaient les **mêmes bugs
de pagination** déjà flaggés par l'axe data (ex. `scoring.py` pagination flaggé 4× : PERF-01, B1-01,
DATA-02, TD-01). Redondance = coût de dédup en synthèse, pas de valeur additionnelle.

Les axes **frontend-ds** et **architecture** ont produit 0 P0 propre (uniquement P1/P2 cosmétiques :
tokens DS, duplication de helpers). Utile pour un backlog qualité, pas pour un audit de risque.

---

## 3. Config recommandée pour le run v2

### Matrice réduite : 3 axes × surfaces à risque ≈ 22 cellules (vs 45)

Garder uniquement `security`, `data`, `business-rules`. Lancer avec :

```
Workflow({
  scriptPath: ".claude/workflows/wh-audit.js",
  args: { "date": "<YYYY-MM-DD>", "axes": ["security", "data", "business-rules"] }
})
```

(le script supporte aussi `"only": ["B1-scoring", ...]` pour filtrer les surfaces, et
`"skip_verify": true` en secours.)

Surfaces à dropper entièrement si on veut serrer encore : `F7-lib-ds` (aucun P0, que du cosmétique).

### Verify : uniquement les P0, en panel de 2

- v1 vérifiait P0 **et** P1 → ~140 agents verify (et tous ont échoué, voir §5). Les P1 sont assez
  nombreux et assez cheap à trier à la main lors du fix — le verify automatique n'y est pas rentable.
- v2 : verify **P0 seulement** (~30 agents), 2 votes indépendants par finding, finding tué si les
  2 réfutent. Les P1/P2 passent directs en annexe avec un tag `UNVERIFIED`.
- Le prompt verify DOIT contenir la phrase exacte :
  `YOU MUST call the StructuredOutput tool with fields: real (boolean) and reason (string).`
  (sans elle, les reviewers read-only terminent en texte libre et le schema-enforcement échoue).

### Présentation : P0 vérifiés d'abord, le reste en annexe

- REPORT.md v2 : Top 10 = uniquement des P0 **vérifiés**. Table globale limitée à P0+P1.
- Les P2 vont dans `findings/` (annexes par surface) et ne sont PAS synthétisés dans le rapport —
  c'est le volume que personne ne lit.

### Budget attendu v2

~22 cellules review + ~30 verify + synthèse ≈ **2,5–3 M tokens** (vs 7 M), pour la même couverture
des 3 classes de bugs qui ont produit 100 % des P0 réels.

---

## 4. Quand utiliser quoi (arbre de décision)

| Besoin | Outil |
|---|---|
| Gate avant merge d'une branche/PR | `/code-review` classique (lit le diff, pas la codebase) |
| Audit de risque périodique (trimestriel, avant alpha/release) | Ce workflow, config §3 |
| "Est-ce que la classe de bug X existe ailleurs ?" (ex. après un incident) | 1 seule cellule ciblée : `args: { only: [surface], axes: [axe] }` |
| Backlog qualité front / dette | Run séparé axes `frontend-ds` + `techdebt`, modèle sonnet, sans verify |
| Nettoyage / suppression de code | `SIMPLIFY.md` du dernier run + tests de caractérisation d'abord |

**Mode différentiel** (idée pour v3, non implémenté) : ne passer en review que les surfaces touchées
depuis le dernier run (`git diff --stat <dernier-run-tag>`) + toujours D1-schema-rls (les migrations
s'accumulent). Réduirait un run de routine à ~8 cellules.

---

## 5. Pièges techniques rencontrés (à ne pas re-payer)

1. **Verify sans instruction StructuredOutput explicite** → 100 % d'échec silencieux
   (`subagent completed without calling StructuredOutput`). Tous les tokens verify de v1 perdus.
   Fix : phrase impérative dans le prompt (déjà dans le script).
2. **Synthèse avec JSON géant inline** → l'agent de synthèse n'écrit rien, échec silencieux,
   on découvre à la fin qu'il n'y a que `map.md`. Fix (déjà dans le script) : staging des findings
   sur disque + annexes écrites par surface en parallèle + REPORT qui lit les annexes.
3. **`Workflow({name: "wh-audit"})` ne résout pas le script local** → utiliser
   `scriptPath: ".claude/workflows/wh-audit.js"`.
4. **`resumeFromRunId` fonctionne et a sauvé le run** : les 45 cellules review ont été rejouées
   depuis le cache après 2 éditions du script. Toujours noter le run ID au lancement. Stopper le
   task en cours (`TaskStop`) avant de relancer en resume.
5. **`args.date`** : passer la date explicitement, sinon l'output va dans `review/runs/undated/`.
6. **Pause = stop propre** : si le run coûte trop, `TaskStop` + resume plus tard ne perd que la
   phase en cours, pas les cellules terminées.

---

## 6. Contre-vérification humaine (l'étape qui a justifié le run)

Le rapport brut ne suffit pas : 2 des P0 "sûrs" étaient des faux positifs détectables uniquement en
lisant au-delà du fichier cité (le RPC vérifiait l'ownership ; un comportement était documenté
by-design dans un ADR). Process qui a marché, à refaire :

1. Lire chaque P0 dans le code réel (pas le résumé du rapport).
2. Verdict en 3 catégories : **FIXÉ** / **FAUX POSITIF** / **RÉEL mais DIFFÉRÉ** (avec raison).
3. Tout consigner dans `review/runs/<date>/FIX_LOG.md`.
4. Les fixes RLS/treasury passent par migration + rollback `.down.sql` + `pytest` avant/après.

Les reviewers ne voient qu'un périmètre de fichiers : un finding "il manque un check" doit toujours
être confronté au RPC/trigger/ADR correspondant avant d'être cru.
