# Native Node Modules

For some features, the desktop version of Riot can make use of native Node
modules. These allow Riot to integrate with the desktop in ways that a browser
cannot.

While native modules enable powerful new features, they must be complied for
each operating system. For official Riot releases, we will always build these
modules from source to ensure we can trust the compiled output. In the future,
we may offer a pre-compiled path for those who want to use these features in a
custom build of Riot without installing the various build tools required.

Do note that compiling a module for a particular operating system
(Linux/macOS/Windows) will need to be done on that operating system.
Cross-compiling from a host OS for a different target OS may be possible, but
we don't support this flow with Riot dependencies at this time.

At the moment, we need to make some changes to the Riot release process before
we can support native Node modules at release time, so these features are
currently disabled by default until that is resolved. The following sections
explain the manual steps you can use with a custom build of Riot to enable
these features if you'd like to try them out.

## Adding Seshat for search in E2E encrypted rooms

Seshat is a native Node module that adds support for local event indexing and
full text search in E2E encrypted rooms.

Since Seshat is written in Rust, the Rust compiler and related tools need to be
installed before installing Seshat itself. To install Rust please consult the
official Rust [documentation](https://www.rust-lang.org/tools/install).

Seshat also depends on the SQLCipher library to store its data in encrypted form
on disk. You'll need to install it via your OS package manager.

After installing the Rust compiler and SQLCipher, Seshat support can be added
using yarn inside the `electron_app/` directory:

    yarn add matrix-seshat

You will have to rebuild the native libraries against electron's version of
of node rather than your system node, using the `electron-build-env` tool.
This is also needed to when pulling in changes to Seshat using `yarn link`.
Again from the `electron_app/` directory:

    yarn add electron-build-env

Recompiling Seshat itself can be done like so:

    yarn run electron-build-env -- --electron 6.1.1 -- neon build matrix-seshat --release

Please make sure to include all the `--` as well as the `--release` command line
switch at the end. Modify your electron version accordingly depending on the
version that is installed on your system.

After this is done the Electron version of Riot can be run from the main folder
as usual using:

    yarn electron

