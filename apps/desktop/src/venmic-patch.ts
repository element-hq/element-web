/*
Copyright 2026 Joao Costa <me@joaocosta.dev>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Shared logic for patching getDisplayMedia to add venmic audio.
 * Used by both preload.cts (main frame) and venmic-inject.ts (iframes).
 */

export interface VenmicStopFn {
    (): Promise<void>;
}

const VENMIC_DEVICE_LABEL = "vencord-screen-share";

async function addVenmicAudioToStream(stream: MediaStream, stopVenmic: VenmicStopFn | null): Promise<void> {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const venmicDevice = devices.find((d) => d.label === VENMIC_DEVICE_LABEL);

        if (!venmicDevice) {
            console.debug("venmic: vencord-screen-share device not found");
            return;
        }

        console.debug("venmic: found vencord-screen-share device:", venmicDevice.deviceId);

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

        const audioTrack = audioStream.getAudioTracks()[0];
        if (!audioTrack) {
            console.warn("venmic: no audio track returned from virtual microphone");
            return;
        }

        stream.getAudioTracks().forEach((track) => {
            console.debug("venmic: removing existing audio track:", track.label);
            stream.removeTrack(track);
        });
        stream.addTrack(audioTrack);

        audioTrack.addEventListener("ended", () => {
            console.debug("venmic: audio track ended, stopping venmic");
            stopVenmic?.().catch((e) => console.error("venmic: failed to stop:", e));
        });

        const videoTrack = stream.getVideoTracks()[0];
        videoTrack?.addEventListener("ended", () => {
            console.debug("venmic: video track ended, stopping venmic");
            stopVenmic?.().catch((e) => console.error("venmic: failed to stop:", e));
        });

        console.log("venmic: audio track added to screen share stream");
    } catch (err) {
        console.error("venmic: failed to capture audio from virtual microphone:", err);
    }
}

export function applyVenmicPatch(stopVenmic: VenmicStopFn): void {
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

        await addVenmicAudioToStream(stream, stopVenmic);

        console.debug(
            "venmic: returning stream with tracks:",
            stream.getTracks().map((t) => `${t.kind}:${t.label}`),
        );
        return stream;
    };

    console.debug("venmic: getDisplayMedia patch installed in main frame");
}

export const VENMIC_PATCH_SCRIPT = `
(function() {
    if (window.__venmicPatched) return;
    window.__venmicPatched = true;

    const VENMIC_DEVICE_LABEL = "vencord-screen-share";

    const stopVenmic = typeof window.electron?.venmic?.stop === 'function'
        ? () => window.electron.venmic.stop()
        : null;

    if (!stopVenmic) {
        console.debug("venmic-inject: window.electron not available, venmic will not auto-stop");
    }

    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

    async function addVenmicAudioToStream(stream) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const venmicDevice = devices.find(d => d.label === VENMIC_DEVICE_LABEL);

            if (!venmicDevice) {
                console.debug("venmic-inject: " + VENMIC_DEVICE_LABEL + " device not found");
                return;
            }

            console.debug("venmic-inject: found " + VENMIC_DEVICE_LABEL + " device:", venmicDevice.deviceId);

            const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: venmicDevice.deviceId },
                    autoGainControl: false,
                    echoCancellation: false,
                    noiseSuppression: false,
                    channelCount: 2,
                    sampleRate: 48000,
                    sampleSize: 16
                }
            });

            const audioTrack = audioStream.getAudioTracks()[0];
            if (!audioTrack) {
                console.warn("venmic-inject: no audio track returned from virtual microphone");
                return;
            }

            stream.getAudioTracks().forEach(track => {
                console.debug("venmic-inject: removing existing audio track:", track.label);
                stream.removeTrack(track);
            });
            stream.addTrack(audioTrack);

            if (stopVenmic) {
                audioTrack.addEventListener("ended", () => {
                    console.debug("venmic-inject: audio track ended, stopping venmic");
                    stopVenmic().catch(e => console.error("venmic-inject: failed to stop:", e));
                });

                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.addEventListener("ended", () => {
                        console.debug("venmic-inject: video track ended, stopping venmic");
                        stopVenmic().catch(e => console.error("venmic-inject: failed to stop:", e));
                    });
                }
            }

            console.log("venmic-inject: audio track added to screen share stream");
        } catch (err) {
            console.error("venmic-inject: failed to capture audio from virtual microphone:", err);
        }
    }

    navigator.mediaDevices.getDisplayMedia = async function(options) {
        console.debug("venmic-inject: getDisplayMedia called with options:", options);

        const stream = await originalGetDisplayMedia(options);
        console.debug("venmic-inject: original getDisplayMedia returned stream with tracks:",
            stream.getTracks().map(t => t.kind + ":" + t.label));

        await addVenmicAudioToStream(stream);

        console.debug("venmic-inject: returning stream with tracks:",
            stream.getTracks().map(t => t.kind + ":" + t.label));
        return stream;
    };

    console.debug("venmic-inject: getDisplayMedia patch installed in frame:", window.location.href);
})();
`;
