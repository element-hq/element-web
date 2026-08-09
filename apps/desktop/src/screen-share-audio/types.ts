/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { MessagePortMain, WebFrameMain } from "electron";

export type ScreenShareAudioAvailability = "available" | "unavailable" | "unsupported";

export interface ValidatedDisplaySelection {
    sourceId: string;
    kind: "screen" | "window";
}

export interface PcmFormat {
    sampleRate: 48_000;
    channelCount: 2;
    sampleFormat: "pcm-s16le";
}

export interface PcmPacket {
    sequence: number;
    startFrame: number;
    data: ArrayBuffer;
}

export interface PcmSink {
    readonly pendingPackets: number;
    post(packet: PcmPacket): boolean;
}

export interface PreparedScreenShareAudioCapture {
    readonly format: PcmFormat;
    start(sink: PcmSink): Promise<void>;
    onTerminal(listener: (error?: Error) => void): () => void;
    stop(): Promise<void>;
}

export interface ScreenShareAudioProvider {
    getAvailability(): Promise<ScreenShareAudioAvailability>;
    prepare(selection: ValidatedDisplaySelection, signal: AbortSignal): Promise<PreparedScreenShareAudioCapture>;
}

export interface PreparedScreenShareAudioBridge {
    readonly frame: WebFrameMain;
    readonly port: MessagePortMain;
    waitForConsumerStop(): Promise<void>;
    waitForTerminal(): Promise<void>;
    stop(): Promise<void>;
}

export interface ScreenShareAudioBridgeFactory {
    prepare(capture: PreparedScreenShareAudioCapture, signal: AbortSignal): Promise<PreparedScreenShareAudioBridge>;
}
