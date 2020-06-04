# End to end encryption by default

By default, Riot will create encrypted DM rooms if the user you are chatting with has keys uploaded on their account.
For private room creation, Riot will default to encryption on but give you the choice to opt-out.

## Disabling encryption by default

Set the following on your homeserver's
`/.well-known/matrix/client` config:
```json
{
  "im.vector.riot.e2ee": {
    "default": false
  }
}
```
