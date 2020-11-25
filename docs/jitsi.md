# Jitsi in Element

Element uses [Jitsi](https://jitsi.org/) for conference calls, which provides options for
self-hosting your own server and supports most major platforms.

1:1 calls, or calls between you and one other person, do not use Jitsi. Instead, those
calls work directly between clients or via TURN servers configured on the respective 
homeservers.

There's a number of ways to start a Jitsi call: the easiest way is to click on the 
voice or video buttons near the message composer in a room with more than 2 people. This
will add a Jitsi widget which allows anyone in the room to join.

Integration managers (available through the 4 squares in the top right of the room) may
provide their own approaches for adding Jitsi widgets.

## Configuring Element to use your self-hosted Jitsi server

Element will use the Jitsi server that is embedded in the widget, even if it is not the
one you configured. This is because conference calls must be held on a single Jitsi
server and cannot be split over multiple servers.

However, you can configure Element to *start* a conference with your Jitsi server by adding
to your [config](./config.md) the following:
```json
{
  "jitsi": {
    "preferredDomain": "your.jitsi.example.org"
  }
}
```

The default is `jitsi.riot.im` (a free service offered by Element), and the demo site for
Jitsi uses `meet.jit.si` (also free).

Once you've applied the config change, refresh Element and press the call button. This
should start a new conference on your Jitsi server. 

**Note**: The widget URL will point to a `jitsi.html` page hosted by Element. The Jitsi
domain will appear later in the URL as a configuration parameter.

**Hint**: If you want everyone on your homeserver to use the same Jitsi server by
default, and you are using element-web 1.6 or newer, set the following on your homeserver's 
`/.well-known/matrix/client` config:
```json
{
  "im.vector.riot.jitsi": {
    "preferredDomain": "your.jitsi.example.org"
  }
}
```

## Element Android

Element Android (1.0.5+) supports custom Jitsi domains, similar to Element Web above.

1:1 calls, or calls between you and one other person, do not use Jitsi. Instead, those
calls work directly between clients or via TURN servers configured on the respective 
homeservers.

For rooms with more than 2 joined members, when creating a Jitsi conference via call/video buttons of the toolbar (not via integration manager), Element Android will create a widget using the [wrapper](https://github.com/vector-im/element-web/blob/develop/docs/jitsi-dev.md) hosted on `app.element.io`.
The domain used is the one specified by the `/.well-known/matrix/client` endpoint, and if not present it uses the fallback defined in `config.xml` (jitsi.riot.im)

For active Jitsi widgets in the room, a native Jitsi widget UI is created and points to the instance specified in the `domain` key of the widget content data.

Element Android manages allowed native widgets permissions a bit differently than web widgets (as the data shared are different and never shared with the widget URL). For Jitsi widgets, permissions are requested only once per domain (consent saved in account data).

## Element iOS

Currently the Element mobile apps do not support custom Jitsi servers and will instead
use the default `jitsi.riot.im` server. When users on the mobile apps join the call,
they will be joining a different conference which has the same name, but not the same
participants. This is a known bug and which needs to be fixed.
