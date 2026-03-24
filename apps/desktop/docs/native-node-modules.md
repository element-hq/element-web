# Native Node Modules

For some features, the desktop version of Element can make use of native Node
modules. These allow Element to integrate with the desktop in ways that a browser
cannot.

While native modules enable powerful new features, they must be complied for
each operating system. For official Element releases, we will always build these
modules from source to ensure we can trust the compiled output. In the future,
we may offer a pre-compiled path for those who want to use these features in a
custom build of Element without installing the various build tools required.

The process is automated by [vector-im/element-builder](https://github.com/vector-im/element-builder)
when releasing.

## Use docker

If you are building for Linux, you can build the native modules with:

```
pnpm docker:setup
pnpm docker:install
INDOCKER_SQLCIPHER_BUNDLED=1 pnpm docker:build:native
```

The above will build `matrix-seshat` in
`docker/node_modules/matrix-seshat`. You can then either run `pnpm docker:build`
to build the app inside docker, or:

```
pnpm link docker/node_modules/matrix-seshat
```

... and build the app with `pnpm build` or run it with `pnpm start`.

(See also https://github.com/element-hq/element-desktop#docker.)

## Building

Install the pre-requisites for your system:

- [Windows pre-requisites](https://github.com/vector-im/element-desktop/blob/develop/docs/windows-requirements.md)
- Linux: TODO. Using the docker environment as above is recommended.
- OS X: TODO

Then optionally, [add seshat and dependencies to support search in E2E rooms](#adding-seshat-for-search-in-e2e-encrypted-rooms).

Then, to build for an architecture selected automatically based on your system (recommended), run:

```
pnpm run build:native
```

If you need to build for a specific architecture, see [here](#compiling-for-specific-architectures).

## Adding Seshat for search in E2E encrypted rooms

Seshat is a native Node module that adds support for local event indexing and
full text search in E2E encrypted rooms.

Since Seshat is written in Rust, the Rust compiler and related tools need to be
installed before installing Seshat itself. To install Rust please consult the
official Rust [documentation](https://www.rust-lang.org/tools/install).

Seshat also depends on the SQLCipher library to store its data in encrypted form
on disk. You'll need to install it via your OS package manager.

After installing the Rust compiler and SQLCipher, Seshat support can be added
using pnpm at the root of this project:

    pnpm add matrix-seshat

You will have to rebuild the native libraries against electron's version
of node rather than your system node, using the `electron-build-env` tool.
This is also needed to when pulling in changes to Seshat using `pnpm link`.

    pnpm add electron-build-env

Recompiling Seshat itself can be done like so:

    ELECTRON_VERSION=$(electron --version)
    pnpm electron-build-env -- --electron ${ELECTRON_VERSION#v} -- neon build matrix-seshat --release

Please make sure to include all the `--` as well as the `--release` command line
switch at the end. Modify your electron version accordingly depending on the
version that is installed on your system.

After this is done the Electron version of Element can be run from the main folder
as usual using:

    pnpm start

### Statically linking libsqlcipher

On Windows & macOS we always statically link libsqlcipher for it is not generally available.
On Linux by default we will use a system package, on debian & ubuntu this is `libsqlcipher0`,
but this is problematic for some other packages, and we found that it may crashes for unknown reasons.
By including `SQLCIPHER_BUNDLED=1` in the build environment, the build scripts will fully statically
link sqlcipher, including a static build of OpenSSL.

More info can be found at https://github.com/matrix-org/seshat/issues/102
and https://github.com/vector-im/element-web/issues/20926.

## Compiling for specific architectures

### macOS

On macOS, you can build universal native modules too:

```
pnpm run build:native:universal
```

...or you can build for a specific architecture:

```
pnpm run build:native --target x86_64-apple-darwin
```

or

```
pnpm run build:native --target aarch64-apple-darwin
```

You'll then need to create a built bundle with the same architecture.
To bundle a universal build for macOS, run:

```
pnpm run build:universal
```

### Windows

If you're on Windows, you can choose to build specifically for 32 or 64 bit:

```
pnpm run build:32
```

or

```
pnpm run build:64
```

### Cross compiling

Compiling a module for a particular operating system (Linux/macOS/Windows) needs
to be done on that operating system. Cross-compiling from a host OS for a different
target OS may be possible, but we don't support this flow with Element dependencies
at this time.

### Switching between architectures

The native module build system keeps the different architectures
separate, so you can keep native modules for several architectures at the same
time and switch which are active using a `pnpm run hak copy` command, passing
the appropriate architectures. This will error if you haven't yet built those
architectures. eg:

```
pnpm run build:native --target x86_64-apple-darwin
# We've now built & linked into place native modules for Intel
pnpm run build:native --target aarch64-apple-darwin
# We've now built Apple Silicon modules too, and linked them into place as the active ones

pnpm run hak copy --target x86_64-apple-darwin
# We've now switched back to our Intel modules
pnpm run hak copy --target x86_64-apple-darwin --target aarch64-apple-darwin
# Now our native modules are universal x86_64+aarch64 binaries
```

The current set of native modules are stored in `.hak/hakModules`,
so you can use this to check what architecture is currently in place, eg:

```
$ lipo -info .hak/hakModules/keytar/build/Release/keytar.node
Architectures in the fat file: .hak/hakModules/keytar/build/Release/keytar.node are: x86_64 arm64
```
