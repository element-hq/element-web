# Patchs Leveragers sur Element Web

La branche `leveragers` part du tag officiel Element `v1.12.32`, avec ces patchs par-dessus. Ce fichier
sert à celui qui les rejoue sur un nouveau tag (rebase) : une ligne par patch, avec les fichiers
d'Element qu'il touche.

| Commit | But | Fichiers d'Element touchés | Issue Element |
|---|---|---|---|
| `e0825ca` | Écrire un message avec un fichier, envoyé dans le même événement (légende MSC2530) | `src/ContentMessages.ts`, `src/components/views/dialogs/UploadConfirmDialog.tsx`, `res/css/views/dialogs/_UploadConfirmDialog.pcss`, `src/i18n/strings/{en_EN,fr}.json` (+ tests) | aucune référencée |
| `e690728` | Marque « Agents by Leveragers » : icônes, nom, couleur, pages statiques | `res/manifest.json`, `res/vector-icons/*`, `src/vector/index.html`, `src/vector/static/{incompatible-browser,unable-to-load}.html`, `src/async-components/structures/ErrorView.tsx`, `src/i18n/strings/{en_EN,es,fr}.json`, `modules/*/e2e/*.spec.ts` | sans objet |
| `592f054` | Le panneau Fichiers liste les fichiers des salons chiffrés sur le web | `src/components/structures/FilePanel.tsx` (+ nouveau `src/indexing/ServerFileScanner.ts`) | aucune référencée |
| `fix/couleur-barre-titre` | Barre de titre de l'app installée : couleur de départ = fond du thème Leveragers (`#FAF8F4`), pour qu'elle ne passe plus du bleu nuit au clair | `res/manifest.json` (`theme_color`), `src/vector/index.html` (`<meta name="theme-color">`), deux lignes déjà modifiées par `e690728` | sans objet |
| `feat/section-messages-prives` (`dfe746e`) | Liste des salons : la section « Personnes » s'appelle « Messages privés » (nouvelle clé, `common|people` reste ailleurs) | `src/viewmodels/room-list/RoomListViewModel.ts` (getSectionTitle, une ligne), `src/i18n/strings/{en_EN,fr}.json` (clé `room_list|section|direct_messages`), test `RoomListViewModel.test.ts` (une ligne) | aucune |
| `feat/tri-alphabetique` (`7b109ba`) | Le tri par défaut de la liste des salons se règle dans config.json (`RoomList.preferredSorting` accepte le niveau CONFIG) | `src/settings/Settings.tsx` (supportedLevels, une ligne) | aucune |
| `feat/ecran-installation` (`d55c060`, `3d6c386`) | Écran « Installez l'application » à l'ouverture dans le navigateur sur ordinateur (Chrome/Edge, Safari, Firefox), avec l'étape « garder dans le Dock / épingler à la barre des tâches » | `src/vector/index.ts` (un import + un appel avant `loadApp`), `res/manifest.json` (entrée `webapp` dans `related_applications`), `src/i18n/strings/{en_EN,fr}.json` (section `leveragers_install`) ; le reste est neuf : `src/vector/leveragers/*`, `res/fonts/Leveragers/*` (OFL) | aucune |
| `feat/retouches-ecran-installation` (`59106cc`) | Écran d'installation allégé : gauche identique sur tous les écrans (comme la connexion de Mission Control), à droite une illustration (mockup du Dock avant installation, animation « garder dans le Dock » après, animation des 2 étapes sur Safari) puis les consignes, « Continuer dans le navigateur » en petit lien, bouton « Ouvrir l'application » quand elle est déjà installée | `res/manifest.json` (`protocol_handlers` : lien `web+leveragers:` ouvert par l'app installée ; `launch_handler` `focus-existing` : l'app déjà ouverte passe au premier plan au lieu d'ouvrir une seconde fenêtre), `src/i18n/strings/{en_EN,fr}.json` (section `leveragers_install`) ; le reste dans `src/vector/leveragers/*` | s'appuie sur `feat/ecran-installation` |
| `fix/ecran-installation-fenetre-app` (`53eb0b2`) | Juste après l'installation, Chrome et Edge déplacent l'onglet dans la fenêtre de l'app sans le recharger : l'écran d'installation s'efface dès que la page devient l'app, sans retenir « continuer dans le navigateur » | aucun fichier d'Element : `src/vector/leveragers/InstallScreen.tsx` (+ test) | s'appuie sur `feat/retouches-ecran-installation` |
| `feat/legende-depuis-barre` (`4f90e5a`) | Le texte déjà écrit dans la barre devient le message du fichier ajouté (trombone, coller, glisser-déposer), la barre se vide à l'envoi, la fermeture de la fenêtre le laisse en place | `src/ContentMessages.ts` (type `ComposerDraft`, paramètre optionnel de `sendContentListToRoom`), `UploadConfirmDialog.tsx` (prop `initialCaption`), `SendMessageComposer.tsx` (se signale au VM), `RoomUploadViewModel.tsx` (`setComposerDraft`) | s'appuie sur `e0825ca` (légendes) |
| `feat/cle-recuperation-gardee` | Comptes neufs : la récupération est mise en place sans rien demander, et une copie chiffrée (WebCrypto) de chaque clé de récupération créée part chez Leveragers ; détail plus bas | `src/MatrixClientPeg.ts`, `src/stores/InitialCryptoSetupStore.ts`, `src/components/views/settings/encryption/ResetIdentityBody.tsx` (un import + un appel chacun), `src/IConfigOptions.ts` (un champ) ; aucune dépendance ajoutée ; le reste est neuf : `src/utils/crypto/{recoveryKeyEscrow,silentRecoverySetup}.ts` (+ tests) | aucune |

Chemins relatifs à `apps/web/` sauf `modules/`.

## `feat/cle-recuperation-gardee` : clé de récupération gardée par Leveragers

Pour un compte qui n'a pas encore d'identité de chiffrement, notre build met en place la récupération sans rien
demander (pas de « Set up recovery » ni de « Back up your chats ») et envoie au serveur une copie de chaque clé de
récupération qu'il crée, chiffrée dans le navigateur (WebCrypto) pour une clé publique P-256 dont seule Leveragers
détient la moitié privée. La personne confirme toujours ses nouveaux appareils de la façon habituelle. Rien n'est prévu pour les
comptes qui ont déjà une identité, sauf s'ils la réinitialisent.

Réglage : `leveragers_recovery_key_recipient` dans config.json (clé publique P-256, point non compressé de 65 octets
en base64url sans remplissage). Absent ou vide : aucun code de ce patch ne s'exécute, Element se comporte comme
l'original, avec ses propres invitations.

Code neuf :

- `src/utils/crypto/recoveryKeyEscrow.ts` : scellement au format v1, avec le seul WebCrypto du navigateur (paire
  P-256 à usage unique, ECDH avec la clé publique de config.json, HKDF-SHA-256 avec pour sel les deux clés
  publiques et pour info `leveragers-recovery-key-v1`, AES-256-GCM avec un IV aléatoire de 12 octets et, en données
  associées, `<user_id>\n<key_id>`), envoyé comme `{"v": 1, "epk", "iv", "ct"}` en base64url ; envoi
  `POST <serveur>/_leveragers/keys/v1/recovery-key` avec `Authorization: Bearer <jeton d'accès>` et
  `{"key_id", "sealed"}` ; nouvelles tentatives tant que l'onglet est ouvert (2 s, 5 s, 15 s, 30 s, puis toutes les
  60 s) sur erreur réseau, 429 et 5xx, abandon sur les autres réponses 4xx ; enveloppe de
  `CryptoApi.bootstrapSecretStorage`. Le journal ne contient que les codes HTTP, jamais la clé ni la copie scellée.
  Ce fichier n'importe que le SDK et `SdkConfig` : `MatrixClientPeg` l'importe, et y ajouter `SecurityManager`,
  `DeviceListener` ou un toast referme un cycle d'import (`SettingsStore` indéfini au chargement).
- `src/utils/crypto/silentRecoverySetup.ts` : `setUpRecoverySilently`, qui crée une clé
  (`createRecoveryKeyFromPassphrase`) et appelle `bootstrapSecretStorage` avec `setupNewSecretStorage: true`, cette
  clé, et `setupNewKeyBackup` seulement s'il n'y a pas encore de sauvegarde, comme « Change recovery key », avec
  `DeviceListener.whilePaused` et `withSecretStorageKeyCache` pour retenir les toasts, puis écrit
  `io.element.recovery` et retire le toast de configuration déjà affiché. Ne lève jamais d'erreur : en cas d'échec,
  Element reprend son comportement habituel.

Points d'accroche dans Element :

- `src/MatrixClientPeg.ts`, `initClientCrypto` : `installRecoveryKeyEscrow` juste après `initRustCrypto`. Toutes
  les créations de clé passent par `bootstrapSecretStorage({createSecretStorageKey})` (première connexion,
  « Reset identity », « Change recovery key », ancienne boîte « Set up Secure Backup ») ; quand la fonction a été
  appelée et que l'appel a abouti, la clé est scellée et envoyée en arrière-plan avec l'identifiant de la clé par
  défaut, après vérification que cette clé par défaut est bien la nouvelle.
- `src/stores/InitialCryptoSetupStore.ts`, `doSetup` : `setUpRecoverySilently` après la création de l'identité et
  de la sauvegarde, avant `onFinished(true)`. Ce chemin ne sert qu'à la première connexion d'un compte sans
  signature croisée ; le chemin `COMPLETE_SECURITY` (compte qui a déjà une identité) n'est pas touché.
- `src/components/views/settings/encryption/ResetIdentityBody.tsx` : `setUpRecoverySilently` entre
  `resetEncryption()` et `onReset()` (réglages, et « Can't confirm? » de l'écran de confirmation).

À revérifier à chaque nouveau tag d'Element :

- matrix-js-sdk, `RustCrypto.bootstrapSecretStorage` : appelle toujours `createSecretStorageKey` seulement quand il
  crée une clé, fait de cette clé la clé par défaut (`setDefaultKeyId`) avant de rendre la main, et range la clé de
  sauvegarde dans le stockage des secrets (`saveBackupKeyToStorage`, ou `resetKeyBackup` avec `setupNewKeyBackup`).
- `RustCrypto.resetEncryption` : supprime toujours le stockage des secrets et crée une nouvelle sauvegarde.
- `InitialCryptoSetupStore` : toujours le seul chemin de la première connexion (`MatrixChat.postLoginSetup`, sans
  signature croisée), avec `onFinished(true)` après la sauvegarde.
- `DeviceListener` et `toasts/SetupEncryptionToast` : `whilePaused`, `isSecretStorageBeingAccessed` (activé par
  `withSecretStorageKeyCache`) et `hideToast` retiennent et retirent toujours le toast de configuration, et aucun
  nouvel avertissement de récupération n'apparaît ailleurs.
- Aucun nouvel écran ne crée de clé de récupération sans passer par `bootstrapSecretStorage({createSecretStorageKey})`.
