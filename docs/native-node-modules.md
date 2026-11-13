# Native Node Modules

For some features, the desktop version of Element can make use of native Node
modules. These allow Element to integrate with the desktop in ways that a browser
cannot.

The native modules are:

- [Seshat](https://github.com/matrix-org/seshat), which adds support for local event indexing and full text
  search in E2E encrypted rooms. It ships prebuilt binaries, see below.
- [pkcs11js](https://github.com/PeculiarVentures/pkcs11js), used by the experimental X.509 identity
  verification. It is compiled from source, which needs a C++ toolchain.

pnpm does not build pkcs11js on install. electron-builder compiles it for the target platform and
architecture when packaging the app, and `pnpm start` compiles it for local development.
Without it, Element Desktop still starts but X.509 support is disabled.

## Prebuilt binaries

Seshat is consumed via the [`@matrix-org/seshat`](https://www.npmjs.com/package/@matrix-org/seshat)
npm package, which ships prebuilt binaries for every platform Element Desktop supports as
per-platform `optionalDependencies`:

| Platform | Architectures | SQLCipher |
| -------- | ------------- | --------- |
| Linux    | x64, arm64    | static    |
| macOS    | x64, arm64    | static    |
| Windows  | x64, arm64    | static    |

pnpm only installs the binary matching the machine running the install. Building for
another architecture (for example a Windows arm64 package on an x64 machine, or the macOS
universal package) needs pnpm to install the extra binaries too. This is done by adding a
[`supportedArchitectures`](https://pnpm.io/settings#supportedarchitectures) block to
`pnpm-workspace.yaml` before running `pnpm install`, for example for a macOS universal build:

```yaml
supportedArchitectures:
    os: [current] # Assuming you are on "darwin"
    cpu: [x64, arm64]
```

The CI workflows do this automatically. The electron-builder configuration prunes binaries
for other platforms and architectures from the packaged app, so only the ones needed by the
target end up in the package.

## Verifying a Linux package

The electron-builder `afterPack` hook checks every `.node` file and the main executable in the
packaged Linux app with `readelf`, to ensure they are built for the target architecture, do not
dynamically link OpenSSL or SQLCipher, and do not require a newer glibc than our oldest supported
distribution ships. Failures are fatal on CI and warnings otherwise, as local builds outside the
Docker image link against the host's glibc. If you upgrade Seshat and this check fails,
the `MAX_GLIBC` value in `apps/desktop/scripts/native-libraries.ts` documents the current ceiling.

## Building from source

Should you need to build Seshat yourself, for example for an unsupported platform or to
link against the system SQLCipher, follow the instructions in the
[Seshat repository](https://github.com/matrix-org/seshat/tree/main/seshat-node#building-from-source)
and use `pnpm link` to substitute the resulting package for `@matrix-org/seshat`.
