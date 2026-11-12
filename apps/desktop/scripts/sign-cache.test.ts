/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { createHash } from "node:crypto";
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CustomWindowsSignTaskConfiguration, WinPackager } from "app-builder-lib";

import { createCachedSign, type Exec, getAuthenticodeSignature } from "./sign-cache.ts";

const THUMBPRINT = "ABCDEF0123456789";
const UNSIGNED = "unsigned contents";
const SIGNED = "signed contents";
const CACHED = "cached signed contents";

const sha256 = (data: string): string => createHash("sha256").update(data).digest("hex");

describe("getAuthenticodeSignature", () => {
    it("should return the status and upper-case thumbprint of a signed file", async () => {
        const exec = vi.fn<Exec>().mockResolvedValue("Valid abcdef0123456789\r\n");

        await expect(getAuthenticodeSignature("C:\\app\\ffmpeg.dll", exec)).resolves.toEqual({
            status: "Valid",
            thumbprint: THUMBPRINT,
        });
        expect(exec).toHaveBeenCalledWith(
            "powershell",
            expect.any(Array),
            expect.objectContaining({ ED_SIGN_FILE: "C:\\app\\ffmpeg.dll" }),
        );
    });

    it("should return no thumbprint for an unsigned file", async () => {
        const exec = vi.fn<Exec>().mockResolvedValue("NotSigned \r\n");

        await expect(getAuthenticodeSignature("ffmpeg.dll", exec)).resolves.toEqual({
            status: "NotSigned",
            thumbprint: undefined,
        });
    });
});

describe("createCachedSign", () => {
    it("should return null if the cache url is not set", () => {
        expect(createCachedSign({ ED_SIGNTOOL_THUMBPRINT: THUMBPRINT })).toBeNull();
    });

    it("should return null if the thumbprint is not set", () => {
        expect(createCachedSign({ ED_SIGN_CACHE_URL: "https://example.com/cache" })).toBeNull();
    });

    let tmpDir: string;
    let stagingDir: string;
    let doSign: Mock<(config: CustomWindowsSignTaskConfiguration) => Promise<void>>;
    let packager: WinPackager;
    let exec: Mock<Exec>;
    let fetchMock: Mock<typeof fetch>;

    const signFile = async (name: string): Promise<string> => {
        const file = path.join(tmpDir, name);
        await fsp.writeFile(file, UNSIGNED);
        const sign = createCachedSign(
            {
                // Trailing slash to check it is not doubled up in the fetched URL
                ED_SIGN_CACHE_URL: "https://example.com/cache/",
                ED_SIGN_CACHE_DIR: stagingDir,
                ED_SIGNTOOL_THUMBPRINT: THUMBPRINT,
            },
            exec,
        );
        await sign!({ path: file } as CustomWindowsSignTaskConfiguration, packager);
        return file;
    };

    beforeEach(async () => {
        tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "sign-cache-test-"));
        stagingDir = path.join(tmpDir, "staging");
        doSign = vi.fn<(config: CustomWindowsSignTaskConfiguration) => Promise<void>>(async (config) => {
            await fsp.writeFile(config.path, SIGNED);
        });
        packager = { signingManager: { value: Promise.resolve({ doSign }) } } as unknown as WinPackager;
        exec = vi.fn<Exec>().mockResolvedValue(`Valid ${THUMBPRINT}\r\n`);
        fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(CACHED));
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(async () => {
        vi.unstubAllGlobals();
        await fsp.rm(tmpDir, { recursive: true, force: true });
    });

    it("should always sign executables", async () => {
        const file = await signFile("app.exe");

        expect(fetchMock).not.toHaveBeenCalled();
        expect(doSign).toHaveBeenCalledWith(expect.objectContaining({ path: file }), packager);
        await expect(fsp.readdir(tmpDir)).resolves.toEqual(["app.exe"]);
    });

    it("should reuse a cached copy of Squirrel.exe", async () => {
        const file = await signFile("Squirrel.exe");

        expect(fetchMock).toHaveBeenCalledWith(`https://example.com/cache/${THUMBPRINT}/${sha256(UNSIGNED)}.exe`);
        expect(doSign).not.toHaveBeenCalled();
        await expect(fsp.readFile(file, "utf8")).resolves.toBe(CACHED);
    });

    it("should reuse a cached copy signed by our certificate", async () => {
        const file = await signFile("ffmpeg.dll");

        expect(fetchMock).toHaveBeenCalledWith(`https://example.com/cache/${THUMBPRINT}/${sha256(UNSIGNED)}.dll`);
        expect(exec).toHaveBeenCalledWith(
            "powershell",
            expect.any(Array),
            expect.objectContaining({ ED_SIGN_FILE: expect.stringMatching(/ffmpeg\.dll$/) }),
        );
        expect(doSign).not.toHaveBeenCalled();
        await expect(fsp.readFile(file, "utf8")).resolves.toBe(CACHED);
        await expect(fsp.access(stagingDir)).rejects.toThrow("ENOENT");
    });

    it.each([
        ["not validly signed", "NotSigned "],
        ["signed by another certificate", "Valid 0000000000000000"],
    ])("should sign and stage the file if the cached copy is %s", async (_, verifyOutput) => {
        exec.mockResolvedValue(verifyOutput);

        const file = await signFile("seshat.node");

        expect(doSign).toHaveBeenCalled();
        await expect(fsp.readFile(file, "utf8")).resolves.toBe(SIGNED);
        await expect(fsp.readFile(path.join(stagingDir, THUMBPRINT, `${sha256(UNSIGNED)}.node`), "utf8")).resolves.toBe(
            SIGNED,
        );
    });

    it("should sign and stage the file if it is not in the cache", async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

        const file = await signFile("ffmpeg.dll");

        expect(exec).not.toHaveBeenCalled();
        expect(doSign).toHaveBeenCalled();
        await expect(fsp.readFile(file, "utf8")).resolves.toBe(SIGNED);
        await expect(fsp.readFile(path.join(stagingDir, THUMBPRINT, `${sha256(UNSIGNED)}.dll`), "utf8")).resolves.toBe(
            SIGNED,
        );
    });

    it.each([
        ["the request fails", () => fetchMock.mockRejectedValue(new Error("network down"))],
        ["the server errors", () => fetchMock.mockResolvedValue(new Response(null, { status: 500 }))],
        ["verification fails", () => exec.mockRejectedValue(new Error("powershell missing"))],
    ])("should fall back to signing if %s", async (_, setup) => {
        setup();

        const file = await signFile("ffmpeg.dll");

        expect(doSign).toHaveBeenCalled();
        await expect(fsp.readFile(file, "utf8")).resolves.toBe(SIGNED);
    });
});
