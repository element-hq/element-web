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
the `develop` branches of these libraries and then use `ln -s` to tell Vector
about them:

[Be aware that there may be problems with this process under npm version 3.]

First clone and build `matrix-js-sdk`:

1. `git clone git@github.com:matrix-org/matrix-js-sdk.git`
1. `pushd matrix-js-sdk`
1. `git checkout develop`
1. `npm install`
1. `npm install source-map-loader` # because webpack is made of fail
1. `popd`

Then similarly with `matrix-react-sdk`:

1. `git clone git@github.com:matrix-org/matrix-react-sdk.git`
2. `pushd matrix-react-sdk`
3. `git checkout develop`
4. `npm install`
5. `rm -r node_modules/matrix-js-sdk; ln -s ../../matrix-js-sdk node_modules/`
6. `popd`

Finally, build and start vector itself:

1. `git clone git@github.com:vector-im/vector-web.git`
1. `cd vector-web`
1. `git checkout develop`
1. `npm install`
1. `rm -r node_modules/matrix-js-sdk; ln -s ../../matrix-js-sdk node_modules/`
1. `rm -r node_modules/matrix-react-sdk; ln -s ../../matrix-react-sdk node_modules/`
1. `npm start`
1. Wait a few seconds for the initial build to finish; you should see something like:

    ```
    Hash: b0af76309dd56d7275c8
    Version: webpack 1.12.14
    Time: 14533ms
             Asset     Size  Chunks             Chunk Names
         bundle.js   4.2 MB       0  [emitted]  main
        bundle.css  91.5 kB       0  [emitted]  main
     bundle.js.map  5.29 MB       0  [emitted]  main
    bundle.css.map   116 kB       0  [emitted]  main
        + 1013 hidden modules
    ```
1. Open http://127.0.0.1:8080/ in your browser to see your newly built Vector.

When you make changes to `matrix-js-sdk` or `matrix-react-sdk`, you will need
to run `npm run build` in the relevant directory. You can do this automatically
by instead running `npm start` in each directory, to start a development
builder which will watch for changes to the files and rebuild automatically.

If you add or remove any components from the Vector skin, you will need to rebuild
the skin's index by running, `npm run reskindex`.

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
