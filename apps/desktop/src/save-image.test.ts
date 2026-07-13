/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi, type Mock } from "vitest";
import { nativeImage, type Session } from "electron";
import fs from "node:fs";
import * as streamPromises from "node:stream/promises";

import { saveImageToFile, writeNativeImage } from "./save-image.js";

vi.mock("electron", () => ({
    nativeImage: {
        createFromDataURL: vi.fn(),
    },
}));

vi.mock("node:fs", () => ({
    default: {
        createWriteStream: vi.fn(),
        promises: {
            writeFile: vi.fn(() => Promise.resolve()),
        },
    },
}));

vi.mock("node:stream/promises", () => ({
    pipeline: vi.fn(() => Promise.resolve()),
}));

const createFromDataURL = vi.mocked(nativeImage.createFromDataURL);
const createWriteStream = vi.mocked(fs.createWriteStream);
const writeFile = vi.mocked(fs.promises.writeFile);
const pipeline = vi.mocked(streamPromises.pipeline);

/** A stub {@link NativeImage} exposing the encoder methods `writeNativeImage` selects between. */
function stubNativeImage(): { toPNG: Mock; toJPEG: Mock; toBitmap: Mock } {
    return {
        toPNG: vi.fn(() => Buffer.from("png")),
        toJPEG: vi.fn(() => Buffer.from("jpeg")),
        toBitmap: vi.fn(() => Buffer.from("bmp")),
    };
}

/** A fake Electron {@link Session} exposing only the `fetch` method used by `saveImageToFile`. */
function fakeSession(fetchImpl: Mock): Session {
    return { fetch: fetchImpl } as unknown as Session;
}

describe("save-image", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createFromDataURL.mockReturnValue(stubNativeImage() as never);
        createWriteStream.mockReturnValue({} as never);
    });

    describe("saveImageToFile", () => {
        it("decodes a data: URL into a NativeImage and writes it without fetching", async () => {
            const session = fakeSession(vi.fn());
            const globalFetch = vi.spyOn(globalThis, "fetch");

            await saveImageToFile("data:image/png;base64,AAAA", "/tmp/out.png", session);

            expect(createFromDataURL).toHaveBeenCalledWith("data:image/png;base64,AAAA");
            expect(writeFile).toHaveBeenCalledTimes(1);
            expect(session.fetch).not.toHaveBeenCalled();
            expect(globalFetch).not.toHaveBeenCalled();
        });

        it("fetches http(s) URLs through the injected session and pipes the body to disk", async () => {
            const body = { kind: "stream" };
            const fetchImpl = vi.fn(() => Promise.resolve({ ok: true, body }));
            const session = fakeSession(fetchImpl);
            const writeStream = { kind: "writeStream" };
            createWriteStream.mockReturnValue(writeStream as never);
            const globalFetch = vi.spyOn(globalThis, "fetch");

            await saveImageToFile("https://hs.example/_matrix/media/v3/download/x/y", "/tmp/out.png", session);

            // Regression assertion (#32362): the injected session fetch is used so the media-auth
            // webRequest interceptors apply; the main-process global fetch must NOT be called.
            expect(fetchImpl).toHaveBeenCalledWith("https://hs.example/_matrix/media/v3/download/x/y");
            expect(globalFetch).not.toHaveBeenCalled();
            expect(createWriteStream).toHaveBeenCalledWith("/tmp/out.png");
            expect(pipeline).toHaveBeenCalledWith(body, writeStream);
        });

        it("throws when the session fetch responds with a non-ok status", async () => {
            const fetchImpl = vi.fn(() => Promise.resolve({ ok: false, statusText: "Not Found" }));
            const session = fakeSession(fetchImpl);

            await expect(saveImageToFile("https://hs.example/image.png", "/tmp/out.png", session)).rejects.toThrow(
                "unexpected response Not Found",
            );
            expect(pipeline).not.toHaveBeenCalled();
        });

        it("throws when the session fetch responds without a body", async () => {
            const fetchImpl = vi.fn(() => Promise.resolve({ ok: true, body: null, statusText: "OK" }));
            const session = fakeSession(fetchImpl);

            await expect(saveImageToFile("https://hs.example/image.png", "/tmp/out.png", session)).rejects.toThrow(
                "unexpected response has no body OK",
            );
            expect(pipeline).not.toHaveBeenCalled();
        });
    });

    describe("writeNativeImage", () => {
        it("encodes .jpg/.jpeg as JPEG", async () => {
            const img = stubNativeImage();
            await writeNativeImage("/tmp/out.jpg", img as never);
            expect(img.toJPEG).toHaveBeenCalledWith(100);
            expect(img.toPNG).not.toHaveBeenCalled();
            expect(img.toBitmap).not.toHaveBeenCalled();
        });

        it("encodes .bmp as a bitmap", async () => {
            const img = stubNativeImage();
            await writeNativeImage("/tmp/out.bmp", img as never);
            expect(img.toBitmap).toHaveBeenCalled();
            expect(img.toPNG).not.toHaveBeenCalled();
        });

        it("encodes unknown extensions as PNG", async () => {
            const img = stubNativeImage();
            await writeNativeImage("/tmp/out.weird", img as never);
            expect(img.toPNG).toHaveBeenCalled();
            expect(img.toJPEG).not.toHaveBeenCalled();
        });
    });
});
