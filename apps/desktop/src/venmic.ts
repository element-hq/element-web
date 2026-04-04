/*
Copyright 2026 Joao Costa <me@joaocosta.dev>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, ipcMain } from "electron";
import { createRequire } from "node:module";
import { join } from "node:path";
import { existsSync } from "node:fs";

import type { LinkData, Node, PatchBay as PatchBayType } from "@vencord/venmic";
import type { VenmicListResult } from "./@types/audio-sharing.js";
export type { VenmicListResult } from "./@types/audio-sharing.js";

const nativeRequire = createRequire(import.meta.url);

let PatchBay: typeof PatchBayType | undefined;
let patchBayInstance: PatchBayType | undefined;

let imported = false;
let initialized = false;

let hasPipewirePulse = false;
let isGlibcOutdated = false;

function importVenmic(): void {
    if (imported) {
        return;
    }

    imported = true;

    try {
        // Load the native .node file from the HAK output.
        // In development: .hak/hakModules/@vencord/venmic/venmic.node (relative to project root)
        // When packaged: node_modules/@vencord/venmic/venmic.node (electron-builder copies hakModules there)
        const appPath = app.getAppPath();
        // In development, appPath points to lib/ so we need to go up to project root
        const projectRoot = appPath.endsWith("/lib") || appPath.endsWith("\\lib") ? join(appPath, "..") : appPath;

        const hakPath = join(projectRoot, ".hak", "hakModules", "@vencord", "venmic", "venmic.node");
        const packagedPath = join(projectRoot, "node_modules", "@vencord", "venmic", "venmic.node");

        const nativePath = existsSync(hakPath) ? hakPath : packagedPath;
        PatchBay = (nativeRequire(nativePath) as { PatchBay: typeof PatchBayType }).PatchBay;
        hasPipewirePulse = PatchBay.hasPipeWire();
    } catch (e: unknown) {
        const message = e instanceof Error ? (e.stack ?? e.message) : String(e);
        console.error("Failed to import venmic:", message);
        isGlibcOutdated = message.toLowerCase().includes("glibc");
    }
}

function obtainVenmic(): PatchBayType | undefined {
    if (!imported) {
        importVenmic();
    }

    if (PatchBay && !initialized) {
        initialized = true;

        try {
            patchBayInstance = new PatchBay();
        } catch (e) {
            console.error("Failed to instantiate venmic:", e);
        }
    }

    return patchBayInstance;
}

function getRendererAudioServicePid(): string {
    const audioService = app.getAppMetrics().find((proc) => proc.name === "Audio Service");
    if (!audioService) {
        console.warn("venmic: could not find Audio Service process for filtering");
    }
    return audioService?.pid?.toString() ?? "";
}

/**
 * List available audio nodes for sharing.
 * Can be called directly from main process code.
 */
export function listVenmicNodes(): VenmicListResult {
    const audioPid = getRendererAudioServicePid();

    const targets = obtainVenmic()
        ?.list()
        .filter((s) => s["application.process.id"] !== audioPid);

    return targets ? { ok: true, targets, hasPipewirePulse } : { ok: false, isGlibcOutdated };
}

/**
 * Start capturing audio from specific application nodes.
 * Can be called directly from main process code.
 */
export function startVenmicDirect(include: Node[]): boolean | undefined {
    const pid = getRendererAudioServicePid();

    const data: LinkData = {
        include,
        exclude: [{ "application.process.id": pid }, { "media.class": "Stream/Input/Audio" }],
        ignore_devices: true,
    };

    return obtainVenmic()?.link(data);
}

/**
 * Start capturing system-wide audio, optionally excluding specific nodes.
 * Can be called directly from main process code.
 */
export function startVenmicSystemDirect(exclude: Node[]): boolean | undefined {
    const pid = getRendererAudioServicePid();

    const data: LinkData = {
        include: [],
        exclude: [{ "application.process.id": pid }, { "media.class": "Stream/Input/Audio" }, ...exclude],
        only_speakers: true,
        only_default_speakers: true,
        ignore_devices: true,
    };

    return obtainVenmic()?.link(data);
}

/**
 * Stop the virtual microphone and clean up.
 * Can be called directly from main process code.
 */
export function stopVenmicDirect(): void {
    obtainVenmic()?.unlink();
}

// IPC handlers for renderer process access
ipcMain.handle("getVenmicList", () => listVenmicNodes());

ipcMain.handle("startVenmic", (_ev, include: Node[]) => startVenmicDirect(include));

ipcMain.handle("startVenmicSystem", (_ev, exclude: Node[]) => startVenmicSystemDirect(exclude));

ipcMain.handle("stopVenmic", () => stopVenmicDirect());
