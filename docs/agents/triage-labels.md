# Triage Labels

<!-- produit:generique:debut (copié de ~/AI OS/templates/produit/triage-labels.md, ne pas modifier ici) -->

Les skills mattpocock parlent de cinq rôles de triage. Dans un produit, ce sont
des labels GitHub Issues au nom identique au rôle.

| Rôle (skills) | Label | Sens |
|---|---|---|
| `needs-triage` | `needs-triage` | Le propriétaire doit évaluer le ticket |
| `needs-info` | `needs-info` | En attente d'information |
| `ready-for-agent` | `ready-for-agent` | Spécifié, aucun grill ouvert : la boucle de dev peut le prendre |
| `ready-for-human` | `ready-for-human` | Le propriétaire le fait ou le tranche lui-même |
| `wontfix` | `wontfix` | Ne sera pas fait |

Quand un skill nomme un rôle, poser le label correspondant :
`gh issue edit <n> --add-label "<label>"` (retirer avec `--remove-label`). Les
autres labels du modèle (wayfinder, `discovery`, hors carte) sont dans
`docs/agents/issue-tracker.md`.

<!-- produit:generique:fin -->

## Spécifique à ce repo

Aucun écart avec les rôles canoniques.
