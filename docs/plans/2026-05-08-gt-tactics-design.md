# GT Tactics — Design Spec

**Date** : 2026-05-08
**Statut** : Spec en cours de validation
**Contexte** : Le GT Mode V1a (squad + rôles + scoring) est implémenté. Les tactiques ajoutent une couche de décisions stratégiques par stage, au-dessus du système de rôles existant.
**Dépendance** : V1a (squad, rôles, classification bonuses, scoring pipeline)
**Scope** : Les 3 Grands Tours (Giro, Tour, Vuelta)

---

## 1. Objectifs

- Donner aux joueurs des **décisions tactiques quotidiennes** pendant les GTs (au-delà du role assignment)
- Introduire du **PvP ciblé** via le mécanisme Nemesis (risque/récompense)
- Permettre aux joueurs en retard de **tenter des coups** sans garantie de succès
- Maintenir une **traçabilité complète** de chaque bonus appliqué

---

## 2. Les 5 tactiques

### 2.1 Unleash (T1)

**Effet** : tous les riders avec le rôle `domestique` dans le GT squad sont traités comme des `stage_hunter` pour ce stage. Leur `gt_role_mult` passe de 1.0 à 1.5.

**Usages** : 2 par GT.

**Détails** :
- Bypass le cap de 2 Stage Hunters pour ce stage uniquement
- Les Stage Hunters existants ne sont pas affectés (restent à ×1.5)
- S'applique uniquement aux résultats de stage (pas aux classifications finales GC/Points/KOM)
- Le rider reste officiellement `domestique` dans `gt_role_assignments` — la tactique override le multiplier pour le scoring de ce stage uniquement

### 2.2 Overdrive (T2)

**Effet** : tous les riders avec le rôle `stage_hunter` dans le GT squad passent de ×1.5 à ×2.0 pour ce stage. Leur `gt_role_mult` passe de 1.5 à 2.0.

**Usages** : 2 par GT.

**Détails** :
- S'applique uniquement aux Stage Hunters déjà assignés (pas aux domestiques)
- S'applique uniquement aux résultats de stage (pas aux classifications finales)
- Compatible avec le cap normal de 2 Stage Hunters max (pas de bypass)

### 2.3 Nemesis GC (T3)

**Effet** : déclarer un duel contre le GC Leader d'une équipe rivale sur un stage précis. Voir §6 pour les mécaniques détaillées.

**Usages** : 1 par GT.

**Résultats possibles** :
| Issue du duel | Attaquant | Cible |
|---|---|---|
| Attaquant gagne | `gt_role_mult` = 2.0 (remplace 1.5) | `nemesis_modifier` = 0.5 |
| Cible gagne | `nemesis_modifier` = 0.75 | `nemesis_modifier` = 1.25 |
| Pas de résultat (DNF/DNS) | Aucun effet | Aucun effet |

### 2.4 Nemesis Sprint (T4)

**Effet** : identique à T3, pour les Sprinters.

**Usages** : 1 par GT.

**Mêmes règles** que T3, appliquées au rôle `sprinter` au lieu de `gc_leader`.

### 2.5 Call the Bus (T5)

**Effet** : les riders du roster qui ne sont PAS dans le GT squad comptent comme domestiques (×1.0) pour ce stage. Élargit l'effectif temporairement.

**Usages** : 3 par GT.

**Effectif supplémentaire selon le level** :

| Level | Roster | GT Squad | Bench | Effectif avec Bus |
|---|---|---|---|---|
| 1 | 6 | 6 | 0 | 6 (pas d'effet) |
| 2 | 7 | 7 | 0 | 7 (pas d'effet) |
| 3 | 8 | 8 | 0 | 8 (pas d'effet) |
| 4 | 9 | 8 | 1 | 9 |
| 5 | 10 | 8 | 2 | 10 |
| 6 | 11 | 8 | 3 | 11 |
| 7-8 | 12 | 8 | 4 | 12 |

**Détails** :
- Les bench riders scorent à `gt_role_mult` = 1.0 (domestique)
- Leurs strategy bonuses s'appliquent normalement
- Aux levels 1-3, la tactique est consommable mais sans effet (0 bench riders)
- Les bench riders ne reçoivent pas de classification bonuses (pas dans le squad)

---

## 3. Contraintes globales

| Règle | Valeur |
|---|---|
| Tactiques par jour | **1 maximum** (les 5 comptent dans le même pool) |
| Cutoff | **11h00 CET** (même cutoff que les rôles) |
| Disponibilité par level | **Toutes dès le level 1** |
| Scope | **Uniquement pendant les GTs actifs** (Giro/Tour/Vuelta) |
| Annulation | Non — une tactique activée est consommée, même si le rider DNF |
| Stacking | Interdit — une seule tactique par stage par équipe |

---

## 4. Data Model

### 4.1 Nouvelle table : `gt_tactic_activations`

```sql
CREATE TABLE gt_tactic_activations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                 UUID NOT NULL REFERENCES teams(id),
  phase_id                INT NOT NULL,
  year                    INT NOT NULL,
  tactic_type             TEXT NOT NULL
    CHECK (tactic_type IN (
      'unleash', 'overdrive', 'call_the_bus',
      'nemesis_gc', 'nemesis_sprint'
    )),
  stage_slug              TEXT NOT NULL,
  -- Nemesis-only fields (all 3 NULL or all 3 NOT NULL)
  attacker_rider_id       UUID REFERENCES riders(id),
  nemesis_target_team_id  UUID REFERENCES teams(id),
  nemesis_target_rider_id UUID REFERENCES riders(id),
  -- Resolution
  outcome                 TEXT CHECK (outcome IN ('attacker_won', 'target_won')),
  resolved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (team_id, phase_id, year, stage_slug)
);

-- Nemesis consistency: all 3 fields set or all 3 NULL
ALTER TABLE gt_tactic_activations ADD CONSTRAINT nemesis_fields_consistent
  CHECK (
    (attacker_rider_id IS NULL AND nemesis_target_team_id IS NULL AND nemesis_target_rider_id IS NULL)
    OR
    (attacker_rider_id IS NOT NULL AND nemesis_target_team_id IS NOT NULL AND nemesis_target_rider_id IS NOT NULL)
  );

-- Usage limits enforced via CHECK on count per (team_id, phase_id, year, tactic_type)
-- Implemented as a BEFORE INSERT trigger rather than a table constraint
```

**RLS** : readable par les membres de la ligue, writable par le team owner.

**Index** : `(team_id, phase_id, year)` pour les queries de comptage d'usages.

### 4.2 Colonnes ajoutées à `rider_xp_daily`

```sql
ALTER TABLE rider_xp_daily
  ADD COLUMN gt_role_mult      NUMERIC(3,1) NOT NULL DEFAULT 1.0,
  ADD COLUMN gt_classif_bonus  INT          NOT NULL DEFAULT 0,
  ADD COLUMN nemesis_modifier  NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN tactic_applied    TEXT;
```

| Colonne | Rôle | Exemples de valeurs |
|---|---|---|
| `gt_role_mult` | Role multiplier effectivement appliqué | 1.0 (domestique), 1.5 (GC/Sprinter/Climber/StageHunter, Unleash), 2.0 (TT sur ITT, Overdrive, Nemesis attaquant gagnant) |
| `gt_classif_bonus` | Points de classification daily (GC/Points/KOM) | 0 à 15 (10 × 1.5 pour GC Leader rank 1) |
| `nemesis_modifier` | Modificateur post-formula Nemesis | 0.5, 0.75, 1.0, 1.25 |
| `tactic_applied` | Quelle tactique a affecté ce rider | 'unleash', 'overdrive', 'nemesis_gc', 'nemesis_sprint', 'call_the_bus', NULL |

**Bénéfice traçabilité** : `gt_role_mult` et `gt_classif_bonus` comblent un gap qui existait AVANT les tactiques. Désormais chaque composant de la formule de scoring GT est stocké et auditable.

---

## 5. Scoring — Formule mise à jour

### 5.1 Formule complète

```
xp_gained = (raw_pcs_points × gt_role_mult × (1 + strategy_bonus) + gt_classif_bonus)
            × remontada_mult
            × nemesis_modifier
```

Tous les termes sont stockés dans `rider_xp_daily`. On peut recalculer `xp_gained` à partir des colonnes pour n'importe quel row.

### 5.2 Effets de chaque tactique sur les composants

**Unleash** — modifie `gt_role_mult` pour les domestiques :
```
Domestique normal :  gt_role_mult = 1.0
Avec Unleash :       gt_role_mult = 1.5  (stage results only, pas /gc)
tactic_applied = 'unleash'
```

**Overdrive** — modifie `gt_role_mult` pour les stage hunters :
```
Stage Hunter normal :  gt_role_mult = 1.5
Avec Overdrive :       gt_role_mult = 2.0  (stage results only, pas /gc)
tactic_applied = 'overdrive'
```

**Nemesis (attaquant gagne)** — modifie `gt_role_mult` pour l'attaquant, `nemesis_modifier` pour la cible :
```
Attaquant : gt_role_mult = 2.0 (remplace 1.5), nemesis_modifier = 1.0
Cible :     gt_role_mult = 1.5 (inchangé),     nemesis_modifier = 0.5
tactic_applied = 'nemesis_gc' ou 'nemesis_sprint' (sur les deux riders)
```

**Nemesis (cible gagne)** — modifie `nemesis_modifier` pour les deux :
```
Attaquant : gt_role_mult = 1.5 (inchangé), nemesis_modifier = 0.75
Cible :     gt_role_mult = 1.5 (inchangé), nemesis_modifier = 1.25
tactic_applied = 'nemesis_gc' ou 'nemesis_sprint' (sur les deux riders)
```

**Call the Bus** — ajoute des rows `rider_xp_daily` pour les bench riders :
```
Bench rider : gt_role_mult = 1.0, nemesis_modifier = 1.0
tactic_applied = 'call_the_bus'
Strategy bonuses appliqués normalement
Pas de gt_classif_bonus (pas dans le squad)
```

---

## 6. Nemesis — Mécaniques détaillées

### 6.1 Éligibilité

Le joueur choisit un leader rival (GC Leader pour T3, Sprinter pour T4) d'une autre équipe **de la même ligue**.

**Condition sur l'XP GT** :
```
target_gt_xp >= attacker_gt_xp
AND target_gt_xp <= attacker_gt_xp × 1.20
```

- `gt_xp` = XP cumulé par le rider **dans ce GT uniquement** (somme des `xp_gained` pour les stages passés de ce GT)
- À l'étape 1 : tout le monde à 0 → `0 >= 0 AND 0 <= 0` → tout le monde est ciblable
- Plus le GT avance, plus les écarts d'XP réduisent le pool de cibles éligibles
- Si aucune cible éligible : la tactique Nemesis n'est pas disponible pour ce stage

### 6.2 Déclaration

**Action unique** : le joueur sélectionne la cible ET le stage en même temps (1 modale, 1 validation).

**Timing** : doit être déclaré **avant 11h00 CET** le jour du stage ciblé. Même cutoff que les rôles.

**Visibilité** : la cible est **immédiatement alertée** (voir §7.5 pour l'UI des alertes).

### 6.3 Résolution du duel

Après l'import des résultats du stage par le scoring pipeline :

1. Chercher les `gt_tactic_activations` de type `nemesis_gc` / `nemesis_sprint` pour ce `stage_slug`
2. Récupérer le classement stage des deux riders dans `race_results`
3. Comparer les positions :
   - `attacker_rank < target_rank` (meilleur classement) → `outcome = 'attacker_won'`
   - `target_rank <= attacker_rank` → `outcome = 'target_won'` (en cas d'égalité, la cible/défenseur gagne — l'attaquant prend le risque)
4. Si l'un des deux riders n'a **pas de résultat** sur ce stage (DNF, DNS, absent) → `outcome = NULL`, aucun modifier appliqué
5. Écrire `outcome` + `resolved_at` dans `gt_tactic_activations`
6. Appliquer les modifiers sur les rows `rider_xp_daily` des deux riders

### 6.4 Règles de cap

- **Max -50%** : si 2 équipes ciblent le même rider et les deux attaquants gagnent, le rider cible prend `nemesis_modifier = 0.5` une seule fois (pas 0.25)
- **Chaque attaquant** est traité indépendamment : les deux peuvent recevoir `gt_role_mult = 2.0`
- **Floor à 0** : `nemesis_modifier` ne peut jamais produire un `xp_gained` négatif. Plancher appliqué après la formule complète.

---

## 7. UI & Activation Flow

### 7.1 Placement dans la page GT Team

Structure de la page GT Team (de haut en bas) :
```
┌─────────────────────────────────┐
│  Sponsor Goals card             │
├─────────────────────────────────┤
│  🆕 Team Tactics section        │  ← NOUVEAU
├─────────────────────────────────┤
│  Team Composition (par rôle)    │
└─────────────────────────────────┘
```

La section Team Tactics est **entre** le sponsor card et la composition d'équipe.

### 7.2 Tactic cards

Chaque tactique est une **mini-card** affichant :
- **Nom** de la tactique
- **Icône** (à définir)
- **Compteur d'usages restants** : "2/2", "1/1", "3/3" → décompte à chaque utilisation
- **État** : disponible / épuisé / actif aujourd'hui
- Si épuisé : card grisée, compteur "0/2"
- Si actif aujourd'hui : badge visuel distinctif (accent color)

**Layout** : row horizontale scrollable (mobile) ou grid 2×3 (desktop). 5 cards compactes.

**Interaction** : tap sur une card disponible → ouvre la modale d'activation.

### 7.3 Modale d'activation (T1, T2, T5)

Pour les tactiques boost (Unleash, Overdrive, Call the Bus) :

```
┌────────────────────────────────┐
│  [Nom de la tactique]          │
│                                │
│  [Description courte]          │
│                                │
│  Select stage:                 │
│  ┌──────────────────────────┐  │
│  │  Mini-calendrier GT      │  │
│  │  (stages restantes)      │  │
│  └──────────────────────────┘  │
│                                │
│  Remaining uses: 2/2           │
│                                │
│  [Cancel]         [Activate]   │
└────────────────────────────────┘
```

- Le calendrier affiche uniquement les stages **à venir** (pas les stages passés)
- Les stages où une tactique est déjà activée sont marquées (non-sélectionnables)
- Bouton "Activate" = confirmation définitive, usage consommé

### 7.4 Modale Nemesis (T3, T4)

Deux étapes dans la même modale :

**Étape 1 — Sélection de la cible** :
```
┌────────────────────────────────┐
│  Nemesis GC                    │
│                                │
│  Your GC Leader: [Rider Name]  │
│  GT XP: 245                    │
│                                │
│  Eligible targets:             │
│  ┌──────────────────────────┐  │
│  │ ○ [Rival A] — 260 XP    │  │
│  │ ○ [Rival B] — 290 XP    │  │
│  └──────────────────────────┘  │
│                                │
│  No eligible targets? The      │
│  tactic is unavailable.        │
│                                │
│         [Next →]               │
└────────────────────────────────┘
```

**Étape 2 — Sélection du stage** :
```
┌────────────────────────────────┐
│  Nemesis GC → [Rival A]       │
│                                │
│  Select stage:                 │
│  ┌──────────────────────────┐  │
│  │  Mini-calendrier GT      │  │
│  └──────────────────────────┘  │
│                                │
│  ⚠️ Risk: if [Rival A] beats  │
│  you, you lose 25% and they   │
│  gain 25%.                     │
│                                │
│  [Cancel]         [Declare]    │
└────────────────────────────────┘
```

- Avertissement clair sur le risque (l'attaquant prend un risque)
- Si le joueur n'a pas de GC Leader / Sprinter assigné, la card est disabled avec un message "Assign a [role] first"
- Si aucune cible éligible (personne dans la fourchette 0-20% XP), la card affiche "No eligible rival"

### 7.5 Alertes Nemesis

Quand un joueur est ciblé :

**Banner sur la page GT Team** (persistant tant que le stage n'est pas résolu) :
```
⚔️ [Player X] has declared a GC Nemesis challenge against [your GC Leader]
Target stage: Stage 12 — [date]
If they beat you: they get ×2, you lose 50%. If you beat them: you gain 25%, they lose 25%.
```

**Message sur la Home page** :
```
⚔️ Nemesis alert — [Player X] is targeting your GC Leader on Stage 12
```

**Après résolution** (résultats du stage importés) :
- Banner mis à jour avec le résultat : "You won the duel!" ou "You lost the duel"
- Visible pendant 24h après résolution, puis disparaît

---

## 8. Traçabilité & Audit

### Audit trail complet

Chaque `rider_xp_daily` row contient tous les composants de la formule :

| Composant | Colonne | Toujours stocké ? |
|---|---|---|
| Points PCS bruts | `raw_pcs_points` | ✅ (existant) |
| Role multiplier effectif | `gt_role_mult` | ✅ (nouveau) |
| Strategy bonus agrégé | `strategy_bonus` | ✅ (existant) |
| Classification bonus | `gt_classif_bonus` | ✅ (nouveau) |
| Remontada multiplier | `remontada_mult` | ✅ (existant) |
| Nemesis modifier | `nemesis_modifier` | ✅ (nouveau) |
| Tactique active | `tactic_applied` | ✅ (nouveau) |
| XP final | `xp_gained` | ✅ (existant) |

**Vérification** : pour n'importe quel row, on peut valider :
```
xp_gained == round(
  (raw_pcs_points × gt_role_mult × (1 + strategy_bonus) + gt_classif_bonus)
  × remontada_mult × nemesis_modifier
)
```

**Contexte tactic** : joindre `rider_xp_daily.tactic_applied` + `gt_tactic_activations` (via team_id + stage_slug) pour retrouver la déclaration complète (cible, outcome, etc.).

---

## 9. Rule Change : GT Squad flexible

**Changement indépendant des tactiques, mais prérequis pour Call the Bus.**

**Règle actuelle** : le GT squad est auto-rempli au début du GT avec les 8 meilleurs riders par PCS points. Les rôles sont modifiables mais pas la composition du squad.

**Nouvelle règle** : le joueur peut **swapper des riders in/out du GT squad à tout moment** pendant le GT, dans la limite de 8 riders max. Même cutoff 11h00 CET que les rôles.

**Impacts** :
- `gt_squad` table : les inserts/deletes sont autorisés pendant le GT (pas seulement à l'init)
- Un rider swappé out perd son rôle (reset à domestique s'il revient)
- Un rider swappé in est domestique par défaut
- Call the Bus utilise la composition du squad **au moment du cutoff** pour déterminer les bench riders

---

## 10. Dépendances

| Dépendance | Statut | Impact |
|---|---|---|
| GT Mode V1a (squad, rôles, scoring) | ✅ Implémenté | Base sur laquelle les tactiques se greffent |
| `race_results` avec classement stage | ✅ Existant | Nécessaire pour la résolution Nemesis |
| `gt_daily_classifications` | ✅ Implémenté | Classification bonuses tracées dans `gt_classif_bonus` |
| `rider_xp_daily` | ✅ Existant | 4 colonnes ajoutées |
| Scoring pipeline (`scoring.py`) | ✅ Existant | Doit lire `gt_tactic_activations` et appliquer les modifiers |
| GT Squad flexible (§9) | 🆕 À implémenter | Prérequis pour Call the Bus |
| Noms finaux des tactiques | ❌ À décider | Noms de travail utilisés dans ce doc |
| Icônes des tactic cards | ❌ À décider | Design system à étendre |

---

## 11. Edge Cases

| Cas | Résolution |
|---|---|
| Attaquant ou cible DNF/DNS sur le stage | `outcome = NULL`, aucun modifier, usage consommé |
| Les deux riders scorent 0 PCS points mais ont un classement stage | Duel résolu normalement par le rank. Les modifiers s'appliquent mais 0 × mult = 0 sur le composant PCS (les classification bonuses sont quand même affectées) |
| 2 équipes déclarent Nemesis sur le même rider | Cap -50% pour la cible (pas de stacking). Chaque attaquant traité indépendamment |
| Call the Bus au level 1-3 | 0 bench riders → tactic consommée sans effet |
| Joueur n'a pas de GC Leader / Sprinter assigné | Nemesis GC / Sprint card disabled, message "Assign a [role] first" |
| Aucune cible éligible pour Nemesis | Card disabled, message "No eligible rival" |
| Joueur active une tactique après 11h00 CET | S'applique au stage du lendemain (même règle que les rôles) |
| Stage non couru (annulé, neutralisé) | Pas de résultats → aucun modifier, usage consommé |
| Nemesis déclaré mais adversaire swappé hors du squad avant le stage | Le rider est toujours dans `race_results` s'il court → duel résolu normalement. S'il ne court pas → DNF rule |
| Unleash quand il n'y a aucun domestique (tous ont des rôles spécialistes) | Tactic consommée sans effet (aucun rider eligible) |
| Overdrive quand il n'y a aucun Stage Hunter | Tactic consommée sans effet |

---

## 12. Noms des tactiques (à décider)

| Working name | Propositions | Notes |
|---|---|---|
| Unleash | "Unleash", "All-Out", "Charge" | Les domestiques lâchés dans la nature |
| Overdrive | "Overdrive", "Full Gas", "Breakaway Boost" | Stage Hunters survoltés |
| Nemesis GC | "GC Rivalry", "GC Duel", "GC Nemesis" | Duel entre leaders |
| Nemesis Sprint | "Sprint Rivalry", "Sprint Duel", "Sprint Nemesis" | Duel entre sprinters |
| Call the Bus | "Call the Bus", "Reinforcements", "Bus Call" | Les réservistes en renfort |

La décision sur les noms finaux est **hors scope** de ce doc — à décider avant l'implémentation UI.
