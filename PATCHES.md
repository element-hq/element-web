# Patches Renaissance Chat Web V1

Maintenu à jour à chaque PR ou rebase upstream. Source de vérité pour la chaîne de patches Renaissance appliquée par-dessus Element Web.

**Base upstream** : tag `v1.12.21`
**Branche Renaissance** : `renaissance/main`

## B — Onboarding pré-câblé Renaissance

- **Fichiers** :
  - `apps/web/config.sample.json` (override values default_server_config + brand + disable_custom_urls + permalink_prefix + room_directory)
  - `apps/web/src/components/views/elements/ServerPicker.tsx` (hide si `disable_custom_urls === true`)
  - `apps/web/src/components/structures/auth/Login.tsx` (normalize username + invite link Renaissance)
  - `apps/web/src/components/structures/auth/Registration.tsx` (redirect vers `https://chat.attalpresident.fr/onboard/`)
- **Marker code** : `PATCH-RENAISSANCE-B`
- **Conflit attendu au rebase** : moyen (composants React touchés régulièrement par upstream)
- **Alternative si rebase casse** : ré-appliquer la logique en lisant ce ledger + script `scripts/check-patches-applied.sh`

## A — Branding visuel (différé V1.1)

À implémenter post-validation pilots V1 fonctionnel. Voir spec `docs/specs/2026-06-18-fork-element-v1-pwa-web-only.md` côté repo synapse.
