Vector/Web
==========

Vector is a Matrix web client built using the Matrix React SDK (https://github.com/matrix-org/matrix-react-sdk).

Getting Started
===============
Vector is a modular webapp built with modern ES6 and requires and npm build system to build.
Instructions for building are below, but building from source shouldn't be necessary
for simple deployments.

1. Download the latest version from https://vector.im/packages/
1. Untar the tarball on your web server
1. Move (or symlink) the vector-x.x.x directory to an appropriate name
1. If desired, copy `config.sample.json` to `config.json` and edit it
   as desired. See below for details.
1. Enter the URL into your browser and log into vector!

Building From Source
====================

If you do wish to build vector from source:

1. Install or update `node.js` so that your `npm` is at least at version `2.0.0`
1. Clone the repo: `git clone https://github.com/vector-im/vector-web.git` 
1. Switch to the vector directory: `cd vector-web`
1. Install the prerequisites: `npm install`
1. If you are using the `develop` branch of vector, you will probably need to
   rebuild one of the dependencies, due to https://github.com/npm/npm/issues/3055:
   `(cd node_modules/matrix-react-sdk && npm install)`
1. Configure the app by copying `config.sample.json` to `config.json` and modifying
   it (see below for details)
1. `npm run package` to build a tarball to deploy. Untaring this file will give
   a version-specific directory containing all the files that need to go on your
   web server.

Note that `npm run package` is not supported on Windows, so Windows users can run `npm
run build`, which will build all the necessary files into the `vector`
directory. The version of Vector will not appear in Settings without
using the package script. You can then mount the vector directory on your
webserver to actually serve up the app, which is entirely static content.

config.json
===========

You can configure the app by copying the sample and modifying the `config.json` file:

1. `default_hs_url` is the default home server url.
1. `default_is_url` is the default identity server url (this is the server used
   for verifying third party identifiers like email addresses). If this is blank,
   registering with an email address or adding an email address to your account
   will not work.

Development
===========

Much of the functionality in Vector is actually in the `matrix-react-sdk` and
`matrix-js-sdk` modules. It is possible to set these up in a way that makes it
easy to track the `develop` branches in git and to make local changes without
having to manually rebuild each time.

[Be aware that there may be problems with this process under npm version 3.]

First clone and build `matrix-js-sdk`:

1. `git clone git@github.com:matrix-org/matrix-js-sdk.git`
1. `pushd matrix-js-sdk`
1. `git checkout develop`
1. `npm install`
1. `npm install source-map-loader` # because webpack is made of fail (https://github.com/webpack/webpack/issues/1472)
1. `popd`

Then similarly with `matrix-react-sdk`:

1. `git clone git@github.com:matrix-org/matrix-react-sdk.git`
1. `pushd matrix-react-sdk`
1. `git checkout develop`
1. `npm install`
1. `rm -r node_modules/matrix-js-sdk; ln -s ../../matrix-js-sdk node_modules/`
1. `popd`

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
   Remember, the command will not terminate since it runs the web server
   and rebuilds source files when they change. This development server also
   disables caching, so do NOT use it in production.
1. Open http://127.0.0.1:8080/ in your browser to see your newly built Vector.

When you make changes to `matrix-react-sdk`, you will need to run `npm run
build` in the relevant directory. You can do this automatically by instead
running `npm start` in the directory, to start a development builder which
will watch for changes to the files and rebuild automatically.

If you add or remove any components from the Vector skin, you will need to rebuild
the skin's index by running, `npm run reskindex`.

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
