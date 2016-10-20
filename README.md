Riot
====

Riot (formerly known as Vector) is a Matrix web client built using the Matrix
React SDK (https://github.com/matrix-org/matrix-react-sdk).

Getting Started
===============

The easiest way to test Riot is to just use the hosted copy at
https://riot.im/app.  The develop branch is continuously deployed by Jenkins at
https://riot.im/develop for those who like living dangerously.

To host your own copy of Riot, the quickest bet is to use a pre-built
released version of Riot:

1. Download the latest version from https://vector.im/packages/
1. Untar the tarball on your web server
1. Move (or symlink) the vector-x.x.x directory to an appropriate name
1. If desired, copy `config.sample.json` to `config.json` and edit it
   as desired. See below for details.
1. Enter the URL into your browser and log into Riot!

Important Security Note
=======================

We do not recommend running Riot from the same domain name as your Matrix
homeserver.  The reason is the risk of XSS (cross-site-scripting)
vulnerabilities that could occur if someone caused Riot to load and render
malicious user generated content from a Matrix API which then had trusted
access to Riot (or other apps) due to sharing the same domain.

We have put some coarse mitigations into place to try to protect against this
situation, but it's still not good practice to do it in the first place.  See
https://github.com/vector-im/vector-web/issues/1977 for more details.

Building From Source
====================

Riot is a modular webapp built with modern ES6 and requires a npm build system
to build.

1. Install or update `node.js` so that your `npm` is at least at version `2.0.0`
1. Clone the repo: `git clone https://github.com/vector-im/vector-web.git`
1. Switch to the vector-web directory: `cd vector-web`
1. Install the prerequisites: `npm install`
1. If you are using the `develop` branch of vector-web, you will probably need
   to rebuild one of the dependencies, due to
   https://github.com/npm/npm/issues/3055: `(cd node_modules/matrix-react-sdk
   && npm install)`
1. Configure the app by copying `config.sample.json` to `config.json` and
   modifying it (see below for details)
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

You can configure the app by copying `vector/config.sample.json` to
`vector/config.json` and customising it:

1. `default_hs_url` is the default home server url.
1. `default_is_url` is the default identity server url (this is the server used
   for verifying third party identifiers like email addresses). If this is blank,
   registering with an email address, adding an email address to your account,
   or inviting users via email address will not work.  Matrix identity servers are
   very simple web services which map third party identifiers (currently only email
   addresses) to matrix IDs: see http://matrix.org/docs/spec/identity_service/unstable.html
   for more details.  Currently the only public matrix identity servers are https://matrix.org
   and https://vector.im.  In future identity servers will be decentralised.
1. `roomDirectory`: config for the public room directory. This section encodes behaviour
   on the room directory screen for filtering the list by server / network type and joining
   third party networks. This config section will disappear once APIs are available to
   get this information for home servers. This section is optional.
1. `roomDirectory.servers`: List of other Home Servers' directories to include in the drop
   down list. Optional.
1. `roomDirectory.serverConfig`: Config for each server in `roomDirectory.servers`. Optional.
1. `roomDirectory.serverConfig.<server_name>.networks`: List of networks (named
   in `roomDirectory.networks`) to include for this server. Optional.
1. `roomDirectory.networks`: config for each network type. Optional.
1. `roomDirectory.<network_type>.name`: Human-readable name for the network. Required.
1. `roomDirectory.<network_type>.protocol`: Protocol as given by the server in
   `/_matrix/client/unstable/thirdparty/protocols` response. Required to be able to join
   this type of third party network.
1. `roomDirectory.<network_type>.domain`: Domain as given by the server in
   `/_matrix/client/unstable/thirdparty/protocols` response, if present. Required to be
   able to join this type of third party network, if present in `thirdparty/protocols`.
1. `roomDirectory.<network_type>.portalRoomPattern`: Regular expression matching aliases
   for portal rooms to locations on this network. Required.
1. `roomDirectory.<network_type>.icon`: URL to an icon to be displayed for this network. Required.
1. `roomDirectory.<network_type>.example`: Textual example of a location on this network,
   eg. '#channel' for an IRC network. Optional.
1. `roomDirectory.<network_type>.nativePattern`: Regular expression that matches a
   valid location on this network. This is used as a hint to the user to indicate
   when a valid location has been entered so it's not necessary for this to be
   exactly correct. Optional.

Running as a Desktop app
========================

In future we'll do an official distribution of Riot as an desktop app.  Meanwhile,
there are a few options:

@asdf:matrix.org points out that you can use nativefier and it just works(tm):

```
sudo npm install nativefier -g
nativefier https://riot.im/app/
```

krisa has a dedicated electron project at https://github.com/krisak/vector-electron-desktop
(although you should swap out the 'vector' folder for the latest vector tarball you want to run.
Get a tarball from https://vector.im/packages or build your own - see Building From Source
above).

There's also a (much) older electron distribution at https://github.com/stevenhammerton/vector-desktop


Development
===========

Before attempting to develop on Ruit you **must** read the developer guide
for `matrix-react-sdk` at https://github.com/matrix-org/matrix-react-sdk, which
also defines the design, architecture and style for Riot too.

The idea of Riot is to be a relatively lightweight "skin" of customisations on
top of the underlying `matrix-react-sdk`. `matrix-react-sdk` provides both the
higher and lower level React components useful for building Matrix communication
apps using React.

After creating a new component you must run `npm run reskindex` to regenerate
the `component-index.js` for the app (used in future for skinning)

**However, as of July 2016 this layering abstraction is broken due to rapid
development on Riot forcing `matrix-react-sdk` to move fast at the expense of
maintaining a clear abstraction between the two.**  Hacking on Riot inevitably
means hacking equally on `matrix-react-sdk`, and there are bits of
`matrix-react-sdk` behaviour incorrectly residing in the `vector-web` project
(e.g. matrix-react-sdk specific CSS), and a bunch of Riot specific behaviour
in the `matrix-react-sdk` (grep for `vector` / `riot`).  This separation problem will be
solved asap once development on Riot (and thus matrix-react-sdk) has
stabilised.  Until then, the two projects should basically be considered as a
single unit.  In particular, `matrix-react-sdk` issues are currently filed
against `vector-web` in github.

Please note that Riot is intended to run correctly without access to the public
internet.  So please don't depend on resources (JS libs, CSS, images, fonts)
hosted by external CDNs or servers but instead please package all dependencies
into Riot itself.

Setting up a dev environment
============================

Much of the functionality in Riot is actually in the `matrix-react-sdk` and
`matrix-js-sdk` modules. It is possible to set these up in a way that makes it
easy to track the `develop` branches in git and to make local changes without
having to manually rebuild each time.

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

Finally, build and start Riot itself:

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
1. Open http://127.0.0.1:8080/ in your browser to see your newly built Riot.

When you make changes to `matrix-react-sdk`, you will need to run `npm run
build` in the relevant directory. You can do this automatically by instead
running `npm start` in the directory, to start a development builder which
will watch for changes to the files and rebuild automatically.

If you add or remove any components from the Riot skin, you will need to rebuild
the skin's index by running, `npm run reskindex`.

If any of these steps error with, `file table overflow`, you are probably on a mac
which has a very low limit on max open files. Run `ulimit -Sn 1024` and try again.
You'll need to do this in each new terminal you open before building Riot.

Filing issues
=============

All issues for Vector-web and Matrix-react-sdk should be filed at
https://github.com/matrix-org/matrix-react-sdk/issues

Triaging issues
===============

Issues will be triaged by the core team using the following primary set of tags:

priority:
    P1: top priority; typically blocks releases.
    P2: one below that
    P3: non-urgent
    P4/P5: bluesky some day, who knows.

bug or feature:
  bug severity:
     * cosmetic - feature works functionally but UI/UX is broken.
     * critical - whole app doesn't work
     * major - entire feature doesn't work
     * minor - partially broken feature (but still usable)

     * release blocker

     * ui/ux (think of this as cosmetic)

     * network (specific to network conditions)
     * platform (platform specific)
