# Navigation Redesign — Implementation Plan

**Date :** 2026-05-13  
**Statut :** Prêt à implémenter  
**Spec vision :** `docs/superpowers/specs/2026-05-09-navigation-redesign-vision.md`  
**Session wireframes :** `2026-05-12` (bundle local, décisions validées ci-dessous)

---

## Décisions validées (session 2026-05-12/13)

| Élément | Décision |
|---|---|
| Bottom nav | 4 tabs avec labels : Racing / Auction / Team / Ranking |
| Palmares / Achievements | Sub-tab dans Team (pas de tab standalone) |
| Header universel | Titre page (gauche, 20px bold) + Compound block (droite) |
| Compound block | `[#N · NNk€ \| JS]` — un seul container, séparateur vertical, info = non-cliquable, avatar = gradient cyan cliquable |
| Tabs niveau 2 | Pill-chip squarish (radius 8px) sur actif, fond subtil + border, texte plain sur inactifs |
| Filter pills | Radius 20px, toujours avec outline — visuellement distinct des tabs |
| Contextual Action Bar | Glass (blur 20px), info ghost gauche, bouton pleine hauteur 0 inset, border-radius propres |
| Glassmorphisme | Bottom nav + CTA bar uniquement (blur subtil) |
| Tabs niveau 2 hide-on-scroll | Oui — disparaît au scroll down, réapparaît au scroll up |
| Frosted glass nav | Accepté (rejet spec v1 conditionnel — levé car hide-on-scroll résout le conflict) |

---

## Architecture des écrans

### Racing
**Tab par défaut :** `Feed`

| Tab | Contenu |
|-----|---------|
| **Feed** | Feed de cartes : stages passés (résultats), étape du jour (expanded), étapes futures (dashed). Goals sponsor = carte inline dans le feed quand accompli (pas de tab). |
| **Roles** | Gestion squad GT : assign/swap rôles (GC, SPR, KOM, STG, DOM). Grisé hors GT actif. |
| **Tactics** | Hub placement tactiques GT. Réutilise les composants existants (tactic-card, tactic-modal-shell, etc.). Grisé hors GT actif. |
| **Peloton** | Vue compacte toutes les équipes de la ligue avec leurs rôles GT. |

### Auction
**Tab par défaut :** `Bids`

| Tab | Contenu |
|-----|---------|
| **Bids** | Draft bids + contrats actifs. Contextual Action Bar : `8/10 slots · NNk€ left \| [Place Bid]` |
| **Market** | Pool de coureurs. Search bar + filter pills (All / GC / Sprinter / Climber / TT). Contextual Action Bar présent. |
| **League** | Status table commissioner (round dates, force-resolve). |
| **History** | Historique des rounds fermés. |

**Contextual Action Bar — états dynamiques :**
- Phase active → `8/10 slots · 33k€ left | [Place Bid]`
- Round pending → `Round 2 · 3 bids pending | [Validate Round]` (commissioner only)
- Hors période → `Phase closed · Next: Jun 2 | [View History]`

### Team
**Tab par défaut :** `My Team`

| Tab | Contenu |
|-----|---------|
| **My Team** | Levels card, stratégies actives, roster complet avec badges rôles GT inline, slots libres, sponsor actif. Design actuel conservé. |
| **Budget** | Récupère 100% du contenu de `/league/[id]/budget` : phase selector, sponsor card, treasury widgets, transactions récentes. |
| **Achievements** | Palmares : skins, sponsors history, phase wins, nemesis records. |

### Ranking
**Tab par défaut :** `Teams`

| Tab | Contenu |
|-----|---------|
| **Teams** | Classement XP cumulé. Design actuel conservé. |
| **Riders** | XP par rider. Design actuel conservé. |

---

## Composants à créer / modifier

### Nouveaux composants

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `<CompoundHeaderBlock>` | `components/compound-header-block.tsx` | `[#N · NNk€ \| JS]` — fetche rank + treasury du team courant |
| `<ContextualActionBar>` | `components/contextual-action-bar.tsx` | Glass bar avec info ghost + bouton pleine hauteur |
| `<L2Tabs>` | `components/l2-tabs.tsx` | Pill-chip squarish, active = fond + border, inactive = texte plain. Hide-on-scroll. |

### Composants modifiés

| Composant | Fichier | Changement |
|-----------|---------|------------|
| `<TopBar>` | `components/topbar.tsx` | Remplace logo+league+icons par titre page + CompoundHeaderBlock |
| `<BottomNav>` | `components/bottom-nav.tsx` | Glassmorphisme + labels + 4 tabs corrects + home → racing rename |
| `<Sidebar>` | `components/sidebar.tsx` | Adapter aux 4 sections + Settings dans profile menu |

### Pages à créer / restructurer

| Route actuelle | Route cible | Action |
|----------------|-------------|--------|
| `/league/[id]` (home) | `/league/[id]` → Racing | Renommer la page, ajouter L2Tabs |
| `/league/[id]/team` | `/league/[id]/team` | Ajouter L2Tabs (My Team / Budget / Achievements) |
| `/league/[id]/budget` | Absorbé dans Team/Budget | Supprimer comme page standalone |
| `/league/[id]/auction` | `/league/[id]/auction` | Ajouter L2Tabs (Bids / Market / League / History) |
| `/league/[id]/ranking` | `/league/[id]/ranking` | Ajouter L2Tabs (Teams / Riders) |
| `/league/[id]/team/gt` | Absorbé dans Racing/Roles | Supprimer comme page standalone |
| `/league/[id]/levels` | Absorbé dans profile menu | Supprimer de la nav principale |
| `/league/[id]/help` | Absorbé dans profile menu | Supprimer de la nav principale |
| `/league/[id]/settings` | Reste accessible via profile menu | Supprimer du TopBar |

---

## Données à fetcher pour CompoundHeaderBlock

Le layout `/league/[leagueId]/layout.tsx` doit fetcher en plus :
```ts
// Rank de l'équipe dans la ligue (classement XP)
const { data: rankData } = await supabase
  .from("teams")
  .select("id, xp")
  .eq("league_id", leagueId)
  .order("xp", { ascending: false });

const myRank = rankData?.findIndex(t => t.id === teamId) + 1;
const totalTeams = rankData?.length ?? 0;

// Treasury du team courant
const { data: teamData } = await supabase
  .from("teams")
  .select("treasury")
  .eq("id", teamId)
  .single();
```

Passer `rank`, `totalTeams`, `treasury` comme props au layout → TopBar → CompoundHeaderBlock.

---

## Séquencement des PRs

| PR | Scope | Dépendances | Estimé |
|----|-------|-------------|--------|
| **PR-A** | TopBar + BottomNav + CompoundHeaderBlock | aucune | 4-6h |
| **PR-B** | L2Tabs + Racing page restructure (Feed/Roles/Tactics/Peloton) | PR-A | 6-8h |
| **PR-C** | Auction L2Tabs + ContextualActionBar | PR-A | 4-6h |
| **PR-D** | Team L2Tabs (My Team/Budget/Achievements) + Budget absorption | PR-A | 4-6h |
| **PR-E** | Ranking L2Tabs (Teams/Riders) | PR-A | 2-3h |
| **PR-F** | Suppression pages obsolètes (gt, levels, help standalone) | PR-B+D | 2-3h |

**Ordre recommandé :** PR-A → PR-C → PR-D → PR-B → PR-E → PR-F

PR-A est le prérequis de tout. PR-C et PR-D sont indépendants entre eux, peuvent être faits en parallèle.

---

## Desktop — impact minimal

Le layout desktop actuel (sidebar 180px + main + detail rail) change peu :
- `<TopBar>` desktop : actuellement `lg:hidden`. **Décision :** on garde le TopBar visible sur desktop aussi (supprime l'info dupliquée dans la sidebar).
- `<Sidebar>` : remplace les 5 items actuels par 4 (Racing / Auction / Team / Ranking) + Settings en bas.
- `<BottomNav>` : reste `lg:hidden`, pas de changement.
- `<ContextualActionBar>` : visible sur desktop dans la colonne main, sticky en bas du main panel.
- L2Tabs : identiques sur desktop, sticky sous le TopBar.

Pas de refonte desktop dans cette migration — on adapte ce qui existe.

---

## Notes techniques

- **Hide-on-scroll pour L2Tabs :** réutiliser le hook existant `hooks/use-scroll-direction.ts`. Appliquer `translateY(-100%)` sur scroll down, `translateY(0)` sur scroll up. Sticky juste sous le TopBar.
- **Glassmorphisme :** `backdrop-filter: blur(20px)` + `bg-[rgba(8,14,26,0.80)]`. Vérifier support Safari (préfixe `-webkit-backdrop-filter`). Déjà utilisé dans l'app ? Sinon ajouter le token dans `globals.css`.
- **CompoundHeaderBlock radius :** container `rounded-[10px] overflow-hidden`, séparateur `border-r`, avatar `bg-gradient-to-br from-cyan-600 to-cyan-400`.
- **ContextualActionBar bouton :** bouton pleine hauteur (`self-stretch`), `rounded-none` côté gauche, `rounded-[8px]` côté droit — ou `overflow-hidden` sur le container + `rounded-r-[8px]` sur le bouton. À affiner en code.
- **Renommage home → Racing :** changer le label dans `bottom-nav.tsx` + `sidebar.tsx`. La route reste `/league/[id]`.
