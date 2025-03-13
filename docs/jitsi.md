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

You can host your own Jitsi server to use with Element. It's usually advisable to use a recent
version of Jitsi. In particular, versions older than around 6826 will cause problems with
Element 1.9.10 or newer.

Element will use the Jitsi server that is embedded in the widget, even if it is not the
one you configured. This is because conference calls must be held on a single Jitsi
server and cannot be split over multiple servers.

However, you can configure Element to _start_ a conference with your Jitsi server by adding
to your [config](./config.md) the following:

```json
{
    "jitsi": {
        "preferred_domain": "your.jitsi.example.org"
    }
}
```

Element's default is `meet.element.io` (a free service offered by Element). `meet.jit.si`
is an instance hosted by Jitsi themselves and is also free to use.

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

For rooms with more than 2 joined members, when creating a Jitsi conference via call/video buttons of the toolbar (not via integration manager), Element Android will create a widget using the [wrapper](https://github.com/element-hq/element-web/blob/develop/docs/jitsi-dev.md) hosted on `app.element.io`.
The domain used is the one specified by the `/.well-known/matrix/client` endpoint, and if not present it uses the fallback defined in `config.json` (meet.element.io)

For active Jitsi widgets in the room, a native Jitsi widget UI is created and points to the instance specified in the `domain` key of the widget content data.

Element Android manages allowed native widgets permissions a bit differently than web widgets (as the data shared are different and never shared with the widget URL). For Jitsi widgets, permissions are requested only once per domain (consent saved in account data).

# Jitsi Wrapper

**Note**: These are developer docs. Please consult your client's documentation for
instructions on setting up Jitsi.

The react-sdk wraps all Jitsi call widgets in a local wrapper called `jitsi.html`
which takes several parameters:

_Query string_:

- `widgetId`: The ID of the widget. This is needed for communication back to the
  react-sdk.
- `parentUrl`: The URL of the parent window. This is also needed for
  communication back to the react-sdk.

_Hash/fragment (formatted as a query string)_:

- `conferenceDomain`: The domain to connect Jitsi Meet to.
- `conferenceId`: The room or conference ID to connect Jitsi Meet to.
- `isAudioOnly`: Boolean for whether this is a voice-only conference. May not
  be present, should default to `false`.
- `startWithAudioMuted`: Boolean for whether the calls start with audio
  muted. May not be present.
- `startWithVideoMuted`: Boolean for whether the calls start with video
  muted. May not be present.
- `displayName`: The display name of the user viewing the widget. May not
  be present or could be null.
- `avatarUrl`: The HTTP(S) URL for the avatar of the user viewing the widget. May
  not be present or could be null.
- `userId`: The MXID of the user viewing the widget. May not be present or could
  be null.

The react-sdk will assume that `jitsi.html` is at the path of wherever it is currently
being served. For example, `https://develop.element.io/jitsi.html` or `vector://webapp/jitsi.html`.

The `jitsi.html` wrapper can use the react-sdk's `WidgetApi` to communicate, making
it easier to actually implement the feature.
