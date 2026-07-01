/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, ipcMain } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Decode HEIC/HEIF using the macOS Image I/O framework (Apple's licensed HEVC decoder) via the
// bundled `heic-decode` helper binary (see native/heic-decode/). We pipe the HEIC in over stdin and
// read the JPEG back over stdout — entirely in memory, so no decrypted plaintext ever touches disk,
// which matters for end-to-end-encrypted media. Only registered on macOS; where this decoder is absent
// (other platforms, or a decode failure) the renderer leaves HEIC as a file attachment — Element bundles
// no software HEIC decoder, so decoding is delegated entirely to the OS.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A wedged decode shouldn't leave a child process (and the caller's spinner) hanging forever. This is the
// process-side backstop; the renderer applies its own timeout of the same duration (HEIC_DECODE_TIMEOUT_MS
// in apps/web/src/utils/heic.ts) — keep the two in sync.
const HEIC_HELPER_TIMEOUT_MS = 30_000;

function helperPath(): string {
    // Packaged: copied into the app's Resources via electron-builder `extraResources`.
    // Dev/source checkout: built in place next to its source by native/heic-decode/build.sh.
    return app.isPackaged
        ? path.join(process.resourcesPath, "heic-decode")
        : path.join(__dirname, "..", "native", "heic-decode", "heic-decode");
}

function decodeViaHelper(bytes: Uint8Array): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const child = spawn(helperPath(), [], { stdio: ["pipe", "pipe", "pipe"] });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];

        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error(`heic-decode timed out after ${HEIC_HELPER_TIMEOUT_MS}ms`));
        }, HEIC_HELPER_TIMEOUT_MS);

        child.stdout.on("data", (d: Buffer) => stdout.push(d));
        child.stderr.on("data", (d: Buffer) => stderr.push(d));
        child.on("error", (e) => {
            clearTimeout(timer);
            reject(e);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) {
                resolve(Buffer.concat(stdout));
            } else {
                reject(new Error(`heic-decode exited ${code}: ${Buffer.concat(stderr).toString().trim()}`));
            }
        });

        // Ignore EPIPE if the child dies before we finish writing its input.
        child.stdin.on("error", () => {});
        child.stdin.end(bytes);
    });
}

if (process.platform === "darwin") {
    ipcMain.handle("decodeHeic", async (_ev, bytes: Uint8Array): Promise<Uint8Array> => {
        return decodeViaHelper(bytes);
    });
}
