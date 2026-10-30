/*
Copyright 2026 foxberries

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// This file defines the main side of the Audiofox IPC API for audio source enumeration
// and capture. It ultimately enables the transmission of audio with a MediaStream returned
// by the Screen Capture API when running on a compatible platform (Electron + Audiofox).

import { ipcMain } from "electron";
import type { Audiofox, AudioManager, AudioSources, LinkHandle } from "@foxberries/audiofox";

/**
 * Frames per `Chunk` to request from {@link AudioManager.link|`link()`}.
 *
 * This is set to match `RENDER_QUANTUM` as defined in `AudiofoxWorklet`,
 * which is the recommended configuration for real-time audio.
 *
 * This value is not exposed over IPC.
 */
const FRAMES = 128;

// Load the native module
ipcMain.handleOnce("audiofox", async () => {
    await import("@foxberries/audiofox")
        .then(async (module) => {
            console.log("Audiofox native module loaded successfully");
            await start(module.default);
        })
        .catch(() => {
            // The error thrown by napi-rs is misleading, so replace it with our own.
            // Loading should only fail:
            // 1. On Linux, if libpipewire-0.3 could not be found
            // 2. On macOS, if the arch is not aarch64 (as of v1.1.0)
            // 3. On Windows, if the arch is not x64 (as of v1.1.0)
            const suffix = process.platform === "linux" ? "PipeWire could not be found" : "unsupported platform";
            throw new Error(`Failed to load Audiofox native module: ${suffix}`);
        });
});

/**
 * Audiofox IPC equivalent of {@link Audiofox.start|`start()`}. Unlike the standard API,
 * it restricts the creation of more than one `AudioManager`.
 */
async function start(audiofox: Audiofox): Promise<void> {
    ipcMain.handleOnce("audiofox:start", async () => {
        // Nullable to clear invalid ref; never otherwise null
        let manager: AudioManager | null = audiofox.start();

        ipcMain.handle("audiofox:list", () => {
            return manager!.list();
        });

        await link(manager);

        ipcMain.once("audiofox:stop", async () => {
            manager!.stop();
            manager = null; // Clear invalid reference
            ipcMain.removeHandler("audiofox:list");
            ipcMain.removeHandler("audiofox:link");
            await start(audiofox); // Re-register start()
        });
    });
}

/**
 * Audiofox IPC equivalent of {@link AudioManager|`link()`}. Unlike the standard API,
 * it restricts the creation of more than one `LinkHandle`.
 */
async function link(manager: AudioManager): Promise<void> {
    ipcMain.handleOnce("audiofox:link", (_event: Electron.IpcMainInvokeEvent, sources: AudioSources) => {
        const window = global.mainWindow?.webContents;
        if (window) {
            // Nullable to clear invalid ref; never otherwise null
            let handle: LinkHandle | null = manager.link(
                sources,
                (chunk) => window.send("audiofox:chunk", chunk),
                FRAMES,
            );

            ipcMain.once("audiofox:unlink", async () => {
                handle!.unlink();
                handle = null; // Clear invalid reference
                await link(manager); // Re-register link()
            });
        }
    });
}
