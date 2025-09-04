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

# Setting up recovery

By default, Element strongly encourages (but does not require) users to set up
recovery so that you can access history on your new devices as well as retain access to your message history and cryptographic identity when you lose all of your devices.

## Removal of old settings

Support for the configuration options `secure_backup_required` and `secure_backup_setup_methods`
in the `/.well-known/matrix/client` config has been removed.

Setting up recovery is now always recommended to all users by showing a one-off toast and a
permanent red dot on the _Encryption_ tab in the _Settings_ dialog. When creating a new
recovery key, the UI only supports auto-generated keys. Using an existing (custom) passphrase
still works, but is not exposed in the UI when setting up recovery.

# Compatibility

The settings above were first proposed under a `im.vector.riot.e2ee` key, which
is now deprecated. Element will check for either key, preferring
`io.element.e2ee` if both exist.
