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

**Effet** : déclarer un duel contre une équipe rivale sur un stage précis. Le duel oppose les **GC Leaders des deux équipes au moment du cutoff 11h CET**. Voir §6 pour les mécaniques détaillées.

**Cible = équipe + rôle, pas un rider spécifique.** Si Team B change son GC Leader avant cutoff, le nouveau leader devient la cible. Idem pour l'attaquant.

**Usages** : 1 par GT.

**Résultats possibles** (l'absence de valeur indique le défaut : `gt_role_mult` = 1.5 pour le rôle, `nemesis_modifier` = 1.0) :
| Issue du duel | Attaquant | Cible |
|---|---|---|
| Attaquant gagne | `gt_role_mult` = 2.0 (remplace 1.5), `nemesis_modifier` = 1.0 | `gt_role_mult` = 1.5 (inchangé), `nemesis_modifier` = 0.5 |
| Cible gagne | `gt_role_mult` = 1.5 (inchangé), `nemesis_modifier` = 0.75 | `gt_role_mult` = 1.5 (inchangé), `nemesis_modifier` = 1.25 |
| Pas de résultat (DNF/DNS) ou rôle non assigné | Aucun effet, modifier = 1.0 | Aucun effet, modifier = 1.0 |

### 2.4 Nemesis Sprint (T4)

**Effet** : identique à T3, pour les Sprinters. Le duel oppose les **Sprinters des deux équipes au cutoff 11h CET**, basé sur le classement de stage.

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
  -- Nemesis-only fields (both NULL or both NOT NULL)
  nemesis_target_team_id  UUID REFERENCES teams(id),
  nemesis_target_role     TEXT CHECK (nemesis_target_role IN ('gc_leader', 'sprinter')),
  -- Resolution snapshot (filled by scoring pipeline)
  resolved_attacker_rider_id  UUID REFERENCES riders(id),
  resolved_target_rider_id    UUID REFERENCES riders(id),
  outcome                 TEXT CHECK (outcome IN ('attacker_won', 'target_won', 'no_resolution')),
  resolved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (team_id, phase_id, year, stage_slug)
);

-- Nemesis consistency: both fields set or both NULL
ALTER TABLE gt_tactic_activations ADD CONSTRAINT nemesis_fields_consistent
  CHECK (
    (nemesis_target_team_id IS NULL AND nemesis_target_role IS NULL)
    OR
    (nemesis_target_team_id IS NOT NULL AND nemesis_target_role IS NOT NULL)
  );

-- Tactic-type matches role: nemesis_gc → 'gc_leader', nemesis_sprint → 'sprinter'
ALTER TABLE gt_tactic_activations ADD CONSTRAINT nemesis_role_matches_type
  CHECK (
    (tactic_type = 'nemesis_gc' AND nemesis_target_role = 'gc_leader')
    OR (tactic_type = 'nemesis_sprint' AND nemesis_target_role = 'sprinter')
    OR (tactic_type NOT IN ('nemesis_gc', 'nemesis_sprint') AND nemesis_target_role IS NULL)
  );

-- Usage limits enforced via BEFORE INSERT trigger counting existing rows
-- per (team_id, phase_id, year, tactic_type)
```

**Note** : `resolved_attacker_rider_id` et `resolved_target_rider_id` sont remplis par le pipeline au moment de la résolution (snapshot des role-holders au cutoff). Permet l'audit "qui a combattu qui" sans avoir à recalculer depuis `gt_role_assignments`.

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

**Nemesis (attaquant gagne)** — modifie `gt_role_mult` pour l'attaquant, `nemesis_modifier` pour la cible. Identification des riders affectés via `resolved_attacker_rider_id` et `resolved_target_rider_id` (snapshot des role-holders au cutoff) :
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

**Nemesis (no_resolution)** — au moins un des deux rôles non assigné au cutoff, ou DNF/DNS :
```
Aucun modifier appliqué. Usage consommé pour l'attaquant.
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

Le joueur choisit une **équipe rivale** (pas un rider) dans la même ligue.

**Condition sur l'XP GT** :
```
target_gt_xp >= attacker_gt_xp
```

- `gt_xp` = XP cumulé par le **rider qui tient le rôle** (GC Leader / Sprinter) **dans ce GT uniquement**
- Calculé au moment de la déclaration sur la base du role-holder actuel de l'équipe cible
- À l'étape 1 : tout le monde à 0 → `0 >= 0` → tout le monde est ciblable
- Plus le GT avance, plus le pool de cibles se réduit naturellement (les leaders ont plus d'XP)
- Si aucune cible éligible (toutes les autres équipes ont moins de GT XP) : la tactique Nemesis n'est pas disponible

### 6.2 Déclaration

**Action unique** : le joueur sélectionne l'équipe cible ET le stage en même temps (1 modale, 1 validation).

**Cible = (team_id, role)**, pas un rider spécifique. Le rôle est implicite (GC Leader pour `nemesis_gc`, Sprinter pour `nemesis_sprint`).

**Affichage à la déclaration** : la modale montre le **role-holder actuel** de l'équipe cible pour donner du contexte (ex: "Team B's GC Leader: Pogačar — 245 GT XP"). Cette info est indicative — le duel se résout avec quiconque tient le rôle au cutoff.

**Timing** : doit être déclaré **avant 11h00 CET** le jour du stage ciblé. Même cutoff que les rôles.

**Visibilité** : la cible est **immédiatement alertée** (voir §7.5 pour l'UI des alertes).

### 6.3 Résolution du duel

Après l'import des résultats du stage par le scoring pipeline :

1. Chercher les `gt_tactic_activations` de type `nemesis_gc` / `nemesis_sprint` pour ce `stage_slug`
2. **Snapshot des role-holders au cutoff 11h CET du stage** :
   - `attacker_rider_id` = rider qui tient le rôle (gc_leader/sprinter) dans `team_id` au cutoff
   - `target_rider_id` = rider qui tient le rôle dans `nemesis_target_team_id` au cutoff
   - Stocker les deux dans `resolved_attacker_rider_id` et `resolved_target_rider_id`
3. Si l'un des deux rôles n'est **pas assigné** au cutoff → `outcome = 'no_resolution'`, aucun modifier appliqué
4. Récupérer le classement stage des deux riders dans `race_results`
5. Comparer les positions :
   - `attacker_rank < target_rank` (meilleur classement) → `outcome = 'attacker_won'`
   - `target_rank <= attacker_rank` → `outcome = 'target_won'` (en cas d'égalité, la cible/défenseur gagne — l'attaquant prend le risque)
6. Si l'un des deux riders n'a **pas de résultat** sur ce stage (DNF, DNS, absent) → `outcome = 'no_resolution'`, aucun modifier appliqué
7. Écrire `outcome` + `resolved_at` dans `gt_tactic_activations`
8. Appliquer les modifiers sur les rows `rider_xp_daily` des deux riders

**Race condition au cutoff** : si le rôle est modifié à 10h59:45 et le Nemesis déclaré à 10h59:30, les deux actions sont valides (avant cutoff). Le duel se résout avec le NOUVEAU role-holder. Pas un bug — c'est le comportement attendu du modèle role-based.

### 6.4 Règles de cap

- **Max -50%** : si 2 équipes ciblent le même rider et les deux attaquants gagnent, le rider cible prend `nemesis_modifier = 0.5` une seule fois (pas 0.25)
- **Chaque attaquant** est traité indépendamment : les deux peuvent recevoir `gt_role_mult = 2.0`
- **Floor à 0** : `nemesis_modifier` ne peut jamais produire un `xp_gained` négatif. Plancher appliqué après la formule complète.
- **Pas de cap entre Nemesis et autres mécaniques** : Nemesis × Remontada se cumulent. Une cible avec Remontada actif (×2.0) qui perd un duel Nemesis (×0.5) finit avec un net effet ×1.0 (annulation) — c'est volontaire, les deux mécaniques s'auto-équilibrent quand elles se croisent. Un attaquant avec Remontada qui gagne un duel a un swing massif (×2.0 role × ×2.0 remontada = ×4.0 sur PCS) — accepté comme rare et impactful.

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

**Étape 1 — Sélection de l'équipe rivale** :
```
┌────────────────────────────────┐
│  Nemesis GC                    │
│                                │
│  Your GC Leader: [Rider Name]  │
│  GT XP: 245                    │
│                                │
│  Eligible rival teams:         │
│  ┌──────────────────────────┐  │
│  │ ○ Team Alpha             │  │
│  │   GC Leader: Pogačar     │  │
│  │   Team GT XP: 320        │  │
│  ├──────────────────────────┤  │
│  │ ○ Team Bravo             │  │
│  │   GC Leader: Vingegaard  │  │
│  │   Team GT XP: 410        │  │
│  └──────────────────────────┘  │
│                                │
│  Note: the duel resolves with  │
│  the leaders at cutoff time.   │
│                                │
│         [Next →]               │
└────────────────────────────────┘
```

**Étape 2 — Sélection du stage** :
```
┌────────────────────────────────┐
│  Nemesis GC → Team Alpha      │
│                                │
│  Select stage:                 │
│  ┌──────────────────────────┐  │
│  │  Mini-calendrier GT      │  │
│  └──────────────────────────┘  │
│                                │
│  ⚠️ Risk: if Team Alpha beats │
│  you, you lose 25% and they   │
│  gain 25%.                     │
│                                │
│  [Cancel]         [Declare]    │
└────────────────────────────────┘
```

- Avertissement clair sur le risque (l'attaquant prend un risque)
- Si le joueur n'a pas de GC Leader / Sprinter assigné dans son squad, la card est disabled avec un message "Assign a [role] first"
- Si une équipe rivale n'a pas de role-holder au moment de la déclaration, elle apparaît avec un état "No leader assigned" et est non-sélectionnable
- Si aucune équipe rivale n'a un GT XP >= au tien, la card affiche "No eligible rival"

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
| Attaquant ou cible DNF/DNS sur le stage | `outcome = 'no_resolution'`, aucun modifier, usage consommé |
| Les deux riders scorent 0 PCS points mais ont un classement stage | Duel résolu normalement par le rank. Les modifiers s'appliquent mais 0 × mult = 0 sur le composant PCS (les classification bonuses sont quand même affectées) |
| 2 équipes déclarent Nemesis sur la même équipe / même rôle | Cap -50% pour la cible (pas de stacking). Chaque attaquant traité indépendamment |
| Call the Bus au level 1-3 | 0 bench riders → tactic consommée sans effet |
| Joueur n'a pas de GC Leader / Sprinter dans son squad | Nemesis GC / Sprint card disabled, message "Assign a [role] first" |
| Aucune équipe rivale éligible pour Nemesis (toutes ont moins de GT XP) | Card disabled, message "No eligible rival" |
| Au cutoff, l'équipe cible n'a plus de role-holder assigné | `outcome = 'no_resolution'`, usage consommé. Counter-strategy légitime mais coûteuse pour la cible (perd le ×1.5 du rôle sur ce stage) |
| Au cutoff, l'attaquant n'a plus de role-holder assigné | Idem : `outcome = 'no_resolution'`, usage consommé |
| Squad swap : le role-holder est swappé hors du squad avant cutoff | Identique au cas "rôle non assigné" — `outcome = 'no_resolution'`. Le coût pour la cible est élevé (perte totale du scoring du rider sur ce stage), donc cette dodge est rarement rationnelle sauf si le rider n'allait pas beaucoup scorer (ex. GC Leader sur sprint plat) |
| Joueur active une tactique après 11h00 CET | S'applique au stage du lendemain (même règle que les rôles) |
| Stage non couru (annulé, neutralisé) | Pas de résultats → aucun modifier, usage consommé. **À revoir post-MVP** : refund possible pour stages officiellement annulés |
| Race condition au cutoff (rôle changé seconde avant 11h CET) | Le duel utilise le role-holder au cutoff exact (11h00:00 CET). Pas un bug, comportement attendu du modèle role-based |
| Remontada Boost actif sur la cible qui perd un duel Nemesis | Modifiers cumulés : ×2.0 (remontada) × 0.5 (nemesis) = ×1.0. La cible ne perd ni ne gagne — annulation volontaire des 2 mécaniques quand elles se croisent |
| Remontada Boost actif sur l'attaquant qui gagne un duel Nemesis | Modifiers cumulés : gt_role_mult ×2.0 + remontada ×2.0. Swing massif accepté (rare conjonction) |
| Unleash quand il n'y a aucun domestique (tous ont des rôles spécialistes) | Tactic consommée sans effet (aucun rider eligible) |
| Overdrive quand il n'y a aucun Stage Hunter | Tactic consommée sans effet |
| Bench rider hors startlist du GT | Pas de race_results → pas de scoring. C'est au joueur de bien gérer son squad |

---

## 12. Déploiement & timing

**Contrainte critique** : le Giro 2026 démarre **2026-05-08** (aujourd'hui). Pour que les colonnes de traçabilité (`gt_role_mult`, `gt_classif_bonus`, `nemesis_modifier`, `tactic_applied`) soient correctement remplies dès le stage 1, le déploiement doit se faire **avant le scoring du stage 1**.

**Conséquences si déploiement après stage 1** :
- Les rows `rider_xp_daily` du stage 1 auraient les defaults (1.0, 0, 1.0, NULL) — incorrects pour la décomposition
- `xp_gained` reste correct (déjà calculé), mais l'audit de la formule est perdu pour ce stage
- Solution : backfill par recalcul depuis `gt_role_assignments` + `gt_daily_classifications`

**Recommandation** : viser le déploiement aujourd'hui avant le 1er stage. Si impossible, prévoir un script de backfill dans le plan d'implémentation.

**Deadline réaliste** : sachant que ce spec n'est validé qu'aujourd'hui, l'implémentation tactiques + UI ne sera pas prête pour le Giro. Le scope minimum déployable avant Giro stage 1 est **uniquement les colonnes de traçabilité** (sans la table `gt_tactic_activations` ni l'UI). Cela permet au moins de capturer la décomposition des points pendant le Giro, et les tactiques peuvent ship plus tard pour le Tour ou la Vuelta.

---

## 13. Noms des tactiques (à décider)

| Working name | Propositions | Notes |
|---|---|---|
| Unleash | "Unleash", "All-Out", "Charge" | Les domestiques lâchés dans la nature |
| Overdrive | "Overdrive", "Full Gas", "Breakaway Boost" | Stage Hunters survoltés |
| Nemesis GC | "GC Rivalry", "GC Duel", "GC Nemesis" | Duel entre leaders |
| Nemesis Sprint | "Sprint Rivalry", "Sprint Duel", "Sprint Nemesis" | Duel entre sprinters |
| Call the Bus | "Call the Bus", "Reinforcements", "Bus Call" | Les réservistes en renfort |

La décision sur les noms finaux est **hors scope** de ce doc — à décider avant l'implémentation UI.
