# End to end encryption by default

By default, Element will create encrypted DM rooms if the user you are chatting with has keys uploaded on their account.
For private room creation, Element will default to encryption on but give you the choice to opt-out.

## Disabling encryption by default

Set the following on your homeserver's
`/.well-known/matrix/client` config:

```json
{
  "im.vector.e2ee": {
    "default": false
  }
}
```

# Secure backup

By default, Element strongly encourages (but does not require) users to set up
Secure Backup so that cross-signing identity key and message keys can be
recovered in case of a disaster where you lose access to all active devices.

## Requiring secure backup

To require Secure Backup to be configured before Element can be used, set the
following on your homeserver's `/.well-known/matrix/client` config:

```json
{
  "im.vector.e2ee": {
    "secureBackupRequired": true
  }
}
```

# Compatibility

The settings above were first proposed under a `im.vector.riot.e2ee` key, which
is now deprecated. Element will check for either key, preferring
`im.vector.e2ee` if both exist.
