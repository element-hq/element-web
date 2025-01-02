# End to end encryption by default

By default, Element will create encrypted DM rooms if the user you are chatting with has keys uploaded on their account.
For private room creation, Element will default to encryption on but give you the choice to opt-out.

## Disabling encryption by default

Set the following on your homeserver's
`/.well-known/matrix/client` config:

```json
{
    "io.element.e2ee": {
        "default": false
    }
}
```

## Disabling encryption

Set the following on your homeserver's
`/.well-known/matrix/client` config:

```json
{
    "io.element.e2ee": {
        "force_disable": true
    }
}
```

When `force_disable` is true:

- all rooms will be created with encryption disabled, and it will not be possible to enable
  encryption from room settings.
- any `io.element.e2ee.default` value will be disregarded.

Note: If the server is configured to forcibly enable encryption for some or all rooms,
this behaviour will be overridden.

# Secure backup

By default, Element strongly encourages (but does not require) users to set up
Secure Backup so that cross-signing identity key and message keys can be
recovered in case of a disaster where you lose access to all active devices.

## Requiring secure backup

To require Secure Backup to be configured before Element can be used, set the
following on your homeserver's `/.well-known/matrix/client` config:

```json
{
    "io.element.e2ee": {
        "secure_backup_required": true
    }
}
```

## Preferring setup methods

By default, Element offers users a choice of a random key or user-chosen
passphrase when setting up Secure Backup. If a homeserver admin would like to
only offer one of these, you can signal this via the
`/.well-known/matrix/client` config, for example:

```json
{
    "io.element.e2ee": {
        "secure_backup_setup_methods": ["passphrase"]
    }
}
```

The field `secure_backup_setup_methods` is an array listing the methods the
client should display. Supported values currently include `key` and
`passphrase`. If the `secure_backup_setup_methods` field is not present or
exists but does not contain any supported methods, Element will fallback to the
default value of: `["key", "passphrase"]`.

# Compatibility

The settings above were first proposed under a `im.vector.riot.e2ee` key, which
is now deprecated. Element will check for either key, preferring
`io.element.e2ee` if both exist.
