/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app } from "electron";
import { spawn, execFile, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants, existsSync } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

import { ProcessLoopbackProtocolParser, type ProcessLoopbackPacket } from "./process-loopback-protocol.js";
import type {
    PcmFormat,
    PcmSink,
    PreparedScreenShareAudioCapture,
    ScreenShareAudioAvailability,
    ScreenShareAudioProvider,
    ValidatedDisplaySelection,
} from "./types.js";

export type ProcessLoopbackMode = "include" | "exclude";

interface CaptureTarget {
    pid: number;
    mode: ProcessLoopbackMode;
}

export interface ProcessLoopbackProviderDependencies {
    executableAvailable(executable: string): Promise<boolean>;
    resolveWindowPid(executable: string, sourceId: string, signal: AbortSignal): Promise<number>;
    spawnProcess(executable: string, args: string[]): ChildProcessWithoutNullStreams;
    elementPid(): number;
}

const activeProcesses = new Set<ChildProcessWithoutNullStreams>();
const activeTimers = new Set<NodeJS.Timeout>();

export function getProcessLoopbackProviderAudit(): { processes: number; timers: number } {
    return { processes: activeProcesses.size, timers: activeTimers.size };
}

export function parseWindowSourceId(sourceId: string): number {
    const match = /^window:([1-9]\d*):0$/.exec(sourceId);
    if (!match) throw new Error("Selected source is not a supported window source");
    const hwnd = Number(match[1]);
    if (!Number.isSafeInteger(hwnd)) throw new Error("Window handle exceeds the supported range");
    return hwnd;
}

export function parseResolvedWindowPid(output: string): number {
    const match = /^pid=(\d+)$/m.exec(output);
    const pid = match && Number(match[1]);
    if (!pid || !Number.isSafeInteger(pid)) throw new Error("Window source resolver returned no valid process");
    return pid;
}

export async function resolveWindowPid(executable: string, sourceId: string, signal: AbortSignal): Promise<number> {
    parseWindowSourceId(sourceId);
    return new Promise((resolve, reject) => {
        execFile(
            executable,
            ["source", sourceId],
            { windowsHide: true, encoding: "utf8", timeout: 3_000, signal },
            (error, stdout) => {
                if (error) reject(new Error("Selected window is stale or unavailable"));
                else {
                    try {
                        resolve(parseResolvedWindowPid(stdout));
                    } catch {
                        reject(new Error("Selected window is stale or unavailable"));
                    }
                }
            },
        );
    });
}

export function captureTargetForSelection(
    selection: ValidatedDisplaySelection,
    elementPid: number,
    resolvedWindowPid?: number,
): CaptureTarget {
    if (selection.kind === "screen" && selection.sourceId.startsWith("screen:") && elementPid > 0) {
        return { pid: elementPid, mode: "exclude" };
    }
    if (
        selection.kind === "window" &&
        selection.sourceId.startsWith("window:") &&
        resolvedWindowPid !== undefined &&
        resolvedWindowPid > 0
    ) {
        parseWindowSourceId(selection.sourceId);
        return { pid: resolvedWindowPid, mode: "include" };
    }
    throw new Error("Selected source cannot be mapped to isolated audio capture");
}

class ProcessLoopbackCapture implements PreparedScreenShareAudioCapture {
    public readonly format: PcmFormat = { sampleRate: 48_000, channelCount: 2, sampleFormat: "pcm-s16le" };
    private readonly terminalListeners = new Set<(error?: Error) => void>();
    private child?: ChildProcessWithoutNullStreams;
    private sink?: PcmSink;
    private startPromise?: Promise<void>;
    private stopPromise?: Promise<void>;
    private terminalError?: Error;
    private startTimer?: NodeJS.Timeout;
    private stallTimer?: NodeJS.Timeout;
    private killTimer?: NodeJS.Timeout;
    private reapTimer?: NodeJS.Timeout;
    private stopping = false;

    public constructor(
        private readonly executable: string,
        private readonly target: CaptureTarget,
        private readonly spawnProcess: ProcessLoopbackProviderDependencies["spawnProcess"],
    ) {}

    public start(sink: PcmSink): Promise<void> {
        if (this.startPromise) return Promise.reject(new Error("Process-loopback capture is already started"));
        this.sink = sink;
        const started = Promise.withResolvers<void>();
        this.startPromise = started.promise;
        const parser = new ProcessLoopbackProtocolParser(
            (packet) => this.onPacket(packet, started.resolve),
            (error) => {
                started.reject(error);
                this.terminate(error);
            },
        );
        try {
            const child = this.spawnProcess(this.executable, ["stream", String(this.target.pid), this.target.mode]);
            this.child = child;
            activeProcesses.add(child);
            const closed = (): void => {
                activeProcesses.delete(child);
                this.clearTimer("killTimer");
                this.clearTimer("reapTimer");
            };
            child.once("close", closed);
            child.once("error", (error) => {
                started.reject(new Error("Process-loopback producer failed to start"));
                this.terminate(new Error("Process-loopback producer failed to start", { cause: error }));
            });
            child.stdout.on("data", (chunk: Buffer) => parser.push(chunk));
            child.stdout.once("end", () => parser.finish());
            child.stderr.resume();
            this.startTimer = this.setTimer(() => {
                const error = new Error("Process-loopback producer start timed out");
                started.reject(error);
                this.terminate(error);
            }, 5_000);
        } catch (error) {
            const startError = new Error("Process-loopback producer failed to start", { cause: error });
            started.reject(startError);
            this.terminate(startError);
        }
        return this.startPromise;
    }

    public onTerminal(listener: (error?: Error) => void): () => void {
        this.terminalListeners.add(listener);
        if (this.terminalError) queueMicrotask(() => listener(this.terminalError));
        return () => this.terminalListeners.delete(listener);
    }

    public stop(): Promise<void> {
        this.stopPromise ??= this.stopOnce();
        return this.stopPromise;
    }

    private onPacket(packet: ProcessLoopbackPacket, resolveStarted: () => void): void {
        if (packet.type === "start") {
            this.clearTimer("startTimer");
            this.armStallTimer();
            resolveStarted();
            return;
        }
        if (packet.type === "end") {
            this.terminate(
                new Error(packet.reason === 2 ? "Captured application exited" : "Process-loopback producer ended"),
            );
            return;
        }
        this.armStallTimer();
        if (!this.sink?.post(packet)) this.terminate(new Error("Screen-share audio transport is backpressured"));
    }

    private terminate(error: Error): void {
        if (this.stopping || this.terminalError) return;
        this.terminalError = error;
        for (const listener of this.terminalListeners) listener(error);
        void this.stop();
    }

    private async stopOnce(): Promise<void> {
        this.stopping = true;
        this.clearTimer("startTimer");
        this.clearTimer("stallTimer");
        const child = this.child;
        if (!child) {
            this.terminalListeners.clear();
            return;
        }
        if (child.exitCode === null && child.signalCode === null) {
            const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
            try {
                if (!child.stdin.destroyed) child.stdin.end("STOP\n");
            } catch {
                child.kill();
            }
            this.killTimer = this.setTimer(() => child.kill(), 750);
            await Promise.race([
                closed,
                new Promise<never>((_resolve, reject) => {
                    this.reapTimer = this.setTimer(
                        () => reject(new Error("Process-loopback producer did not stop within the bounded deadline")),
                        1_000,
                    );
                }),
            ]);
        }
        this.clearTimer("killTimer");
        this.clearTimer("reapTimer");
        this.terminalListeners.clear();
        this.sink = undefined;
    }

    private armStallTimer(): void {
        this.clearTimer("stallTimer");
        this.stallTimer = this.setTimer(
            () => this.terminate(new Error("Process-loopback producer stopped delivering audio")),
            5_000,
        );
    }

    private setTimer(callback: () => void, delay: number): NodeJS.Timeout {
        const timer = setTimeout(() => {
            activeTimers.delete(timer);
            callback();
        }, delay);
        timer.unref();
        activeTimers.add(timer);
        return timer;
    }

    private clearTimer(name: "startTimer" | "stallTimer" | "killTimer" | "reapTimer"): void {
        const timer = this[name];
        if (timer) {
            clearTimeout(timer);
            activeTimers.delete(timer);
        }
        this[name] = undefined;
    }
}

const defaultDependencies: ProcessLoopbackProviderDependencies = {
    executableAvailable: async (executable) =>
        access(executable, constants.X_OK).then(
            () => true,
            () => false,
        ),
    resolveWindowPid,
    spawnProcess: (executable, args) => spawn(executable, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }),
    elementPid: () => process.pid,
};

export class ProcessLoopbackScreenShareAudioProvider implements ScreenShareAudioProvider {
    public constructor(
        private readonly executable: string,
        private readonly deps: ProcessLoopbackProviderDependencies = defaultDependencies,
    ) {}

    public async getAvailability(): Promise<ScreenShareAudioAvailability> {
        return (await this.deps.executableAvailable(this.executable)) ? "available" : "unavailable";
    }

    public async prepare(
        selection: ValidatedDisplaySelection,
        signal: AbortSignal,
    ): Promise<PreparedScreenShareAudioCapture> {
        if (signal.aborted) throw new Error("Screen-share audio preparation was cancelled");
        const resolvedWindowPid =
            selection.kind === "window"
                ? await this.deps.resolveWindowPid(this.executable, selection.sourceId, signal)
                : undefined;
        if (signal.aborted) throw new Error("Screen-share audio preparation was cancelled");
        const target = captureTargetForSelection(selection, this.deps.elementPid(), resolvedWindowPid);
        return new ProcessLoopbackCapture(this.executable, target, (executable, args) =>
            this.deps.spawnProcess(executable, args),
        );
    }
}

export function createDevelopmentProcessLoopbackProvider(): ScreenShareAudioProvider | undefined {
    const executable = process.env.ELEMENT_SCREEN_SHARE_AUDIO_PROCESS_LOOPBACK_EXECUTABLE;
    if (
        process.platform !== "win32" ||
        app.isPackaged ||
        !executable ||
        !path.isAbsolute(executable) ||
        !existsSync(executable)
    ) {
        return undefined;
    }
    return new ProcessLoopbackScreenShareAudioProvider(executable);
}
