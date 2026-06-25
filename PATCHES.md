# Patches Renaissance Chat Web V1

Maintenu à jour à chaque PR ou rebase upstream. Source de vérité pour la chaîne de patches Renaissance appliquée par-dessus Element Web.

**Base upstream** : tag `v1.12.21`
**Branche Renaissance** : `renaissance/main`

## B — Onboarding pré-câblé Renaissance (v2 — brand Attal Président + login hardening)

- **Fichiers** :
  - `apps/web/config.sample.json` :
    - v1 : default_server_config + disable_custom_urls + permalink_prefix + room_directory
    - **v2** : `brand: "Attal Président"` (vs "Renaissance Chat")
  - `apps/web/webapp/manifest.json` (v2) :
    - `name: "Attal Président"` + `short_name: "Attal"` (vs "Element" upstream)
    - Suppression `related_applications` (les suggestions Element Android/iOS ne concernent pas Attal Président)
  - `apps/web/src/components/views/elements/ServerPicker.tsx` (v1, hide si `disable_custom_urls === true` — filet upstream)
  - `apps/web/src/components/structures/auth/Login.tsx` :
    - v1 : normalize username + invite link Renaissance
    - **v2** : ServerPicker plus rendu du tout + footer "Créer un compte" supprimé (inscription token-only via /onboard/) + imports `UIFeature` et `ServerPicker` retirés
  - `apps/web/src/components/structures/auth/Registration.tsx` (v1, redirect vers `https://chat.attalpresident.fr/onboard/`)
- **Marker code** : `PATCH-RENAISSANCE-B` (v1) + `PATCH-RENAISSANCE-B v2` (v2 deltas)
- **Conflit attendu au rebase** : moyen (composants React touchés régulièrement par upstream — Login.tsx en particulier)
- **Alternative si rebase casse** : ré-appliquer la logique en lisant ce ledger + script `scripts/check-patches-applied.sh`

## CI — Build pipeline Renaissance

- **Fichiers** :
  - `scripts/docker-package.sh` (override : version lue depuis `scripts/.renaissance-version`, plus git describe sur bind-mount .git ro qui ne tient pas sur branch renaissance/main)
  - `.github/workflows/build-publish.yml` (build OCI image vers ghcr.io)
  - `.github/workflows/renaissance-patches-check.yml` (assertion markers post-rebase)
- **Marker code** : `PATCH-RENAISSANCE-CI`
- **Conflit attendu au rebase** : faible (scripts/ peu touchés upstream)
- **Alternative si rebase casse** : ré-écrire docker-package.sh simple (cf. fichier actuel)

## A — Branding visuel (différé V1.1)

À implémenter post-validation pilots V1 fonctionnel. Voir spec `docs/specs/2026-06-18-fork-element-v1-pwa-web-only.md` côté repo synapse.
