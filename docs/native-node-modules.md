# Native Node Modules

For some features, the desktop version of Riot can make use of native Node
modules. These allow Riot to integrate with the desktop in ways that a browser
cannot.

While handy, these modules must be compiled and are thus downloaded
pre-compiled during build so that a single OS can compile Riot for all
platforms. If you would like to compile the native node modules from source,
as is done for Riot releases, instead of trusting binaries hosted on npm,
then please read on.

Do note that compiling a module for a particular operating system
(Linux/Mac/Windows) and will need to be done on that operating system.

## Adding Seshat support

Seshat is a native node library that adds support for local event indexing and
full text search in E2E encrypted rooms.

Since Seshat is written in rust the rust compiler and cargo tool-chain need to be
installed before installing Seshat itself. After installing the compiler Seshat
support can be added using yarn inside the `electron_app/` directory:

    yarn add matrix-seshat

After this is done the electron version of riot can be run from the main folder
as usual using:

    yarn electron

If for some reason recompilation of Seshat is needed, e.g. when using a
development version of Seshat using `yarn link`, or if the initial compilation was
done for the wrong electron version, Seshat can be recompiled with the
`electron-build-env` tool. Again from the `electron_app/` directory:

    yarn add electron-build-env

Recompiling Seshat itself can be done like so:

    yarn run electron-build-env -- --electron 6.1.1 -- neon build matrix-seshat --release`

Please make sure to include all the `--` as well as the `--release` command line
switch at the end. Modify your electron version accordingly depending on the
version that is installed on your system.
