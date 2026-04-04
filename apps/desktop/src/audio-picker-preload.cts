/*
Copyright 2026 Joao Costa <me@joaocosta.dev>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Preload script for the audio picker dialog window.
// This file is compiled to CommonJS for Electron compatibility.

import { contextBridge, ipcRenderer } from "electron";

import type { AudioSelection, VenmicListResult } from "./@types/audio-sharing.js" with { "resolution-mode": "import" };

contextBridge.exposeInMainWorld("audioPickerAPI", {
    /**
     * Get configuration for the audio picker (theme, etc).
     */
    getConfig(): Promise<{ theme: string }> {
        return ipcRenderer.invoke("audio-picker-get-config");
    },

    /**
     * Get available audio sources from venmic.
     */
    getSources(): Promise<VenmicListResult> {
        return ipcRenderer.invoke("audio-picker-get-sources");
    },

    /**
     * Get translated UI strings for the audio picker.
     */
    getStrings(): Promise<Record<string, string>> {
        return ipcRenderer.invoke("audio-picker-get-strings");
    },

    /**
     * Send the user's selection back to the main process.
     */
    submitSelection(selection: AudioSelection): void {
        ipcRenderer.send("audio-picker-result", selection);
    },

    /**
     * Cancel the picker (same as selecting "none").
     */
    cancel(): void {
        ipcRenderer.send("audio-picker-result", { type: "none" });
    },
});
