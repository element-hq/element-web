/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeAll, describe, expect, it, vi } from "vitest";
import type { X509Api, X509IpcCommand } from "shared-types";

// `vi.mock` factories are hoisted above top-level constants, so anything they reference must be hoisted too.
const { exposed, invoke } = vi.hoisted(() => ({
    exposed: new Map<string, unknown>(),
    invoke: vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("electron", () => ({
    contextBridge: {
        exposeInMainWorld: (key: string, api: unknown) => exposed.set(key, api),
    },
    ipcRenderer: { invoke, on: vi.fn(), send: vi.fn(), emit: vi.fn() },
}));

describe("preload x509 ipc", () => {
    let x509: X509Api;

    beforeAll(async () => {
        // @ts-ignore `tsc` complains about needing to enable `allowImportingTsExtensions`, but vitest is happy to import this.
        await import("./preload.cts");
        x509 = (exposed.get("electron") as { x509: X509Api }).x509;
    });

    /**
     * Assert the last IPC call was `command` on the "x509" channel.
     */
    function expectInvoked(command: X509IpcCommand, ...args: unknown[]): void {
        expect(invoke).toHaveBeenLastCalledWith("x509", command, ...args);
    }

    it("calls getUserCertificate correctly", async () => {
        const result = { ok: true, data: "certificate" };
        invoke.mockResolvedValueOnce(result);

        await expect(x509.getUserCertificate()).resolves.toBe(result);
        expectInvoked("getUserCertificate");
    });

    it("calls listHardwareKeys correctly", async () => {
        const result = { ok: true, data: [] };
        invoke.mockResolvedValueOnce(result);

        await expect(x509.listHardwareKeys()).resolves.toBe(result);
        expectInvoked("listHardwareKeys");
    });

    it("calls getKeyState correctly", async () => {
        const result = { ok: true, data: "open" };
        invoke.mockResolvedValueOnce(result);

        await expect(x509.getKeyState("SERIAL1")).resolves.toBe(result);
        expectInvoked("getKeyState", "SERIAL1");
    });

    it("calls logIntoKey correctly", async () => {
        const result = { ok: true, data: undefined };
        invoke.mockResolvedValueOnce(result);

        await expect(x509.logIntoKey("SERIAL1", "123456")).resolves.toBe(result);
        expectInvoked("logIntoKey", "SERIAL1", "123456");
    });

    it("calls signData correctly", async () => {
        const data = new Uint8Array([1, 2, 3]);
        const result = { ok: true, data: new Uint8Array([4, 5, 6]) };
        invoke.mockResolvedValueOnce(result);

        await expect(x509.signData("SERIAL1", data)).resolves.toBe(result);
        expectInvoked("signData", "SERIAL1", data);
    });
});
