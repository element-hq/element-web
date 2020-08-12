# Jitsi Wrapper

**Note**: These are developer docs. Please consult your client's documentation for
instructions on setting up Jitsi.

The react-sdk wraps all Jitsi call widgets in a local wrapper called `jitsi.html`
which takes several parameters:

*Query string*:
* `widgetId`: The ID of the widget. This is needed for communication back to the 
  react-sdk.
* `parentUrl`: The URL of the parent window. This is also needed for
  communication back to the react-sdk.

*Hash/fragment (formatted as a query string)*:
* `conferenceDomain`: The domain to connect Jitsi Meet to.
* `conferenceId`: The room or conference ID to connect Jitsi Meet to.
* `isAudioOnly`: Boolean for whether this is a voice-only conference. May not
  be present, should default to `false`.
* `displayName`: The display name of the user viewing the widget. May not
  be present or could be null.
* `avatarUrl`: The HTTP(S) URL for the avatar of the user viewing the widget. May
  not be present or could be null.
* `userId`: The MXID of the user viewing the widget. May not be present or could
  be null.

The react-sdk will assume that `jitsi.html` is at the path of wherever it is currently
being served. For example, `https://develop.element.io/jitsi.html` or `vector://webapp/jitsi.html`.

The `jitsi.html` wrapper can use the react-sdk's `WidgetApi` to communicate, making
it easier to actually implement the feature.
