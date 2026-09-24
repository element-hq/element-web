# Windows

## Requirements to build

We rely on Github Actions `windows-2025` as per [the workflow](https://github.com/element-hq/element-web/blob/develop/.github/workflows/build_desktop_windows.yaml).

If you want to build Element Desktop on Windows, make sure that the following tools are installed on your system.

- [Git for Windows](https://git-scm.com/download/win)
- [Node](https://nodejs.org) (see `apps/desktop/.node-version` for the version we build with)
- [pnpm](https://pnpm.io/installation)

You can install the above tools using [Chocolatey](https://chocolatey.org/install):

```cmd
choco install --no-progress -y git nodejs-lts pnpm
```

Once installed make sure all those utilities are accessible in your `PATH`.

Native modules are consumed as prebuilt binaries, so no compiler toolchain is required.
See [native-node-modules.md](./native-node-modules.md) for details, including how to
build the arm64 package from an x64 host.
