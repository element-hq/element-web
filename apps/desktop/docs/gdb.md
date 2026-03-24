# Using gdb against Element-Desktop

Occasionally it is useful to be able to connect to a running Element-Desktop
with [`gdb`](https://sourceware.org/gdb/), or to analayze a coredump. For this,
you will need debug symbols.

1. If you don't already have the right version of Element-Desktop (eg because
   you are analyzing someone else's coredump), download and unpack the tarball
   from https://packages.element.io/desktop/install/linux/. If it was a
   nightly, your best bet may be to download the deb from
   https://packages.element.io/debian/pool/main/e/element-nightly/ and unpack
   it.
2. Figure out which version of Electron your Element-Desktop is based on. The
   best way to do this is to figure out the version of Element-Desktop, then
   look at
   [`package.json`](https://github.com/element-hq/element-desktop/blob/develop/package.json)
   for the corresponding version. There will be an entry within `dependencies` of
   `electron`: the value will tell you the version of Electron that was used for that version of Element-Desktop.

3. Go to [Electron's releases page](https://github.com/electron/electron/releases/)
   and find the version you just identified. Under "Assets", download
   `electron-v<version>-linux-x64-debug.zip` (or, the -debug zip corresponding to your
   architecture).

4. The debug zip has a structure like:

    ```
    .
    ├── debug
    │   ├── chrome_crashpad_handler.debug
    │   ├── electron.debug
    │   ├── libEGL.so.debug
    │   ├── libffmpeg.so.debug
    │   ├── libGLESv2.so.debug
    │   └── libvk_swiftshader.so.debug
    ├── LICENSE
    ├── LICENSES.chromium.html
    └── version
    ```

    Take all the contents of `debug`, and copy them into the Element-Desktop directory,
    so that `electron.debug` is alongside the `element-desktop-nightly` executable.

5. You now have a thing you can gdb as normal, either as `gdb --args element-desktop-nightly`, or
   `gdb element-desktop-nightly core`.
