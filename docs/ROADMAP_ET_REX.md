# WattHunter — Roadmap & REX

> Document stratégique vivant. Deux parties : le retour sur expérience (ce qu'on a appris, les erreurs) et la direction future du jeu.
> Rédigé le 2026-07-04. Pas pressant : la refonte se fait **après le Tour de France**. En attendant, focus maintenance = mode classique uniquement.

---

## 1. Retour sur expérience (REX)

### 1.1 Erreur principale : trop réinventer la roue

- J'ai créé mes propres règles, mécaniques et systèmes de A à Z, sans jamais vraiment comprendre comment les leaders du genre (Velogames en tête) construisent les leurs.
- Le bench s'est limité au **visuel**. Il aurait fallu un vrai bench des **mécaniques** : comprendre les différents systèmes de scoring, de sélection, de scoring d'équipe qui existent déjà.
- Symptôme concret : avoir bâti le scoring sur les **points PCS bruts** au lieu d'aller voir comment un leader établi score (barème par rang façon Velogames). C'est ce qu'on a fini par corriger tardivement (refonte scoring GT rank-based).
- Leçon : avant de coder, **comprendre le paysage existant**. Le positionnement de son propre jeu se clarifie en connaissant celui des autres.

### 1.2 Erreur : partir de mon seul besoin

- J'ai supposé que le jeu devait d'abord répondre à **mon** besoin à moi, en me disant que si les autres n'accrochaient pas c'est qu'ils ne comprenaient pas la valeur du jeu.
- En réalité, les joueurs **n'ont pas envie de changer leurs habitudes**. Ils ont la flemme de découvrir de nouvelles pages, de nouveaux systèmes. La vie passe avant.
- Je ne peux pas être une charge cognitive supplémentaire. Le jeu doit s'insérer dans leur quotidien, pas leur demander un apprentissage.
- Leçon : construire pour l'utilisateur réel, pas pour la version idéalisée de l'utilisateur.

### 1.3 Erreur : la restriction comme mécanique d'équilibrage

- Débloquer des coureurs au fil de la saison (Pogačar & co verrouillés au début) n'était pas une bonne idée. C'était frustrant de ne pas pouvoir aligner certains sprinters sur le Giro.
- Le vrai problème à résoudre était le déséquilibre, et la **restriction n'est jamais une bonne base** pour ça, même temporaire.
- Meilleures leviers : **augmenter le coût** d'un coureur trop fort, ou orienter vers d'autres stratégies valorisées (stage hunters, rôle Underdog) plutôt qu'interdire.
- Leçon transversale : toujours se poser **quel est le problème à résoudre** et **quelles sont les différentes façons de le résoudre**, avant de sauter sur la première mécanique qui vient.

### 1.4 Erreur : deux modes en parallèle

- Faire coexister mode **classique** et mode **manager** était une mauvaise décision. Deux fois la complexité, deux fois la maintenance, dispersion du produit.
- Au départ j'étais persuadé que le mode manager était supérieur. Avec le recul, c'est le mode classique qui doit devenir le mode unique.
- Leçon : un seul mode, assumé et poli, plutôt que deux à moitié.

### 1.5 Erreur : feature-creep permanent

- Réflexe « dev dev dev » : toujours de nouvelles features (Remontada, récupération d'un coureur dès la 1re étape, skins, etc.). Trop loin, trop vite.
- Beaucoup de ces mécaniques ne seront **pas gardées**. Elles ont surtout ajouté de la dette et de la maintenance.
- J'ai **sous-estimé le coût de maintenance technique**, en particulier tout le système de budgets.
- Leçon : chaque feature a un coût de maintenance récurrent. Moins mais mieux.

### 1.6 Erreur : ignorer business model & positionnement

- Je ne me suis pas du tout intéressé au **business model** : qu'est-ce que je veux faire de ce jeu, quel est l'objectif, à qui il s'adresse.
- Encore une question de **positionnement** : sans savoir pour qui je construis et pourquoi, chaque décision produit part dans tous les sens.
- Leçon : trancher tôt le « pour qui / pour quoi », même grossièrement.

### 1.7 Ce qui s'est bien passé

- **C'est en faisant qu'on découvre** les vrais problèmes et les vraies différences. Beaucoup de ces leçons ne pouvaient venir que de l'exécution.
- **On a un jeu qui fonctionne.** Il tourne, il est jouable, il va servir pour le Tour de France.
- Méta-leçon : j'aurais dû partir d'un **format éprouvé** et y apporter **mon twist différenciant**, plutôt que tout changer en même temps.

### 1.8 Principes à retenir pour les futurs projets

- Bencher les **mécaniques**, pas seulement le visuel.
- Définir le **problème** et **plusieurs solutions** avant de coder une mécanique.
- La **restriction** est rarement la bonne réponse à un déséquilibre.
- Un seul mode / un scope resserré.
- Feature = coût de maintenance récurrent.
- Trancher **positionnement & business model** tôt.
- Construire pour l'utilisateur réel (habitudes, flemme, temps limité).

---

## 2. Roadmap future (post-Tour de France)

> Pas pressant. Le Tour se joue sur le jeu actuel. La refonte vient ensuite.

### 2.1 Cap produit

- **Application mobile iOS** (compte développeur en cours d'obtention). L'expérience mobile native sera bien plus agréable que la web app.
- **Le mode classique devient le mode unique.** On **tue le mode manager**.
- **Jeu indépendant par phase** : chaque joueur choisit de participer ou non au classique, au grand tour, etc. Pas d'obligation de suivre toutes les phases.
  - À résoudre : comment gérer les **non-participations** et les **late-joins** dans le **classement final annuel** (points accumulés).

### 2.2 Ce qu'on garde (et retravaille)

- **Sponsors, goals, bonus de nationalité** : à rapatrier, mais recentrés autour de l'**XP** plutôt que des bonus financiers. C'est là qu'est la vraie valeur de jeu.
- **Bonus nationalité** : la seule mécanique « stratégie » qui vaut le coup d'être gardée, mais à **refaire différemment**.
- **Achievements** : à garder, retravailler et améliorer.
- **Rôles / stratégies** valorisés : stage hunters et **Underdog** comme axes de jeu intéressants.

### 2.3 Ce qu'on jette

- Le **mode manager** entièrement.
- Les **levels** et **rangs d'équipe**.
- Le **déblocage progressif** de coureurs.
- Tout le système de **budgets**.
- Les **bonus financiers** (argent, trésorerie) : passage à une logique XP.
- Le reste des **stratégies** (sauf nationalité, à refaire).
- Slots d'équipe : **nombre fixe**, fini les slots variables.

> Bénéfice : simplification massive de la maintenance et de la technique.

### 2.4 Vision long terme : un jeu pour les communautés cyclisme

- Positionner le jeu comme un **outil d'animation de communauté** cyclisme (potes, Discord, créateurs de contenu).
- Pistes :
  - **Intégrations Discord** (jouer avec ta communauté).
  - Features spécialisées communautés : badges, tournois dédiés.
  - **Modèle abonnement**, avec **partage de revenus** reversé aux créateurs de contenu / animateurs de communauté.
  - Les communautés et créateurs deviennent alors le canal de **marketing & growth**.
- Grande question à trancher avant de foncer : **quel type de jeu, pour qui, avec ou sans objectif financier**.

---

## 3. Directive de maintenance (immédiate, dès maintenant)

- **Focus exclusif sur le mode classique.**
- On ne se soucie plus de **casser le mode manager** : il est condamné.
- Les nouvelles mises à jour n'ont pas à préserver le mode manager.
- Le rapatriement intelligent (sponsors, goals, nationalité, orientés XP) se fera **plus tard**, dans la refonte post-Tour.
