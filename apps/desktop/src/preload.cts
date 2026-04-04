/*
Copyright 2024 New Vector Ltd.
Copyright 2018, 2019 , 2021 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// This file is compiled to CommonJS rather than ESM otherwise the browser chokes on the import statement.

/// <reference lib="dom" />

import { ipcRenderer, contextBridge, IpcRendererEvent } from "electron";

// Expose only expected IPC wrapper APIs to the renderer process to avoid
// handing out generalised messaging access.

const CHANNELS = [
    "app_onAction",
    "before-quit",
    "check_updates",
    "install_update",
    "ipcCall",
    "ipcReply",
    "loudNotification",
    "preferences",
    "seshat",
    "seshatReply",
    "setBadgeCount",
    "update-downloaded",
    "userDownloadCompleted",
    "userDownloadAction",
    "openDesktopCapturerSourcePicker",
    "userAccessToken",
    "homeserverUrl",
    "serverSupportedVersions",
    "showToast",
];

contextBridge.exposeInMainWorld("electron", {
    on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void {
        if (!CHANNELS.includes(channel)) {
            console.error(`Unknown IPC channel ${channel} ignored`);
            return;
        }
        ipcRenderer.on(channel, listener);
    },
    send(channel: string, ...args: any[]): void {
        if (!CHANNELS.includes(channel)) {
            console.error(`Unknown IPC channel ${channel} ignored`);
            return;
        }
        ipcRenderer.send(channel, ...args);
    },

    async initialise(): Promise<{
        protocol: string;
        sessionId: string;
        config: IConfigOptions;
        supportedSettings: Record<string, boolean>;
        /**
         * Do we need to render badge overlays for new notifications?
         */
        supportsBadgeOverlay: boolean;
    }> {
        ipcRenderer.emit("initialise");
        const [{ protocol, sessionId }, config, supportedSettings] = await Promise.all([
            ipcRenderer.invoke("getProtocol"),
            ipcRenderer.invoke("getConfig"),
            ipcRenderer.invoke("getSupportedSettings"),
        ]);
        return { protocol, sessionId, config, supportedSettings, supportsBadgeOverlay: process.platform === "win32" };
    },

    async setSettingValue(settingName: string, value: any): Promise<void> {
        return ipcRenderer.invoke("setSettingValue", settingName, value);
    },
    async getSettingValue(settingName: string): Promise<any> {
        return ipcRenderer.invoke("getSettingValue", settingName);
    },

    /**
     * Virtual microphone API for Linux audio sharing via PipeWire.
     * Only functional on Linux with PipeWire and @vencord/venmic installed.
     */
    venmic: {
        /** List available audio nodes for sharing. */
        list(): Promise<
            | { ok: false; isGlibcOutdated: boolean }
            | { ok: true; targets: Record<string, string>[]; hasPipewirePulse: boolean }
        > {
            return ipcRenderer.invoke("getVenmicList");
        },
        /** Start capturing audio from specific application nodes. */
        start(include: Record<string, string>[]): Promise<boolean | undefined> {
            return ipcRenderer.invoke("startVenmic", include);
        },
        /** Start capturing system-wide audio, optionally excluding specific nodes. */
        startSystem(exclude: Record<string, string>[]): Promise<boolean | undefined> {
            return ipcRenderer.invoke("startVenmicSystem", exclude);
        },
        /** Stop the virtual microphone and clean up. */
        stop(): Promise<void> {
            return ipcRenderer.invoke("stopVenmic");
        },
    },
});

/**
 * Patch navigator.mediaDevices.getDisplayMedia on Linux to capture audio from
 * the venmic virtual microphone (vencord-screen-share) when it's available.
 *
 * This allows screen sharing with application audio on Linux via PipeWire.
 */
if (process.platform === "linux") {
    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

    navigator.mediaDevices.getDisplayMedia = async function (
        options?: DisplayMediaStreamOptions,
    ): Promise<MediaStream> {
        console.debug("venmic: getDisplayMedia called with options:", options);

        const stream = await originalGetDisplayMedia(options);
        console.debug(
            "venmic: original getDisplayMedia returned stream with tracks:",
            stream.getTracks().map((t) => `${t.kind}:${t.label}`),
        );

        // Try to find the venmic virtual microphone
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter((d) => d.kind === "audioinput");
            console.debug(
                "venmic: available audio input devices:",
                audioInputs.map((d) => `${d.label} (${d.deviceId.slice(0, 8)}...)`),
            );

            const venmicDevice = devices.find((d) => d.label === "vencord-screen-share");

            if (venmicDevice) {
                console.debug("venmic: found vencord-screen-share device:", venmicDevice.deviceId);

                // Capture audio from the venmic virtual microphone
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        deviceId: { exact: venmicDevice.deviceId },
                        autoGainControl: false,
                        echoCancellation: false,
                        noiseSuppression: false,
                        channelCount: 2,
                        sampleRate: 48000,
                        sampleSize: 16,
                    },
                });

                console.debug("venmic: captured audio stream from virtual mic");

                // Remove any existing audio tracks and add the venmic audio
                const audioTrack = audioStream.getAudioTracks()[0];
                if (audioTrack) {
                    stream.getAudioTracks().forEach((track) => {
                        console.debug("venmic: removing existing audio track:", track.label);
                        stream.removeTrack(track);
                    });
                    stream.addTrack(audioTrack);

                    // Clean up venmic when the audio track ends
                    audioTrack.addEventListener("ended", () => {
                        console.debug("venmic: audio track ended, stopping venmic");
                        ipcRenderer.invoke("stopVenmic").catch((e) => console.error("venmic: failed to stop:", e));
                    });

                    // Also clean up when the video track ends (screen share stopped)
                    const videoTrack = stream.getVideoTracks()[0];
                    if (videoTrack) {
                        videoTrack.addEventListener("ended", () => {
                            console.debug("venmic: video track ended, stopping venmic");
                            ipcRenderer.invoke("stopVenmic").catch((e) => console.error("venmic: failed to stop:", e));
                        });
                    }

                    console.log("venmic: audio track added to screen share stream");
                } else {
                    console.warn("venmic: no audio track returned from virtual microphone");
                }
            } else {
                console.debug("venmic: vencord-screen-share device not found, audio not captured");
            }
        } catch (err) {
            console.error("venmic: failed to capture audio from virtual microphone:", err);
        }

        console.debug(
            "venmic: returning stream with tracks:",
            stream.getTracks().map((t) => `${t.kind}:${t.label}`),
        );
        return stream;
    };
}
