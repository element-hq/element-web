/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { EventEmitter } from "node:events";

// Capture the IPC handler heic.ts registers so we can drive it directly, and mock the child process so
// the tests never spawn the real native binary.
type DecodeHandler = (ev: unknown, bytes: Uint8Array) => Promise<Uint8Array>;
let decodeHeic: DecodeHandler | undefined;

vi.mock("electron", () => ({
    app: { isPackaged: false },
    ipcMain: {
        handle: vi.fn((channel: string, handler: DecodeHandler) => {
            if (channel === "decodeHeic") decodeHeic = handler;
        }),
    },
}));

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({ spawn: (...args: unknown[]): unknown => spawnMock(...args) }));

/** A minimal stand-in for the spawned helper's ChildProcess — only the bits heic.ts touches. */
type FakeChild = EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: EventEmitter & { end: Mock };
    kill: Mock;
};
function makeFakeChild(): FakeChild {
    const child = new EventEmitter() as FakeChild;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = Object.assign(new EventEmitter(), { end: vi.fn() });
    child.kill = vi.fn();
    return child;
}

// heic.ts only registers the handler on macOS; force darwin so the test runs on any CI host, and load
// the module (a dynamic import so it happens after the override) to trigger registration.
const originalPlatform = process.platform;
beforeAll(async () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    await import("./heic.js");
});
afterAll(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
});

describe("decodeHeic IPC handler", () => {
    beforeEach(() => {
        spawnMock.mockReset();
    });

    it("registers the handler on macOS", () => {
        expect(decodeHeic).toBeInstanceOf(Function);
    });

    it("pipes the input to the helper and resolves its stdout on success", async () => {
        const child = makeFakeChild();
        spawnMock.mockReturnValue(child);

        const promise = decodeHeic!({}, new Uint8Array([1, 2, 3]));
        child.stdout.emit("data", Buffer.from([0xff, 0xd8]));
        child.emit("close", 0);

        await expect(promise).resolves.toEqual(Buffer.from([0xff, 0xd8]));
        expect(child.stdin.end).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    });

    it("rejects with the helper's stderr when it exits non-zero", async () => {
        const child = makeFakeChild();
        spawnMock.mockReturnValue(child);

        const promise = decodeHeic!({}, new Uint8Array([1]));
        child.stderr.emit("data", Buffer.from("could not decode image"));
        child.emit("close", 3);

        await expect(promise).rejects.toThrow(/exited 3: could not decode image/);
    });

    it("rejects if the helper cannot be spawned", async () => {
        const child = makeFakeChild();
        spawnMock.mockReturnValue(child);

        const promise = decodeHeic!({}, new Uint8Array([1]));
        child.emit("error", new Error("spawn ENOENT"));

        await expect(promise).rejects.toThrow(/ENOENT/);
    });

    it("kills the helper and rejects on timeout", async () => {
        vi.useFakeTimers();
        try {
            const child = makeFakeChild();
            spawnMock.mockReturnValue(child);

            const promise = decodeHeic!({}, new Uint8Array([1]));
            promise.catch(() => {}); // avoid an unhandled rejection when the timer fires
            await vi.advanceTimersByTimeAsync(30_000);

            await expect(promise).rejects.toThrow(/timed out/);
            expect(child.kill).toHaveBeenCalledWith("SIGKILL");
        } finally {
            vi.useRealTimers();
        }
    });
});
