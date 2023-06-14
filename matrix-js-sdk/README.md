[![npm](https://img.shields.io/npm/v/matrix-js-sdk)](https://www.npmjs.com/package/matrix-js-sdk)
![Tests](https://github.com/matrix-org/matrix-js-sdk/actions/workflows/tests.yml/badge.svg)
![Static Analysis](https://github.com/matrix-org/matrix-js-sdk/actions/workflows/static_analysis.yml/badge.svg)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=matrix-js-sdk&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=matrix-js-sdk)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=matrix-js-sdk&metric=coverage)](https://sonarcloud.io/summary/new_code?id=matrix-js-sdk)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=matrix-js-sdk&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=matrix-js-sdk)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=matrix-js-sdk&metric=bugs)](https://sonarcloud.io/summary/new_code?id=matrix-js-sdk)

# Matrix JavaScript SDK

This is the [Matrix](https://matrix.org) Client-Server SDK for JavaScript and TypeScript. This SDK can be run in a
browser or in Node.js.

The Matrix specification is constantly evolving - while this SDK aims for maximum backwards compatibility, it only
guarantees that a feature will be supported for at least 4 spec releases. For example, if a feature the js-sdk supports
is removed in v1.4 then the feature is _eligible_ for removal from the SDK when v1.8 is released. This SDK has no
guarantee on implementing all features of any particular spec release, currently. This can mean that the SDK will call
endpoints from before Matrix 1.1, for example.

# Quickstart

## In a browser

Download the browser version from
https://github.com/matrix-org/matrix-js-sdk/releases/latest and add that as a
`<script>` to your page. There will be a global variable `matrixcs`
attached to `window` through which you can access the SDK. See below for how to
include libolm to enable end-to-end-encryption.

The browser bundle supports recent versions of browsers. Typically this is ES2015
or `> 0.5%, last 2 versions, Firefox ESR, not dead` if using
[browserlists](https://github.com/browserslist/browserslist).

Please check [the working browser example](examples/browser) for more information.

## In Node.js

Ensure you have the latest LTS version of Node.js installed.
This library relies on `fetch` which is available in Node from v18.0.0 - it should work fine also with polyfills.
If you wish to use a ponyfill or adapter of some sort then pass it as `fetchFn` to the MatrixClient constructor options.

Using `yarn` instead of `npm` is recommended. Please see the Yarn [install guide](https://classic.yarnpkg.com/en/docs/install)
if you do not have it already.

`yarn add matrix-js-sdk`

```javascript
import * as sdk from "matrix-js-sdk";
const client = sdk.createClient({ baseUrl: "https://matrix.org" });
client.publicRooms(function (err, data) {
    console.log("Public Rooms: %s", JSON.stringify(data));
});
```

See below for how to include libolm to enable end-to-end-encryption. Please check
[the Node.js terminal app](examples/node) for a more complex example.

You can also use the sdk with [Deno](https://deno.land/) (`import npm:matrix-js-sdk`) but its not officialy supported.

To start the client:

```javascript
await client.startClient({ initialSyncLimit: 10 });
```

You can perform a call to `/sync` to get the current state of the client:

```javascript
client.once("sync", function (state, prevState, res) {
    if (state === "PREPARED") {
        console.log("prepared");
    } else {
        console.log(state);
        process.exit(1);
    }
});
```

To send a message:

```javascript
const content = {
    body: "message text",
    msgtype: "m.text",
};
client.sendEvent("roomId", "m.room.message", content, "", (err, res) => {
    console.log(err);
});
```

To listen for message events:

```javascript
client.on("Room.timeline", function (event, room, toStartOfTimeline) {
    if (event.getType() !== "m.room.message") {
        return; // only use messages
    }
    console.log(event.event.content.body);
});
```

By default, the `matrix-js-sdk` client uses the `MemoryStore` to store events as they are received. For example to iterate through the currently stored timeline for a room:

```javascript
Object.keys(client.store.rooms).forEach((roomId) => {
    client.getRoom(roomId).timeline.forEach((t) => {
        console.log(t.event);
    });
});
```

## What does this SDK do?

This SDK provides a full object model around the Matrix Client-Server API and emits
events for incoming data and state changes. Aside from wrapping the HTTP API, it:

-   Handles syncing (via `/initialSync` and `/events`)
-   Handles the generation of "friendly" room and member names.
-   Handles historical `RoomMember` information (e.g. display names).
-   Manages room member state across multiple events (e.g. it handles typing, power
    levels and membership changes).
-   Exposes high-level objects like `Rooms`, `RoomState`, `RoomMembers` and `Users`
    which can be listened to for things like name changes, new messages, membership
    changes, presence changes, and more.
-   Handle "local echo" of messages sent using the SDK. This means that messages
    that have just been sent will appear in the timeline as 'sending', until it
    completes. This is beneficial because it prevents there being a gap between
    hitting the send button and having the "remote echo" arrive.
-   Mark messages which failed to send as not sent.
-   Automatically retry requests to send messages due to network errors.
-   Automatically retry requests to send messages due to rate limiting errors.
-   Handle queueing of messages.
-   Handles pagination.
-   Handle assigning push actions for events.
-   Handles room initial sync on accepting invites.
-   Handles WebRTC calling.

Later versions of the SDK will:

-   Expose a `RoomSummary` which would be suitable for a recents page.
-   Provide different pluggable storage layers (e.g. local storage, database-backed)

# Usage

## Conventions

### Emitted events

The SDK will emit events using an `EventEmitter`. It also
emits object models (e.g. `Rooms`, `RoomMembers`) when they
are updated.

```javascript
// Listen for low-level MatrixEvents
client.on("event", function (event) {
    console.log(event.getType());
});

// Listen for typing changes
client.on("RoomMember.typing", function (event, member) {
    if (member.typing) {
        console.log(member.name + " is typing...");
    } else {
        console.log(member.name + " stopped typing.");
    }
});

// start the client to setup the connection to the server
client.startClient();
```

### Promises and Callbacks

Most of the methods in the SDK are asynchronous: they do not directly return a
result, but instead return a [Promise](http://documentup.com/kriskowal/q/)
which will be fulfilled in the future.

The typical usage is something like:

```javascript
  matrixClient.someMethod(arg1, arg2).then(function(result) {
    ...
  });
```

Alternatively, if you have a Node.js-style `callback(err, result)` function,
you can pass the result of the promise into it with something like:

```javascript
matrixClient.someMethod(arg1, arg2).nodeify(callback);
```

The main thing to note is that it is problematic to discard the result of a
promise-returning function, as that will cause exceptions to go unobserved.

Methods which return a promise show this in their documentation.

Many methods in the SDK support _both_ Node.js-style callbacks _and_ Promises,
via an optional `callback` argument. The callback support is now deprecated:
new methods do not include a `callback` argument, and in the future it may be
removed from existing methods.

## Examples

This section provides some useful code snippets which demonstrate the
core functionality of the SDK. These examples assume the SDK is setup like this:

```javascript
import * as sdk from "matrix-js-sdk";
const myUserId = "@example:localhost";
const myAccessToken = "QGV4YW1wbGU6bG9jYWxob3N0.qPEvLuYfNBjxikiCjP";
const matrixClient = sdk.createClient({
    baseUrl: "http://localhost:8008",
    accessToken: myAccessToken,
    userId: myUserId,
});
```

### Automatically join rooms when invited

```javascript
matrixClient.on("RoomMember.membership", function (event, member) {
    if (member.membership === "invite" && member.userId === myUserId) {
        matrixClient.joinRoom(member.roomId).then(function () {
            console.log("Auto-joined %s", member.roomId);
        });
    }
});

matrixClient.startClient();
```

### Print out messages for all rooms

```javascript
matrixClient.on("Room.timeline", function (event, room, toStartOfTimeline) {
    if (toStartOfTimeline) {
        return; // don't print paginated results
    }
    if (event.getType() !== "m.room.message") {
        return; // only print messages
    }
    console.log(
        // the room name will update with m.room.name events automatically
        "(%s) %s :: %s",
        room.name,
        event.getSender(),
        event.getContent().body,
    );
});

matrixClient.startClient();
```

Output:

```
  (My Room) @megan:localhost :: Hello world
  (My Room) @megan:localhost :: how are you?
  (My Room) @example:localhost :: I am good
  (My Room) @example:localhost :: change the room name
  (My New Room) @megan:localhost :: done
```

### Print out membership lists whenever they are changed

```javascript
matrixClient.on("RoomState.members", function (event, state, member) {
    const room = matrixClient.getRoom(state.roomId);
    if (!room) {
        return;
    }
    const memberList = state.getMembers();
    console.log(room.name);
    console.log(Array(room.name.length + 1).join("=")); // underline
    for (var i = 0; i < memberList.length; i++) {
        console.log("(%s) %s", memberList[i].membership, memberList[i].name);
    }
});

matrixClient.startClient();
```

Output:

```
  My Room
  =======
  (join) @example:localhost
  (leave) @alice:localhost
  (join) Bob
  (invite) @charlie:localhost
```

# API Reference

A hosted reference can be found at
http://matrix-org.github.io/matrix-js-sdk/index.html

This SDK uses [Typedoc](https://typedoc.org/guides/doccomments) doc comments. You can manually build and
host the API reference from the source files like this:

```
  $ yarn gendoc
  $ cd _docs
  $ python -m http.server 8005
```

Then visit `http://localhost:8005` to see the API docs.

# End-to-end encryption support

The SDK supports end-to-end encryption via the Olm and Megolm protocols, using
[libolm](https://gitlab.matrix.org/matrix-org/olm). It is left up to the
application to make libolm available, via the `Olm` global.

It is also necessary to call `await matrixClient.initCrypto()` after creating a new
`MatrixClient` (but **before** calling `matrixClient.startClient()`) to
initialise the crypto layer.

If the `Olm` global is not available, the SDK will show a warning, as shown
below; `initCrypto()` will also fail.

```
Unable to load crypto module: crypto will be disabled: Error: global.Olm is not defined
```

If the crypto layer is not (successfully) initialised, the SDK will continue to
work for unencrypted rooms, but it will not support the E2E parts of the Matrix
specification.

To provide the Olm library in a browser application:

-   download the transpiled libolm (from https://packages.matrix.org/npm/olm/).
-   load `olm.js` as a `<script>` _before_ `browser-matrix.js`.

To provide the Olm library in a node.js application:

-   `yarn add https://packages.matrix.org/npm/olm/olm-3.1.4.tgz`
    (replace the URL with the latest version you want to use from
    https://packages.matrix.org/npm/olm/)
-   `global.Olm = require('olm');` _before_ loading `matrix-js-sdk`.

If you want to package Olm as dependency for your node.js application, you can
use `yarn add https://packages.matrix.org/npm/olm/olm-3.1.4.tgz`. If your
application also works without e2e crypto enabled, add `--optional` to mark it
as an optional dependency.

# Contributing

_This section is for people who want to modify the SDK. If you just
want to use this SDK, skip this section._

First, you need to pull in the right build tools:

```
 $ yarn install
```

## Building

To build a browser version from scratch when developing::

```
 $ yarn build
```

To run tests (Jest):

```
 $ yarn test
```

> **Note**
> The `sync-browserify.spec.ts` requires a browser build (`yarn build`) in order to pass

To run linting:

```
 $ yarn lint
```
