/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BrowserWindow, MessageChannelMain, type MessagePortMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
    PcmPacket,
    PcmSink,
    PreparedScreenShareAudioBridge,
    PreparedScreenShareAudioCapture,
    ScreenShareAudioBridgeFactory,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maxPendingPackets = 20;
export const bridgePreparationStages = [
    "window-created",
    "document-loaded",
    "port-posted",
    "port-received",
    "audio-context-created",
    "worklet-loaded",
    "worklet-node-created",
    "context-running",
    "capture-started",
    "prebuffer-ready",
    "active",
] as const;
export const bridgePreparationFailures = [
    "document-load",
    "port-ready-timeout",
    "renderer-audio-context",
    "renderer-worklet-load",
    "renderer-worklet-node",
    "renderer-context-resume",
    "renderer-protocol",
    "port-closed",
    "renderer-gone",
    "capture-start",
    "capture-terminal",
    "prebuffer-timeout",
    "aborted",
] as const;
export type BridgePreparationStage = (typeof bridgePreparationStages)[number];
export type BridgePreparationFailure = (typeof bridgePreparationFailures)[number];
let lastStage: BridgePreparationStage | null = null;
let lastFailure: BridgePreparationFailure | null = null;

export function isBridgePreparationStage(value: unknown): value is BridgePreparationStage {
    return typeof value === "string" && bridgePreparationStages.includes(value as BridgePreparationStage);
}

export function isBridgePreparationFailure(value: unknown): value is BridgePreparationFailure {
    return typeof value === "string" && bridgePreparationFailures.includes(value as BridgePreparationFailure);
}

function recordStage(stage: BridgePreparationStage): void {
    if (!lastStage || bridgePreparationStages.indexOf(stage) >= bridgePreparationStages.indexOf(lastStage)) {
        lastStage = stage;
    }
}

function recordFailure(failure: BridgePreparationFailure): void {
    lastFailure = latchBridgePreparationFailure(lastFailure, failure);
}

export function latchBridgePreparationFailure(
    current: BridgePreparationFailure | null,
    next: BridgePreparationFailure,
): BridgePreparationFailure {
    return current ?? next;
}

export function portCloseFailure(stopped: boolean): BridgePreparationFailure | null {
    return stopped ? null : "port-closed";
}

export function validatePcmPacket(packet: PcmPacket, expectedSequence: number, expectedStartFrame: number): number {
    if (
        packet.sequence !== expectedSequence ||
        packet.startFrame !== expectedStartFrame ||
        packet.data.byteLength === 0 ||
        packet.data.byteLength % 4 !== 0
    ) {
        return 0;
    }
    return packet.data.byteLength / 4;
}

class ElectronScreenShareAudioBridge implements PreparedScreenShareAudioBridge {
    private pending = 0;
    private stopped = false;
    private readonly terminal = Promise.withResolvers<void>();
    private stopPromise?: Promise<void>;
    private disposeCaptureTerminal?: () => void;
    private bridgeGoneListener?: () => void;

    public constructor(
        private readonly window: BrowserWindow,
        public readonly port: MessagePortMain,
        private readonly rendererPort: MessagePortMain,
        private readonly capture: PreparedScreenShareAudioCapture,
    ) {}

    public get frame(): Electron.WebFrameMain {
        return this.window.webContents.mainFrame;
    }

    public async start(signal: AbortSignal): Promise<void> {
        const ready = Promise.withResolvers<void>();
        const prebuffered = Promise.withResolvers<void>();
        void ready.promise.catch(() => {});
        void prebuffered.promise.catch(() => {});
        const failPreparation = (failure: BridgePreparationFailure): void => {
            recordFailure(failure);
            this.terminal.resolve();
            const error = new Error("Screen-share audio bridge terminated");
            ready.reject(error);
            prebuffered.reject(error);
        };
        this.port.on("message", ({ data }) => {
            if (
                typeof data !== "object" ||
                data === null ||
                (data.type !== "stage" && data.type !== "failed") ||
                !("code" in data)
            ) {
                failPreparation("renderer-protocol");
                return;
            }
            if (data.type === "failed") {
                if (isBridgePreparationFailure(data.code)) failPreparation(data.code);
                else failPreparation("renderer-protocol");
                return;
            }
            if (!isBridgePreparationStage(data.code)) {
                failPreparation("renderer-protocol");
                return;
            }
            recordStage(data.code);
            if (data.code === "context-running") {
                ready.resolve();
                this.pending = Math.max(0, this.pending - 1);
            } else if (data.code === "prebuffer-ready") {
                prebuffered.resolve();
            }
        });
        this.port.once("close", () => {
            const failure = portCloseFailure(this.stopped);
            if (failure) failPreparation(failure);
        });
        this.bridgeGoneListener = () => failPreparation("renderer-gone");
        this.window.once("closed", this.bridgeGoneListener);
        this.window.webContents.once("render-process-gone", this.bridgeGoneListener);
        this.port.start();
        recordStage("port-posted");
        this.window.webContents.postMessage("screen-share-audio-port", null, [this.rendererPort]);
        const timeout = this.trackTimeout(() => {
            recordFailure("port-ready-timeout");
            ready.reject(new Error("Screen-share audio bridge readiness timed out"));
        }, 5_000);
        try {
            await this.withAbort(signal, ready.promise);
        } finally {
            this.clearTrackedTimeout(timeout);
        }

        const getPendingPackets = (): number => this.pending;
        let expectedSequence = 0;
        let expectedStartFrame = 0;
        const sink: PcmSink = {
            get pendingPackets(): number {
                return getPendingPackets();
            },
            post: (packet): boolean => {
                if (this.stopped || this.pending >= maxPendingPackets) return false;
                const frames = validatePcmPacket(packet, expectedSequence, expectedStartFrame);
                if (!frames) {
                    failPreparation("port-closed");
                    return false;
                }
                expectedSequence++;
                expectedStartFrame += frames;
                this.pending++;
                this.port.postMessage({ type: "pcm", packet });
                return true;
            },
        };
        this.disposeCaptureTerminal = this.capture.onTerminal(() => failPreparation("capture-terminal"));
        try {
            await this.withAbort(signal, this.capture.start(sink));
            recordStage("capture-started");
        } catch (error) {
            if (!signal.aborted) recordFailure("capture-start");
            throw error;
        }
        const prebufferTimeout = this.trackTimeout(() => {
            recordFailure("prebuffer-timeout");
            prebuffered.reject(new Error("Screen-share audio bridge prebuffer timed out"));
        }, 5_000);
        try {
            await this.withAbort(signal, prebuffered.promise);
        } finally {
            this.clearTrackedTimeout(prebufferTimeout);
        }
        recordStage("prebuffer-ready");
        recordStage("active");
    }

    public waitForTerminal(): Promise<void> {
        return this.terminal.promise;
    }

    public stop(): Promise<void> {
        this.stopPromise ??= this.stopOnce();
        return this.stopPromise;
    }

    private async stopOnce(): Promise<void> {
        this.stopped = true;
        this.disposeCaptureTerminal?.();
        this.disposeCaptureTerminal = undefined;
        if (this.bridgeGoneListener) {
            this.window.removeListener("closed", this.bridgeGoneListener);
            if (!this.window.webContents.isDestroyed()) {
                this.window.webContents.removeListener("render-process-gone", this.bridgeGoneListener);
            }
        }
        this.bridgeGoneListener = undefined;
        try {
            await this.capture.stop();
        } finally {
            this.port.close();
            if (!this.window.isDestroyed()) this.window.destroy();
        }
    }

    private trackTimeout(callback: () => void, delay: number): NodeJS.Timeout {
        return setTimeout(callback, delay);
    }

    private clearTrackedTimeout(timer: NodeJS.Timeout): void {
        clearTimeout(timer);
    }

    private async withAbort<T>(signal: AbortSignal, promise: Promise<T>): Promise<T> {
        if (signal.aborted) {
            recordFailure("aborted");
            throw new Error("Screen-share audio bridge preparation was cancelled");
        }
        const aborted = Promise.withResolvers<never>();
        const onAbort = (): void => {
            recordFailure("aborted");
            aborted.reject(new Error("Screen-share audio bridge preparation was cancelled"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        try {
            return await Promise.race([promise, aborted.promise]);
        } finally {
            signal.removeEventListener("abort", onAbort);
        }
    }
}

export class ElectronScreenShareAudioBridgeFactory implements ScreenShareAudioBridgeFactory {
    public async prepare(
        capture: PreparedScreenShareAudioCapture,
        signal: AbortSignal,
    ): Promise<PreparedScreenShareAudioBridge> {
        lastStage = null;
        lastFailure = null;
        if (signal.aborted) {
            recordFailure("aborted");
            throw new Error("Screen-share audio bridge preparation was cancelled");
        }
        if (
            capture.format.sampleRate !== 48_000 ||
            capture.format.channelCount !== 2 ||
            capture.format.sampleFormat !== "pcm-s16le"
        ) {
            throw new Error("Unsupported screen-share audio PCM format");
        }
        const window = new BrowserWindow({
            show: false,
            webPreferences: {
                preload: path.join(__dirname, "../screen-share-audio-bridge-preload.cjs"),
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
                backgroundThrottling: false,
            },
        });
        recordStage("window-created");
        let bridge: ElectronScreenShareAudioBridge | undefined;
        try {
            const aborted = Promise.withResolvers<never>();
            const onAbort = (): void => {
                recordFailure("aborted");
                aborted.reject(new Error("Screen-share audio bridge preparation was cancelled"));
            };
            signal.addEventListener("abort", onAbort, { once: true });
            try {
                try {
                    await Promise.race([window.loadFile(path.join(__dirname, "assets/bridge.html")), aborted.promise]);
                    recordStage("document-loaded");
                } catch (error) {
                    if (!signal.aborted) recordFailure("document-load");
                    throw error;
                }
            } finally {
                signal.removeEventListener("abort", onAbort);
            }
            const { port1, port2 } = new MessageChannelMain();
            bridge = new ElectronScreenShareAudioBridge(window, port1, port2, capture);
            await bridge.start(signal);
            return bridge;
        } catch (error) {
            await bridge?.stop().catch(() => {});
            if (!bridge) await capture.stop().catch(() => {});
            if (!window.isDestroyed()) window.destroy();
            throw error;
        }
    }
}
