/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app } from "electron";
import type {
    PcmFormat,
    PcmSink,
    PreparedScreenShareAudioCapture,
    ScreenShareAudioAvailability,
    ScreenShareAudioProvider,
} from "./types.js";

const sampleRate = 48_000;
const framesPerPacket = 480;
const activeCaptures = new Set<FakeStereoCapture>();
const activeTimers = new Set<NodeJS.Timeout>();

export function getFakeScreenShareAudioAudit(): { captures: number; timers: number } {
    return { captures: activeCaptures.size, timers: activeTimers.size };
}

class FakeStereoCapture implements PreparedScreenShareAudioCapture {
    private timer?: NodeJS.Timeout;
    private frame = 0;
    private sequence = 0;
    private readonly terminalListeners = new Set<(error?: Error) => void>();
    public readonly format: PcmFormat = { sampleRate: 48_000, channelCount: 2, sampleFormat: "pcm-s16le" };

    public async start(sink: PcmSink): Promise<void> {
        if (this.timer) throw new Error("Fake screen-share audio capture is already started");
        this.timer = setInterval(() => {
            const pcm = new Int16Array(framesPerPacket * 2);
            for (let i = 0; i < framesPerPacket; i++, this.frame++) {
                pcm[i * 2] = Math.round(Math.sin((2 * Math.PI * 733 * this.frame) / sampleRate) * 8192);
                pcm[i * 2 + 1] = Math.round(Math.sin((2 * Math.PI * 997 * this.frame) / sampleRate) * 8192);
            }
            sink.post({ sequence: this.sequence++, startFrame: this.frame - framesPerPacket, data: pcm.buffer });
        }, 10);
        activeCaptures.add(this);
        activeTimers.add(this.timer);
    }

    public async stop(): Promise<void> {
        if (this.timer) {
            clearInterval(this.timer);
            activeTimers.delete(this.timer);
        }
        this.timer = undefined;
        activeCaptures.delete(this);
        this.terminalListeners.clear();
    }

    public onTerminal(listener: (error?: Error) => void): () => void {
        this.terminalListeners.add(listener);
        return () => this.terminalListeners.delete(listener);
    }
}

export class FakeScreenShareAudioProvider implements ScreenShareAudioProvider {
    public async getAvailability(): Promise<ScreenShareAudioAvailability> {
        return "available";
    }

    public async prepare(_selection: unknown, signal: AbortSignal): Promise<PreparedScreenShareAudioCapture> {
        if (signal.aborted) throw new Error("Screen-share audio preparation was cancelled");
        return new FakeStereoCapture();
    }
}

export function createDevelopmentFakeProvider(): ScreenShareAudioProvider | undefined {
    if (process.platform !== "win32" || app.isPackaged) return undefined;
    return process.env.ELEMENT_SCREEN_SHARE_AUDIO_FAKE_PROVIDER === "1"
        ? new FakeScreenShareAudioProvider()
        : undefined;
}
