/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    captureTargetForSelection,
    createDevelopmentProcessLoopbackProvider,
    getProcessLoopbackProviderAudit,
    parseResolvedWindowPid,
    parseWindowSourceId,
    ProcessLoopbackScreenShareAudioProvider,
    type ProcessLoopbackProviderDependencies,
} from "./process-loopback-provider.js";

const electronApp = vi.hoisted(() => ({ isPackaged: false }));
vi.mock("electron", () => ({ app: electronApp }));

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
    public readonly kill = vi.fn(() => {
        this.close();
        return true;
    });

    public constructor() {
        super();
        this.stdin.once("finish", () => this.close());
    }

    private close(): void {
        if (this.exitCode !== null) return;
        this.exitCode = 0;
        queueMicrotask(() => this.emit("close", 0, null));
    }
}

function dependencies(child: FakeChild): ProcessLoopbackProviderDependencies {
    return {
        executableAvailable: vi.fn(async () => true),
        resolveWindowPid: vi.fn(async () => 321),
        spawnProcess: vi.fn(() => child as unknown as ChildProcessWithoutNullStreams),
        elementPid: vi.fn(() => 123),
    };
}

describe("process-loopback screen-share audio provider", () => {
    afterEach(() => {
        delete process.env.ELEMENT_SCREEN_SHARE_AUDIO_PROCESS_LOOPBACK_EXECUTABLE;
        electronApp.isPackaged = false;
    });

    it("is enabled only by an absolute executable path in unpackaged Windows development", () => {
        process.env.ELEMENT_SCREEN_SHARE_AUDIO_PROCESS_LOOPBACK_EXECUTABLE = "helper.exe";
        expect(createDevelopmentProcessLoopbackProvider()).toBeUndefined();
        process.env.ELEMENT_SCREEN_SHARE_AUDIO_PROCESS_LOOPBACK_EXECUTABLE = process.execPath;
        expect(createDevelopmentProcessLoopbackProvider()).toBeInstanceOf(ProcessLoopbackScreenShareAudioProvider);
        electronApp.isPackaged = true;
        expect(createDevelopmentProcessLoopbackProvider()).toBeUndefined();
    });

    it("strictly maps window sources to INCLUDE and screens to Element-tree EXCLUDE", () => {
        expect(parseWindowSourceId("window:456:0")).toBe(456);
        expect(() => parseWindowSourceId("screen:0:0")).toThrow();
        expect(parseResolvedWindowPid("pid=789\n")).toBe(789);
        expect(() => parseResolvedWindowPid("pid=0\n")).toThrow();
        expect(captureTargetForSelection({ sourceId: "window:456:0", kind: "window" }, 123, 789)).toEqual({
            pid: 789,
            mode: "include",
        });
        expect(captureTargetForSelection({ sourceId: "screen:0:0", kind: "screen" }, 123)).toEqual({
            pid: 123,
            mode: "exclude",
        });
        expect(() => captureTargetForSelection({ sourceId: "screen:0:0", kind: "window" }, 123, 789)).toThrow();
    });

    it("resolves a freshly validated window before constructing capture", async () => {
        const child = new FakeChild();
        const deps = dependencies(child);
        const provider = new ProcessLoopbackScreenShareAudioProvider("C:\\helper.exe", deps);
        const abort = new AbortController();
        expect(await provider.getAvailability()).toBe("available");
        await provider.prepare({ sourceId: "window:456:0", kind: "window" }, abort.signal);
        expect(deps.resolveWindowPid).toHaveBeenCalledWith("C:\\helper.exe", "window:456:0", abort.signal);
    });

    it("streams fixed PCM packets and reaps the producer on explicit release", async () => {
        const child = new FakeChild();
        const deps = dependencies(child);
        const provider = new ProcessLoopbackScreenShareAudioProvider("C:\\helper.exe", deps);
        const capture = await provider.prepare(
            { sourceId: "screen:0:0", kind: "screen" },
            new AbortController().signal,
        );
        const post = vi.fn(() => true);
        const start = capture.start({ pendingPackets: 0, post });
        child.stdout.write(startPacket());
        await start;
        child.stdout.write(framedPacket(2, 0, 0, Buffer.alloc(1_920, 1)));
        expect(deps.spawnProcess).toHaveBeenCalledWith("C:\\helper.exe", ["stream", "123", "exclude"]);
        expect(post).toHaveBeenCalledOnce();
        expect(post.mock.calls[0][0]).toMatchObject({ sequence: 0, startFrame: 0 });
        expect(getProcessLoopbackProviderAudit().processes).toBe(1);
        await capture.stop();
        expect(child.stdin.readableEnded || child.stdin.writableEnded).toBe(true);
        expect(getProcessLoopbackProviderAudit()).toEqual({ processes: 0, timers: 0 });
    });

    it("surfaces malformed producer output once and still reaps it", async () => {
        const child = new FakeChild();
        const provider = new ProcessLoopbackScreenShareAudioProvider("C:\\helper.exe", dependencies(child));
        const capture = await provider.prepare(
            { sourceId: "screen:0:0", kind: "screen" },
            new AbortController().signal,
        );
        const terminal = vi.fn();
        capture.onTerminal(terminal);
        const start = capture.start({ pendingPackets: 0, post: vi.fn(() => true) });
        child.stdout.write(startPacket());
        await start;
        child.stdout.write(Buffer.alloc(48));
        await vi.waitFor(() => expect(terminal).toHaveBeenCalledOnce());
        await capture.stop();
        expect(getProcessLoopbackProviderAudit()).toEqual({ processes: 0, timers: 0 });
    });
});
