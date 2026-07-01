/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    canDecodeHeic,
    decodeHeicToJpeg,
    isDecodableHeicContent,
    isHeicContent,
    isHeicFilename,
    isHeicMimeType,
} from "../../../src/utils/heic.ts";

const mockDecodeHeic = jest.fn();

/** Simulate the desktop main process exposing (or not) an OS-backed HEIC decoder. */
function setNativeDecoder(present: boolean): void {
    if (present) {
        (window as any).electron = { decodeHeic: mockDecodeHeic };
    } else {
        delete (window as any).electron;
    }
}

describe("heic utils", () => {
    beforeEach(() => {
        mockDecodeHeic.mockReset();
        setNativeDecoder(false);
    });
    afterEach(() => setNativeDecoder(false));

    describe("isHeicMimeType", () => {
        it.each([
            "image/heic",
            "image/heif",
            "image/heic-sequence",
            "image/heif-sequence",
            "image/HEIC",
            // Apple Uniform Type Identifiers, as sent by e.g. Beeper (element-web#19531)
            "public.heic",
            "public.heif",
            "PUBLIC.HEIC",
        ])("returns true for %s", (m) => expect(isHeicMimeType(m)).toBe(true));

        it("tolerates a charset/parameter suffix", () => {
            expect(isHeicMimeType("image/heic; codecs=hvc1")).toBe(true);
        });

        it.each(["image/jpeg", "image/png", "application/octet-stream", "", undefined])("returns false for %s", (m) =>
            expect(isHeicMimeType(m)).toBe(false),
        );
    });

    describe("isHeicFilename", () => {
        it.each(["IMG_0001.heic", "photo.HEIF", "a.b.heic", "x.heif"])("returns true for %s", (f) =>
            expect(isHeicFilename(f)).toBe(true),
        );
        it.each(["image.jpg", "heic.txt", "myheic", "", undefined])("returns false for %s", (f) =>
            expect(isHeicFilename(f)).toBe(false),
        );
    });

    describe("isHeicContent", () => {
        it("matches on mimetype", () => {
            expect(isHeicContent({ info: { mimetype: "image/heic" }, body: "x.jpg" })).toBe(true);
        });
        it("matches on filename when mimetype is missing/wrong", () => {
            expect(isHeicContent({ filename: "IMG.heic" })).toBe(true);
            expect(isHeicContent({ info: { mimetype: "application/octet-stream" }, body: "IMG.HEIF" })).toBe(true);
        });
        it("falls back to body when filename is absent", () => {
            expect(isHeicContent({ body: "IMG_0001.heic" })).toBe(true);
        });
        it("matches the original report shape: public.heic UTI with an extensionless body", () => {
            // element-web#19531: info.mimetype is the UTI and body has no extension
            expect(isHeicContent({ info: { mimetype: "public.heic" }, body: "ima_355e641" })).toBe(true);
        });
        it("returns false for non-HEIC content and for undefined", () => {
            expect(isHeicContent({ info: { mimetype: "image/jpeg" }, body: "photo.jpg" })).toBe(false);
            expect(isHeicContent(undefined)).toBe(false);
        });
    });

    describe("canDecodeHeic", () => {
        it("is true only when the desktop main process exposes a decoder", () => {
            setNativeDecoder(true);
            expect(canDecodeHeic()).toBe(true);
            setNativeDecoder(false);
            expect(canDecodeHeic()).toBe(false);
        });
    });

    describe("isDecodableHeicContent", () => {
        const heic = { info: { mimetype: "image/heic" }, body: "IMG.heic" };
        it("is true for HEIC content only when a decoder is available", () => {
            setNativeDecoder(true);
            expect(isDecodableHeicContent(heic)).toBe(true);
        });
        it("is false for HEIC content when no decoder is available (graceful degradation)", () => {
            setNativeDecoder(false);
            expect(isDecodableHeicContent(heic)).toBe(false);
        });
        it("is false for non-HEIC content even with a decoder", () => {
            setNativeDecoder(true);
            expect(isDecodableHeicContent({ info: { mimetype: "image/jpeg" }, body: "a.jpg" })).toBe(false);
        });
    });

    describe("decodeHeicToJpeg", () => {
        it("decodes a blob to JPEG via the OS decoder", async () => {
            setNativeDecoder(true);
            mockDecodeHeic.mockResolvedValue(new Uint8Array([1, 2, 3]));

            const result = await decodeHeicToJpeg(new Blob(["heic"], { type: "image/heic" }));

            expect(result).toBeInstanceOf(Blob);
            expect(result.type).toBe("image/jpeg");
            expect(mockDecodeHeic).toHaveBeenCalledWith(expect.any(Uint8Array));
        });

        it("rejects when no decoder is available", async () => {
            setNativeDecoder(false);
            await expect(decodeHeicToJpeg(new Blob(["heic"], { type: "image/heic" }))).rejects.toThrow(
                /No HEIC decoder/,
            );
        });

        it("rejects when the decode never resolves (timeout)", async () => {
            setNativeDecoder(true);
            jest.useFakeTimers();
            try {
                mockDecodeHeic.mockReturnValue(new Promise<Uint8Array>(() => {})); // never resolves
                const promise = decodeHeicToJpeg(new Blob(["heic"], { type: "image/heic" }));
                promise.catch(() => {}); // handle the rejection now, before timers fire, to avoid an unhandled rejection
                await jest.advanceTimersByTimeAsync(30_000);
                await expect(promise).rejects.toThrow(/timed out/);
            } finally {
                jest.useRealTimers();
            }
        });
    });
});
