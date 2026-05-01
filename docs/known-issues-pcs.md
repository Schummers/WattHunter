# Known issues — PCS sync pipelines

Bugs connus du sync `services/pcs-sync` qui n'ont pas (encore) de fix automatisé.

## Parser fallback injects bad data on partial failures

**Symptôme :** quand le parser principal de `procyclingstats` lève (ex. `list index out of range`), le fallback de `enrich.py` peut écrire en base des valeurs erronées (ex. `birthdate=1926-05-30` pour un rider né en 2003).

**Reproduit sur :** Romain Grégoire (#23, slug `rider/romain-gregoire1`) lors du run du 2026-05-01.

**Impact :** champs bio incohérents en base. Pas détecté par le pipeline (pas de validation de range sur birthdate).

**Workaround actuel :** vérification manuelle post-run via `riders.birthdate < '1990-01-01'` pour repérer les valeurs aberrantes sur le top 100.

**Fix proposé (non-prioritaire) :** dans `enrich.py:_extract_birthdate` (ou équivalent), valider que la date parsée est entre 1980 et `today - 16y` avant d'écrire. Sinon NULL.

---

## Stale `pcs_slug` cause "Given HTML is invalid" errors

**Symptôme :** quand un rider est renommé sur PCS (ex. `thomas-pidcock` → `tom-pidcock`), `riders.pcs_slug` reste sur l'ancien slug, l'URL renvoie un 404, et le parser PCS lève "Given HTML is invalid" au lieu d'un message clair.

**Reproduit sur :** Tom Pidcock (#6) lors du run du 2026-05-01. Slug en base : `rider/thomas-pidcock` (404). Slug correct : `rider/tom-pidcock`.

**Impact :** rider impossible à enrichir tant que le slug n'est pas corrigé manuellement.

**Workaround actuel :** quand le pipeline log "Given HTML is invalid", vérifier le slug PCS à la main et patcher `riders.pcs_slug`.

**Fix proposé (non-prioritaire) :** détecter le 404 (status code) avant de tenter de parser, et tagger le rider comme "slug obsolete" dans une colonne ou un log dédié pour résolution manuelle. Une heuristique secondaire pourrait essayer `<short>-<lastname>` quand `<full>-<lastname>` 404.
