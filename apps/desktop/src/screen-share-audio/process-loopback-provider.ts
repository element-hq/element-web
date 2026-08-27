/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app } from "electron";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
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

export const minimumWindowsProcessLoopbackBuild = 20_348;
export const processLoopbackExecutableName = "windows-process-loopback.exe";
export type ProcessLoopbackMode = "include" | "exclude";

interface CaptureTarget {
    pid: number;
    mode: ProcessLoopbackMode;
}

export interface ProcessLoopbackRuntime {
    platform: NodeJS.Platform;
    arch: string;
    windowsBuild: number;
    isPackaged: boolean;
    resourcesPath: string;
    appPath: string;
}

export interface ProcessLoopbackProviderDependencies {
    runtime(): ProcessLoopbackRuntime;
    executableAvailable(executable: string): Promise<boolean>;
    probe(executable: string): Promise<string>;
    resolveWindowPid(executable: string, sourceId: string, signal: AbortSignal): Promise<number>;
    spawnProcess(executable: string, args: string[]): ChildProcessWithoutNullStreams;
    elementPid(): number;
}

export function parseWindowsBuild(release: string): number {
    const components = release.split(".");
    const build = Number(components[2]);
    return Number.isSafeInteger(build) && build > 0 ? build : 0;
}

export function resolveProcessLoopbackExecutable(
    runtime: Pick<ProcessLoopbackRuntime, "isPackaged" | "resourcesPath" | "appPath">,
): string {
    return runtime.isPackaged
        ? path.join(runtime.resourcesPath, "screen-share-audio", processLoopbackExecutableName)
        : path.join(
              runtime.appPath,
              "native",
              "windows-process-loopback",
              "build",
              "windows-x64",
              processLoopbackExecutableName,
          );
}

export function isCompatibleProcessLoopbackProbe(output: string): boolean {
    return output.replaceAll("\r\n", "\n").trim() === "protocol=1\nformat=48000,2,pcm-s16le";
}

export function parseWindowSourceId(sourceId: string): number {
    const match = /^window:([1-9]\d*):0$/.exec(sourceId);
    if (!match) throw new Error("Selected source is not a supported window source");
    const hwnd = Number(match[1]);
    if (!Number.isSafeInteger(hwnd)) throw new Error("Window handle exceeds the supported range");
    return hwnd;
}

export function parseResolvedWindowPid(output: string): number {
    const match = /^pid=(\d+)\r?\n?$/.exec(output);
    const pid = match && Number(match[1]);
    if (!pid || !Number.isSafeInteger(pid)) throw new Error("Window source resolver returned no valid process");
    return pid;
}

export async function probeProcessLoopbackExecutable(executable: string): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(
            executable,
            ["probe"],
            { windowsHide: true, encoding: "utf8", timeout: 3_000, shell: false },
            (error, stdout) => {
                if (error) reject(new Error("Screen-share audio helper is incompatible"));
                else resolve(stdout);
            },
        );
    });
}

export async function resolveWindowPid(executable: string, sourceId: string, signal: AbortSignal): Promise<number> {
    parseWindowSourceId(sourceId);
    return new Promise((resolve, reject) => {
        execFile(
            executable,
            ["source", sourceId],
            { windowsHide: true, encoding: "utf8", timeout: 3_000, signal, shell: false },
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
    private childErrorListener?: (error: Error) => void;
    private childCloseListener?: () => void;
    private stdoutDataListener?: (chunk: Buffer) => void;
    private stdoutEndListener?: () => void;
    private stopCloseListener?: () => void;
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
            this.childErrorListener = (error) => {
                const startError = new Error("Process-loopback producer failed to start", { cause: error });
                started.reject(startError);
                this.terminate(startError);
            };
            this.childCloseListener = () => {
                if (!this.stopping) {
                    const error = new Error("Process-loopback producer exited unexpectedly");
                    started.reject(error);
                    this.terminate(error);
                }
            };
            this.stdoutDataListener = (chunk) => parser.push(chunk);
            this.stdoutEndListener = () => parser.finish();
            child.once("error", this.childErrorListener);
            child.once("close", this.childCloseListener);
            child.stdout.on("data", this.stdoutDataListener);
            child.stdout.once("end", this.stdoutEndListener);
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

    public getOwnershipAuditForTest(): Readonly<{
        childReferences: number;
        sinkReferences: number;
        timers: number;
        childListeners: number;
        terminalListeners: number;
    }> {
        return {
            childReferences: Number(this.child !== undefined),
            sinkReferences: Number(this.sink !== undefined),
            timers: [this.startTimer, this.stallTimer, this.killTimer, this.reapTimer].filter(Boolean).length,
            childListeners: [
                this.childErrorListener,
                this.childCloseListener,
                this.stdoutDataListener,
                this.stdoutEndListener,
                this.stopCloseListener,
            ].filter(Boolean).length,
            terminalListeners: this.terminalListeners.size,
        };
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
        // The explicit owner observes the same stop promise; this prevents an early terminal path from being unhandled.
        // oxlint-disable-next-line promise/no-promise-in-callback
        void this.stop().catch(() => {});
    }

    private async stopOnce(): Promise<void> {
        this.stopping = true;
        const child = this.child;
        try {
            this.clearTimer("startTimer");
            this.clearTimer("stallTimer");
            if (child?.exitCode !== null || child?.signalCode !== null) return;
            const closed = new Promise<void>((resolve) => {
                this.stopCloseListener = resolve;
                child.once("close", this.stopCloseListener);
            });
            try {
                if (!child.stdin.destroyed) child.stdin.end("STOP\n");
            } catch {
                this.killSafely(child);
            }
            this.killTimer = this.setTimer(() => this.killSafely(child), 750);
            await Promise.race([
                closed,
                new Promise<never>((_resolve, reject) => {
                    this.reapTimer = this.setTimer(
                        () => reject(new Error("Process-loopback producer did not stop within the bounded deadline")),
                        1_000,
                    );
                }),
            ]);
        } finally {
            this.clearTimer("startTimer");
            this.clearTimer("stallTimer");
            this.clearTimer("killTimer");
            this.clearTimer("reapTimer");
            this.clearChildOwnership(child);
            this.terminalListeners.clear();
            this.sink = undefined;
        }
    }

    private killSafely(child: ChildProcessWithoutNullStreams): void {
        try {
            child.kill();
        } catch {}
    }

    private clearChildOwnership(child?: ChildProcessWithoutNullStreams): void {
        if (child) {
            if (this.childErrorListener) this.releaseSafely(() => child.off("error", this.childErrorListener!));
            if (this.childCloseListener) this.releaseSafely(() => child.off("close", this.childCloseListener!));
            if (this.stdoutDataListener) this.releaseSafely(() => child.stdout.off("data", this.stdoutDataListener!));
            if (this.stdoutEndListener) this.releaseSafely(() => child.stdout.off("end", this.stdoutEndListener!));
            if (this.stopCloseListener) this.releaseSafely(() => child.off("close", this.stopCloseListener!));
            this.releaseSafely(() => child.stdin.destroy());
            this.releaseSafely(() => child.stdout.destroy());
            this.releaseSafely(() => child.stderr.destroy());
            this.releaseSafely(() => child.unref());
        }
        this.childErrorListener = undefined;
        this.childCloseListener = undefined;
        this.stdoutDataListener = undefined;
        this.stdoutEndListener = undefined;
        this.stopCloseListener = undefined;
        this.child = undefined;
    }

    private releaseSafely(release: () => void): void {
        try {
            release();
        } catch {}
    }

    private armStallTimer(): void {
        this.clearTimer("stallTimer");
        this.stallTimer = this.setTimer(
            () => this.terminate(new Error("Process-loopback producer stopped delivering audio")),
            5_000,
        );
    }

    private setTimer(callback: () => void, delay: number): NodeJS.Timeout {
        const timer = setTimeout(callback, delay);
        timer.unref();
        return timer;
    }

    private clearTimer(name: "startTimer" | "stallTimer" | "killTimer" | "reapTimer"): void {
        const timer = this[name];
        if (timer) clearTimeout(timer);
        this[name] = undefined;
    }
}

const defaultDependencies: ProcessLoopbackProviderDependencies = {
    runtime: () => ({
        platform: process.platform,
        arch: process.arch,
        windowsBuild: parseWindowsBuild(os.release()),
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        appPath: app.getAppPath(),
    }),
    executableAvailable: async (executable) =>
        access(executable, constants.F_OK).then(
            () => true,
            () => false,
        ),
    probe: probeProcessLoopbackExecutable,
    resolveWindowPid,
    spawnProcess: (executable, args) =>
        spawn(executable, args, {
            windowsHide: true,
            shell: false,
            stdio: ["pipe", "pipe", "pipe"],
        }),
    elementPid: () => process.pid,
};

export class ProcessLoopbackScreenShareAudioProvider implements ScreenShareAudioProvider {
    private availability?: Promise<ScreenShareAudioAvailability>;

    public constructor(private readonly deps: ProcessLoopbackProviderDependencies = defaultDependencies) {}

    public getAvailability(): Promise<ScreenShareAudioAvailability> {
        this.availability ??= this.checkAvailability();
        return this.availability;
    }

    private async checkAvailability(): Promise<ScreenShareAudioAvailability> {
        const runtime = this.deps.runtime();
        if (
            runtime.platform !== "win32" ||
            runtime.arch !== "x64" ||
            runtime.windowsBuild < minimumWindowsProcessLoopbackBuild
        ) {
            return "unsupported";
        }
        const executable = resolveProcessLoopbackExecutable(runtime);
        if (!(await this.deps.executableAvailable(executable))) return "unavailable";
        try {
            return isCompatibleProcessLoopbackProbe(await this.deps.probe(executable)) ? "available" : "unavailable";
        } catch {
            return "unavailable";
        }
    }

    public async prepare(
        selection: ValidatedDisplaySelection,
        signal: AbortSignal,
    ): Promise<PreparedScreenShareAudioCapture> {
        if (signal.aborted) throw new Error("Screen-share audio preparation was cancelled");
        if ((await this.getAvailability()) !== "available") {
            throw new Error("Screen-share audio capture is unavailable");
        }
        const executable = resolveProcessLoopbackExecutable(this.deps.runtime());
        const resolvedWindowPid =
            selection.kind === "window"
                ? await this.deps.resolveWindowPid(executable, selection.sourceId, signal)
                : undefined;
        if (signal.aborted) throw new Error("Screen-share audio preparation was cancelled");
        const target = captureTargetForSelection(selection, this.deps.elementPid(), resolvedWindowPid);
        return new ProcessLoopbackCapture(executable, target, (file, args) => this.deps.spawnProcess(file, args));
    }
}

export function createProcessLoopbackProvider(
    dependencies: ProcessLoopbackProviderDependencies = defaultDependencies,
): ProcessLoopbackScreenShareAudioProvider {
    return new ProcessLoopbackScreenShareAudioProvider(dependencies);
}
