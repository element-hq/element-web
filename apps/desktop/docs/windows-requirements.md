# Windows

## Requirements to build native modules

We rely on Github Actions `windows-2022` plus a few extra utilities as per [the workflow](https://github.com/vector-im/element-desktop/blob/develop/.github/workflows/build_windows.yaml).

If you want to build native modules, make sure that the following tools are installed on your system.

- [Git for Windows](https://git-scm.com/download/win)
- [Node 16](https://nodejs.org)
- [Python 3](https://www.python.org/downloads/) (if you type 'python' into command prompt it will offer to install it from the windows store)
- [Strawberry Perl](https://strawberryperl.com/)
- [Rustup](https://rustup.rs/)
- [NASM](https://www.nasm.us/)

You can install the above tools using [Chocolatey](https://chocolatey.org/install):

```cmd
choco install --no-progress -y git nodejs-lts pnpm python StrawberryPerl rustup.install nasm magicsplat-tcl-tk
```

- [Build Tools for Visual Studio 2019](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2019) with the following configuration:
    - On the Workloads tab:
        - Desktop & Mobile -> C++ build tools
    - On the Individual components tab:
        - MSVC VS 2019 C++ build tools
        - Windows 10 SDK (latest version available)
        - C++ CMake tools for Windows

Once installed make sure all those utilities are accessible in your `PATH`.

If you want to be able to build x86 targets from an x64 host install the right toolchain:

```cmd
rustup toolchain install stable-i686-pc-windows-msvc
rustup target add i686-pc-windows-msvc
```

In order to load all the C++ utilities installed by Visual Studio you can run the following in a terminal window.

```
call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" amd64
```

You can replace `amd64` with `x86` depending on your CPU architecture.
