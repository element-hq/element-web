Vector/Web
==========

Vector is a Matrix web client built using the Matrix React SDK (https://github.com/matrix-org/matrix-react-sdk).

Getting started
===============

1. Install or update `node.js` so that your `npm` is at least at version `2.0.0`
2. Clone the repo: `git clone https://github.com/vector-im/vector-web.git` 
3. Switch to the SDK directory: `cd vector-web`
4. Install the prerequisites: `npm install`
5. Start the development builder and a testing server: `npm start`
6. Wait a few seconds for the initial build to finish.
7. Open http://127.0.0.1:8080/ in your browser to see your newly built Vector.

With `npm start`, any changes you make to the source files will cause a rebuild so
your changes will show up when you refresh. This development server also disables
caching, so do NOT use it in production.

For production use, run `npm run build` to build all the necessary files
into the `vector` directory and run your own server.

Development
===========

For simple tweaks, you can work on any of the source files within Vector with the
setup above, and your changes will cause an instant rebuild.

However, all serious development on Vector happens on the `develop` branch.  This typically
depends on the `develop` snapshot versions of `matrix-react-sdk` and `matrix-js-sdk`
too, which isn't handled by Vector's `package.json`.  To get the right dependencies, check out
the `develop` branches of these libraries and then use `npm link` to tell Vector
about them:

1. `git clone git@github.com:matrix-org/matrix-react-sdk.git`
2. `cd matrix-react-sdk`
3. `git checkout develop`
4. `npm install`
5. `npm run build`
6. `npm start` (to start the dev rebuilder)
7. `cd ../vector-web`
8. Link the react sdk package into the example:
   `npm link path/to/your/react/sdk`

Similarly, you may need to `npm link path/to/your/js/sdk` in your `matrix-react-sdk`
directory.

If you add or remove any components from the Vector skin, you will need to rebuild
the skin's index by running, `npm run reskindex`.

You may need to run `npm i source-map-loader` in matrix-js-sdk if you get errors
about "Cannot resolve module 'source-map-loader'" due to shortcomings in webpack.

Deployment
==========

Just run `npm run build` and then mount the `vector` directory on your webserver to
actually serve up the app, which is entirely static content.

Enabling encryption
===================

End-to-end encryption in Vector and Matrix is not yet considered ready for
day-to-day use; it is experimental and should be considered only as a
proof-of-concept. See https://matrix.org/jira/browse/SPEC-162 for an overview
of the current progress.

To build a version of vector with support for end-to-end encryption, install
the olm module with `npm i https://matrix.org/packages/npm/olm/olm-0.1.0.tgz`
before running `npm start`. The olm library will be detected and used if
available.

To enable encryption for a room, type

```
/encrypt on
```

in the message bar in that room. Vector will then generate a set of keys, and
encrypt all outgoing messages in that room. (Note that other people in that
room will send messages in the clear unless they also `/encrypt on`.)

Note that historical encrypted messages cannot currently be decoded - history
is therefore lost when the page is reloaded.

There is currently no visual indication of whether encryption is enabled for a
room, or whether a particular message was encrypted.
