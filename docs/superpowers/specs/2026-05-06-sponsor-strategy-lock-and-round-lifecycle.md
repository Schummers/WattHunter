# Sponsor/Strategy Lock Window + Round Lifecycle

**Date:** 2026-05-06
**Status:** Approved for implementation

---

## Objectif

Permettre aux joueurs de changer de sponsor et de stratégie pendant toute la fenêtre d'enchères (Rounds 1, 2 et 3), et non plus uniquement pendant le Round 1.

Le changement est immédiat (effet sur la phase en cours) pendant un round ouvert. Une fois la fenêtre d'enchères fermée (plus aucun round `open`), tout changement passe en `pending` et s'applique à la phase suivante via `confirm_phase_setup`.

Tous les changements structurels de cycle de vie des rounds décrits ci-dessous sont des prérequis techniques pour que cette règle de jeu fonctionne correctement.

---

## Contexte — état actuel

### Règle de lock actuelle (à changer)

Dans `budget/actions.ts` et `team/strategies/actions.ts`, la condition est :

```typescript
const isImmediate = openAuction?.name === "Round 1";
```

Résultat : seul Round 1 permet un changement immédiat. Rounds 2 et 3 créent un état `pending` inutilement.

### Cycle de vie des rounds (actuel — manuel)

- `createNextPhaseAuctions` crée Round 1 avec `status = 'open'` immédiatement, Round 2-3 avec `status = 'scheduled'`.
- Aucun mécanisme ne fait passer Round 2 ou 3 de `scheduled` à `open`.
- `validate_round` convertit les draft_bids en auction_bids mais ne touche pas les statuts.
- Les transitions de statut sont gérées manuellement (dashboard Supabase).

### Dates dans l'UI (actuel — incohérent)

- La page rounds affiche pour chaque round sa date `opens_at` (heure de début).
- Un champ "Closes at" séparé n'existe que pour le dernier round.
- La sémantique attendue par le commissaire est l'inverse : il saisit des **heures de fermeture** pour chaque round.
- `setRoundDates` dans `market/actions.ts` écrase `opens_at` ET `closes_at`, ce qui peut corrompre l'heure d'ouverture du Round 1.
- Le RPC `place_bid` vérifie `closes_at < now()` et rejette les bids après la date affichée, même si le round est encore `open`. Comportement non désiré.

---

## Design

### 1. Nouvelle règle de lock — sponsor et stratégie

**Condition :**

```typescript
// Avant
const isImmediate = openAuction?.name === "Round 1";

// Après
const isImmediate = !!openAuction; // openAuction = round avec status='open'
```

**Comportement résultant :**

| Contexte | Effet |
|---|---|
| Round 1, 2 ou 3 ouvert | Changement immédiat (`team_sponsors` / `team_strategies` mis à jour) |
| Aucun round ouvert (phase de course ou inter-phase) | Changement en `pending`, appliqué au prochain `confirm_phase_setup` |

La logique `pending` existante est conservée telle quelle — seule la condition de bascule change.

---

### 2. Nouveau cycle de vie des rounds

#### 2a. Création des rounds (`createNextPhaseAuctions`)

À la création, les 3 rounds sont `scheduled`. Les dates sont pré-remplies depuis `AUCTION_PHASES` de `lib/phases.ts`.

| Champ | Round 1 | Round 2 | Round 3 |
|---|---|---|---|
| `status` | `'scheduled'` | `'scheduled'` | `'scheduled'` |
| `opens_at` | `auctionDates[0]` (phase start) | `closes_at` R1 (placeholder) | `closes_at` R2 (placeholder) |
| `closes_at` | saisie commissaire | saisie commissaire | saisie commissaire |

`opens_at` de Round 2 et 3 est un placeholder (closes_at du round précédent). Il sera remplacé par `now()` quand `validate_round` les ouvrira réellement. Il n'est jamais affiché dans l'UI.

#### 2b. Ouverture automatique du Round 1 (lazy-open)

Round 1 n'est plus créé comme `'open'` immédiatement. Il s'ouvre automatiquement quand `opens_at <= now()`, via un helper partagé appelé dans les server actions qui ont besoin de savoir si un round est ouvert.

```typescript
// lib/supabase/get-open-auction.ts
async function getOpenAuction(supabase, leagueId) {
  // 1. Cherche un round déjà open
  const open = await supabase.from("auctions")
    .select("id, name").eq("league_id", leagueId).eq("status", "open").maybeSingle();
  if (open.data) return open.data;

  // 2. Cherche un round scheduled dont opens_at est passé
  const due = await supabase.from("auctions")
    .select("id, name").eq("league_id", leagueId).eq("status", "scheduled")
    .lte("opens_at", new Date().toISOString())
    .order("opens_at", { ascending: true }).limit(1).maybeSingle();
  if (!due.data) return null;

  // 3. L'ouvre
  await supabase.from("auctions").update({ status: "open" }).eq("id", due.data.id);
  return due.data;
}
```

Ce helper remplace les requêtes `openAuction` directes dans `budget/actions.ts` et `strategies/actions.ts`.

#### 2c. Fermeture automatique + ouverture du suivant (`validate_round`)

À la fin du RPC `validate_round`, après conversion des draft_bids :

```sql
-- Ferme le round courant
UPDATE public.auctions
SET status = 'closed', resolved_at = now()
WHERE id = v_auction.id;

-- Ouvre le suivant (s'il existe)
UPDATE public.auctions
SET status = 'open', opens_at = now()
WHERE league_id = p_league_id
  AND status = 'scheduled'
ORDER BY closes_at ASC
LIMIT 1;
```

Round 3 validé → Round 3 `closed`, aucun `scheduled` → plus d'`openAuction` → sponsor/stratégie passent en pending.

---

### 3. `closes_at` = indicatif uniquement (pour l'instant)

Les dates dans l'UI sont visuellesaujourd'hui. Dans le futur, le pipeline `validate_round` pourra être déclenché automatiquement quand `closes_at` est atteint. L'architecture le permet, mais ce n'est pas dans ce scope.

**Conséquence immédiate :** supprimer le check `closes_at < now()` dans :
- RPC `place_bid` — les bids sont acceptées tant que le round est `open`
- Server action `cancel_bid` — idem

---

### 4. UI rounds — saisie des dates de fermeture

#### Sémantique corrigée

Les 3 inputs date/time dans la page rounds = **heure de fermeture** (`closes_at`) pour chaque round. Pré-rempli depuis `AUCTION_PHASES[currentPhase].auctionDates`.

Le champ "Closes at" séparé (uniquement pour le dernier round) est **supprimé** — redondant.

#### `setRoundDates` dans `market/actions.ts`

Cette action ne doit jamais modifier `opens_at` (qui est la source de vérité pour le lazy-open de Round 1). Elle ne met à jour que `closes_at`.

---

## Fichiers impactés

### Migrations SQL (1 nouvelle migration)

| Fichier | Changement |
|---|---|
| `supabase/migrations/YYYYMMDD_round_lifecycle.sql` | Modifier `validate_round` : close + open next. Supprimer check `closes_at` dans `place_bid`. |

### Server actions et RPCs TypeScript (6 fichiers)

| Fichier | Changement |
|---|---|
| `budget/actions.ts` | `!!openAuction` + appel `getOpenAuction()` |
| `team/strategies/actions.ts` | `!!openAuction` + appel `getOpenAuction()` |
| `auction/rounds/actions.ts` | `createNextPhaseAuctions` : Round 1 `scheduled`, pré-remplir depuis `lib/phases.ts`, `closes_at` = saisie |
| `auction/rounds/actions.ts` | `updateRoundDates` : ne met à jour que `closes_at` |
| `auction/market/actions.ts` | `setRoundDates` : supprimer update de `opens_at` |
| `auction/[auctionId]/actions.ts` | `cancel_bid` : supprimer check `closes_at < now()` |

### Nouveau fichier partagé

| Fichier | Contenu |
|---|---|
| `lib/supabase/get-open-auction.ts` | Helper lazy-open (voir §2b) |

### UI (3 fichiers)

| Fichier | Changement |
|---|---|
| `auction/rounds/page.tsx` | Lire `closes_at` pour pré-remplir le form (pas `opens_at`) |
| `auction/rounds/rounds-client.tsx` | Supprimer champ "Closes at", inputs = fermeture, labeller "Closes" |
| `budget/marketplace/marketplace-client.tsx` | Mettre à jour message "Changes apply immediately" |
| `team/strategies/strategies-client.tsx` | Mettre à jour message |

---

## Ce qui ne change pas

- Schema DB — aucune migration de colonnes
- RPC `confirm_phase_setup` — logique pending inchangée
- RPC `release_rider`, `leave_league`, `place_bid` (sauf suppression check `closes_at`) — inchangés
- `lib/phases.ts` et `isInAuctionWindow()` — inchangés
- `join_league_late.sql` — compatible avec le nouveau `opens_at` dynamique (plus précis)
- Logique pending existante (columns `pending_sponsor_id`, `pending_is_active`, `pending_config`) — inchangée

---

## Hors scope (à faire plus tard)

- Automatiser le déclenchement de `validate_round` basé sur `closes_at` (brancher pipeline sur les dates)
- Cron pour ouvrir Round 1 si le commissaire n'a pas créé les rounds à temps
- Notifications in-app lors des transitions de rounds
