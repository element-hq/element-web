/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "node:events";
import path from "node:path";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    captureTargetForSelection,
    isCompatibleProcessLoopbackProbe,
    parseWindowsBuild,
    parseResolvedWindowPid,
    parseWindowSourceId,
    ProcessLoopbackScreenShareAudioProvider,
    type ProcessLoopbackProviderDependencies,
    type ProcessLoopbackRuntime,
    resolveProcessLoopbackExecutable,
} from "./process-loopback-provider.js";

vi.mock("electron", () => ({ app: { isPackaged: false, getAppPath: () => "C:\\app" } }));

function framedPacket(type: number, sequence: number, startFrame: number, payload = Buffer.alloc(0)): Buffer {
    const result = Buffer.alloc(48 + payload.length);
    result.writeUInt32LE(0x414d4350, 0);
    result.writeUInt16LE(1, 4);
    result.writeUInt16LE(type, 6);
    result.writeUInt32LE(48, 8);
    result.writeUInt32LE(payload.length, 12);
    result.writeBigUInt64LE(BigInt(sequence), 16);
    result.writeBigUInt64LE(BigInt(startFrame), 24);
    payload.copy(result, 48);
    return result;
}

function startPacket(): Buffer {
    const format = Buffer.alloc(16);
    format.writeUInt32LE(48_000, 0);
    format.writeUInt16LE(2, 4);
    format.writeUInt16LE(16, 6);
    format.writeUInt16LE(4, 8);
    format.writeUInt32LE(192_000, 12);
    return framedPacket(1, 0, 0, format);
}

class FakeChild extends EventEmitter {
    public readonly stdin = new PassThrough();
    public readonly stdout = new PassThrough();
    public readonly stderr = new PassThrough();
    public exitCode: number | null = null;
    public signalCode: NodeJS.Signals | null = null;
    public readonly kill;
    public readonly unref = vi.fn();

    public constructor(closeOnStop = true, closeOnKill = true) {
        super();
        this.kill = vi.fn(() => {
            if (closeOnKill) this.close();
            return closeOnKill;
        });
        if (closeOnStop) this.stdin.once("finish", () => this.close());
    }

    public close(exitCode = 0): void {
        if (this.exitCode !== null) return;
        this.exitCode = exitCode;
        queueMicrotask(() => this.emit("close", exitCode, null));
    }
}

const availableProbe = "protocol=1\nformat=48000,2,pcm-s16le\n";
const unpackagedExecutable = path.join(
    "C:\\app",
    "native",
    "windows-process-loopback",
    "build",
    "windows-x64",
    "windows-process-loopback.exe",
);
const baseRuntime: ProcessLoopbackRuntime = {
    platform: "win32",
    arch: "x64",
    windowsBuild: 22_631,
    isPackaged: false,
    resourcesPath: "C:\\resources",
    appPath: "C:\\app",
};

function dependencies(
    child = new FakeChild(),
    runtime: Partial<ProcessLoopbackRuntime> = {},
): ProcessLoopbackProviderDependencies {
    return {
        runtime: vi.fn(() => ({ ...baseRuntime, ...runtime })),
        executableAvailable: vi.fn(async () => true),
        probe: vi.fn(async () => availableProbe),
        resolveWindowPid: vi.fn(async () => 321),
        spawnProcess: vi.fn(() => child as unknown as ChildProcessWithoutNullStreams),
        elementPid: vi.fn(() => 123),
    };
}

describe("process-loopback screen-share audio provider", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("resolves fixed packaged and unpackaged helper paths", () => {
        expect(resolveProcessLoopbackExecutable(baseRuntime)).toBe(unpackagedExecutable);
        expect(resolveProcessLoopbackExecutable({ ...baseRuntime, isPackaged: true })).toBe(
            path.join("C:\\resources", "screen-share-audio", "windows-process-loopback.exe"),
        );
    });

    it("extracts only a valid Windows build number", () => {
        expect(parseWindowsBuild("10.0.22631")).toBe(22_631);
        expect(parseWindowsBuild("not-a-windows-release")).toBe(0);
    });

    it("accepts only the exact protocol and PCM compatibility probe", () => {
        expect(isCompatibleProcessLoopbackProbe(availableProbe)).toBe(true);
        expect(isCompatibleProcessLoopbackProbe("protocol=2\nformat=48000,2,pcm-s16le\n")).toBe(false);
        expect(isCompatibleProcessLoopbackProbe("protocol=1\nformat=48000,1,pcm-s16le\n")).toBe(false);
    });

    it.each([
        [{ platform: "linux" }, "unsupported"],
        [{ arch: "arm64" }, "unsupported"],
        [{ arch: "ia32" }, "unsupported"],
        [{ windowsBuild: 20_347 }, "unsupported"],
    ] as const)("fails closed before filesystem access for unsupported runtime %j", async (runtime, expected) => {
        const deps = dependencies(new FakeChild(), runtime);
        const provider = new ProcessLoopbackScreenShareAudioProvider(deps);
        await expect(provider.getAvailability()).resolves.toBe(expected);
        expect(deps.executableAvailable).not.toHaveBeenCalled();
        expect(deps.probe).not.toHaveBeenCalled();
    });

    it("reports missing and mismatched helpers as unavailable", async () => {
        const missing = dependencies();
        vi.mocked(missing.executableAvailable).mockResolvedValue(false);
        await expect(new ProcessLoopbackScreenShareAudioProvider(missing).getAvailability()).resolves.toBe(
            "unavailable",
        );
        expect(missing.probe).not.toHaveBeenCalled();

        const mismatch = dependencies();
        vi.mocked(mismatch.probe).mockResolvedValue("protocol=2\nformat=48000,2,pcm-s16le\n");
        await expect(new ProcessLoopbackScreenShareAudioProvider(mismatch).getAvailability()).resolves.toBe(
            "unavailable",
        );
    });

    it("strictly maps window sources to INCLUDE and screens to Element-tree EXCLUDE", () => {
        expect(parseWindowSourceId("window:456:0")).toBe(456);
        expect(() => parseWindowSourceId("screen:0:0")).toThrow();
        expect(parseResolvedWindowPid("pid=789\r\n")).toBe(789);
        expect(() => parseResolvedWindowPid("pid=789\nextra=unsafe\n")).toThrow();
        expect(captureTargetForSelection({ sourceId: "window:456:0", kind: "window" }, 123, 789)).toEqual({
            pid: 789,
            mode: "include",
        });
        expect(captureTargetForSelection({ sourceId: "screen:0:0", kind: "screen" }, 123)).toEqual({
            pid: 123,
            mode: "exclude",
        });
    });

    it("revalidates a window and spawns exact INCLUDE arguments", async () => {
        const child = new FakeChild();
        const deps = dependencies(child);
        const provider = new ProcessLoopbackScreenShareAudioProvider(deps);
        const abort = new AbortController();
        await expect(provider.getAvailability()).resolves.toBe("available");
        const capture = await provider.prepare({ sourceId: "window:456:0", kind: "window" }, abort.signal);
        expect(deps.probe).toHaveBeenCalledTimes(1);
        expect(deps.resolveWindowPid).toHaveBeenCalledWith(unpackagedExecutable, "window:456:0", abort.signal);
        const started = capture.start({ pendingPackets: 0, post: vi.fn(() => true) });
        child.stdout.write(startPacket());
        await started;
        expect(deps.spawnProcess).toHaveBeenCalledWith(unpackagedExecutable, ["stream", "321", "include"]);
        await capture.stop();
    });

    it("streams exact EXCLUDE PCM packets and reaps on explicit release", async () => {
        const child = new FakeChild();
        const deps = dependencies(child);
        const provider = new ProcessLoopbackScreenShareAudioProvider(deps);
        const capture = await provider.prepare(
            { sourceId: "screen:0:0", kind: "screen" },
            new AbortController().signal,
        );
        const post = vi.fn((_packet: unknown) => true);
        const started = capture.start({ pendingPackets: 0, post });
        child.stdout.write(startPacket());
        await started;
        child.stdout.write(framedPacket(2, 0, 0, Buffer.alloc(1_920, 1)));
        expect(deps.spawnProcess).toHaveBeenCalledWith(unpackagedExecutable, ["stream", "123", "exclude"]);
        expect(post).toHaveBeenCalledOnce();
        expect(post.mock.calls[0][0]).toMatchObject({ sequence: 0, startFrame: 0 });
        await capture.stop();
        expect(child.stdin.writableEnded).toBe(true);
    });

    it("surfaces malformed transport and unexpected producer closure", async () => {
        for (const fail of [
            (child: FakeChild) => child.stdout.write(Buffer.alloc(48)),
            (child: FakeChild) => child.close(3),
        ]) {
            const child = new FakeChild(false);
            const capture = await new ProcessLoopbackScreenShareAudioProvider(dependencies(child)).prepare(
                { sourceId: "screen:0:0", kind: "screen" },
                new AbortController().signal,
            );
            const terminal = vi.fn();
            capture.onTerminal(terminal);
            const started = capture.start({ pendingPackets: 0, post: vi.fn(() => true) });
            child.stdout.write(startPacket());
            await started;
            fail(child);
            await vi.waitFor(() => expect(terminal).toHaveBeenCalledOnce());
            child.close();
            await capture.stop();
        }
    });

    it("fails closed on producer startup stall and bounds forced reap", async () => {
        vi.useFakeTimers();
        const child = new FakeChild(false);
        const capture = await new ProcessLoopbackScreenShareAudioProvider(dependencies(child)).prepare(
            { sourceId: "screen:0:0", kind: "screen" },
            new AbortController().signal,
        );
        const terminal = vi.fn();
        capture.onTerminal(terminal);
        const started = capture.start({ pendingPackets: 0, post: vi.fn(() => true) });
        const rejection = started.catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(5_000);
        expect(await rejection).toEqual(
            expect.objectContaining({ message: expect.stringContaining("start timed out") }),
        );
        expect(terminal).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(750);
        expect(child.kill).toHaveBeenCalledOnce();
        expect(child.unref).toHaveBeenCalledOnce();
        expect([child.stdin.destroyed, child.stdout.destroyed, child.stderr.destroyed]).toEqual([true, true, true]);
        await capture.stop();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("releases all owned resources when a producer cannot be reaped", async () => {
        vi.useFakeTimers();
        const child = new FakeChild(false, false);
        const capture = await new ProcessLoopbackScreenShareAudioProvider(dependencies(child)).prepare(
            { sourceId: "screen:0:0", kind: "screen" },
            new AbortController().signal,
        );
        const terminal = vi.fn();
        capture.onTerminal(terminal);
        const started = capture.start({ pendingPackets: 0, post: vi.fn(() => true) });
        child.stdout.write(startPacket());
        await started;

        const firstStop = capture.stop();
        const repeatedStop = capture.stop();
        expect(repeatedStop).toBe(firstStop);
        const rejection = firstStop.catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(await rejection).toEqual(
            expect.objectContaining({ message: "Process-loopback producer did not stop within the bounded deadline" }),
        );
        expect(child.kill).toHaveBeenCalledOnce();
        expect(
            (
                capture as typeof capture & {
                    getOwnershipAuditForTest(): Record<string, number>;
                }
            ).getOwnershipAuditForTest(),
        ).toEqual({
            childReferences: 0,
            sinkReferences: 0,
            timers: 0,
            childListeners: 0,
            terminalListeners: 0,
        });
        expect(vi.getTimerCount()).toBe(0);
        await expect(capture.stop()).rejects.toThrow("did not stop within the bounded deadline");
    });
});
