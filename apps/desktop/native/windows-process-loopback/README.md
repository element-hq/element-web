# Windows process-loopback helper

This x64 Windows helper is the native producer for isolated screen-share audio.
It supports only a compatibility probe, Electron window-source resolution, and
the versioned 48 kHz stereo PCM16 streaming protocol consumed by Element
Desktop. A streaming process accepts `STOP` on standard input for bounded
shutdown.

Run `node build.mjs` from this directory to produce the ignored executable at
`build/windows-x64/windows-process-loopback.exe`. Windows packages place that
file at `resources/screen-share-audio/windows-process-loopback.exe`, outside the
application ASAR.
