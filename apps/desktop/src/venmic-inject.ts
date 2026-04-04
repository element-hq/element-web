/*
Copyright 2026 Joao Costa <me@joaocosta.dev>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * This module injects the venmic getDisplayMedia patch into all frames (including iframes)
 * so that Element Call can capture audio from the venmic virtual microphone.
 */

import type { WebContents } from "electron";

/**
 * JavaScript code to patch getDisplayMedia in the renderer/iframe context.
 * This is injected into each frame to capture audio from the venmic virtual mic.
 */
const VENMIC_PATCH_SCRIPT = `
(function() {
    // Only run once per context
    if (window.__venmicPatched) return;
    window.__venmicPatched = true;

    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

    navigator.mediaDevices.getDisplayMedia = async function(options) {
        console.debug('[venmic-inject] getDisplayMedia called in frame:', window.location.href);
        
        const stream = await originalGetDisplayMedia(options);
        console.debug('[venmic-inject] original getDisplayMedia returned, tracks:', 
            stream.getTracks().map(t => t.kind + ':' + t.label).join(', '));

        // Try to find and capture from venmic virtual microphone
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            console.debug('[venmic-inject] available audio inputs:', 
                audioInputs.map(d => d.label || d.deviceId.slice(0, 8)).join(', '));

            const venmicDevice = devices.find(d => d.label === 'vencord-screen-share');

            if (venmicDevice) {
                console.debug('[venmic-inject] found vencord-screen-share device');

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
                if (audioTrack) {
                    // Remove any existing audio tracks
                    stream.getAudioTracks().forEach(track => {
                        console.debug('[venmic-inject] removing existing audio track:', track.label);
                        stream.removeTrack(track);
                    });

                    // Add the venmic audio track
                    stream.addTrack(audioTrack);
                    console.log('[venmic-inject] venmic audio track added to stream');
                } else {
                    console.warn('[venmic-inject] no audio track returned from virtual microphone');
                }
            } else {
                console.debug('[venmic-inject] vencord-screen-share device not found');
            }
        } catch (err) {
            console.error('[venmic-inject] failed to capture venmic audio:', err);
        }

        console.debug('[venmic-inject] returning stream with tracks:', 
            stream.getTracks().map(t => t.kind + ':' + t.label).join(', '));
        return stream;
    };

    console.debug('[venmic-inject] getDisplayMedia patch installed in frame:', window.location.href);
})();
`;

/**
 * Set up venmic injection for all frames in the given webContents.
 * This patches getDisplayMedia in both the main frame and all iframes (like Element Call).
 */
export function setupVenmicInjection(webContents: WebContents): void {
    // Inject into frames as they finish loading
    webContents.on("did-frame-finish-load", async (_event, isMainFrame) => {
        // We want to inject into all frames, but especially Element Call iframes
        try {
            if (isMainFrame) {
                // Main frame - inject directly
                await webContents.executeJavaScript(VENMIC_PATCH_SCRIPT, true);
                console.debug("venmic: patch injected into main frame");
            } else {
                // Subframe - need to find and inject into all frames
                // Get all frames including subframes
                const mainFrame = webContents.mainFrame;
                if (mainFrame) {
                    await injectIntoAllFrames(mainFrame);
                }
            }
        } catch (err) {
            // Ignore errors for frames that might have navigated away
            console.debug("venmic: failed to inject into frame:", err);
        }
    });

    // Also inject into any existing frames
    const mainFrame = webContents.mainFrame;
    if (mainFrame) {
        void injectIntoAllFrames(mainFrame);
    }
}

/**
 * Recursively inject the venmic patch into a frame and all its child frames.
 */
async function injectIntoAllFrames(frame: Electron.WebFrameMain): Promise<void> {
    try {
        // Check if frame is still valid
        if (!frame.url) return;

        // Inject into this frame
        await frame.executeJavaScript(VENMIC_PATCH_SCRIPT, true);
        console.debug("venmic: patch injected into frame:", frame.url);
    } catch (err) {
        // Frame might have been destroyed or navigated
        console.debug("venmic: failed to inject into frame:", err);
    }

    // Inject into child frames in parallel
    await Promise.all(frame.frames.map((childFrame) => injectIntoAllFrames(childFrame)));
}
