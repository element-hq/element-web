/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import fetchMock from "@fetch-mock/jest";

import { MediaEventHelper } from "../../../src/utils/MediaEventHelper.ts";
import { stubClient } from "../../test-utils";

// HEIC is decoded to JPEG only when building the display URL; sourceBlob/thumbnailBlob keep the raw
// bytes. The real routing/decoder is covered in heic-test.ts; here we just verify MediaEventHelper
// wires it in — decoding when (and only when) the content is HEIC.
const mockDecodeHeicToJpeg = jest.fn(async (_blob: Blob) => new Blob(["jpeg"], { type: "image/jpeg" }));
// Keep the real content routing (isHeicContent/isHeicMimeType/isHeicFilename) so decoding is gated
// realistically; only the actual libheif decoder is stubbed (never pull the real ~3MB decoder).
jest.mock("../../../src/utils/heic.ts", () => ({
    ...jest.requireActual("../../../src/utils/heic.ts"),
    decodeHeicToJpeg: (blob: Blob) => mockDecodeHeicToJpeg(blob),
}));

// Simulate encrypted media: decryptFile yields the original (undecoded) bytes for the display path.
const mockDecryptFile = jest.fn();
jest.mock("../../../src/utils/DecryptFile.ts", () => ({
    decryptFile: (...args: unknown[]) => mockDecryptFile(...args),
}));

describe("MediaEventHelper", () => {
    // MediaEventHelper only takes the HEIC decode path where the platform can decode it (real
    // isDecodableHeicContent → canDecodeHeic → window.electron.decodeHeic); simulate that here.
    beforeEach(() => {
        (window as any).electron = { decodeHeic: jest.fn() };
    });
    afterEach(() => {
        delete (window as any).electron;
    });

    it("should set the mime type on the blob based on the event metadata", async () => {
        stubClient();

        const event = new MatrixEvent({
            type: "m.room.message",
            content: {
                msgtype: "m.image",
                body: "image.png",
                info: {
                    mimetype: "image/png",
                    size: 1234,
                    w: 100,
                    h: 100,
                    thumbnail_info: {
                        mimetype: "image/png",
                    },
                    thumbnail_url: "mxc://matrix.org/thumbnail",
                },
                url: "mxc://matrix.org/abcdef",
            },
        });
        const helper = new MediaEventHelper(event);

        const blob = await helper.thumbnailBlob.value;
        expect(blob?.type).toBe(event.getContent().info.thumbnail_info?.mimetype);
    });

    it("keeps raw HEIC bytes in sourceBlob and decodes to JPEG only when building the source URL", async () => {
        stubClient();
        mockDecodeHeicToJpeg.mockClear();
        // downloadSource() requires a 200 response (unlike the thumbnail path).
        fetchMock.get("end:/matrix.org/heicsource", { status: 200, body: "heic-bytes" });

        const event = new MatrixEvent({
            type: "m.room.message",
            content: {
                msgtype: "m.image",
                body: "photo.heic",
                info: { mimetype: "image/heic", size: 4321, w: 100, h: 100 },
                url: "mxc://matrix.org/heicsource",
            },
        });
        const helper = new MediaEventHelper(event);

        // sourceBlob holds the original (undecoded) HEIC bytes — the decoder isn't touched yet.
        const blob = await helper.sourceBlob.value;
        expect(blob.type).toBe("image/heic");
        expect(mockDecodeHeicToJpeg).not.toHaveBeenCalled();

        // Building the display URL decodes the very same blob to JPEG.
        expect(await helper.sourceUrl.value).toBe("blob");
        expect(mockDecodeHeicToJpeg).toHaveBeenCalledWith(blob);
    });

    it("rejects the source URL when HEIC decoding fails, rather than surfacing undecodable HEIC bytes", async () => {
        stubClient();
        mockDecodeHeicToJpeg.mockClear();
        // The OS decoder is present but fails on this file. We must not fall back to the raw HEIC bytes
        // (an <img> can't render them — a broken image); the rejection lets the image body show its error.
        mockDecodeHeicToJpeg.mockRejectedValueOnce(new Error("decode failed"));
        fetchMock.get("end:/matrix.org/heicsource", { status: 200, body: "heic-bytes" });

        const event = new MatrixEvent({
            type: "m.room.message",
            content: {
                msgtype: "m.image",
                body: "photo.heic",
                info: { mimetype: "image/heic", size: 4321, w: 100, h: 100 },
                url: "mxc://matrix.org/heicsource",
            },
        });
        const helper = new MediaEventHelper(event);

        await expect(helper.sourceUrl.value).rejects.toThrow("decode failed");
    });

    it("does not decode an encrypted non-HEIC image (AVIF) when building the source URL", async () => {
        stubClient();
        mockDecodeHeicToJpeg.mockClear();
        (URL.createObjectURL as jest.Mock).mockClear();
        // AVIF ISO-BMFF carries the `mif1` brand HEIC once matched on; make sure content routing —
        // not a blind byte sniff — keeps it out of the decoder. decryptFile returns the raw AVIF bytes.
        const avifBlob = new Blob(["avif-bytes"], { type: "image/avif" });
        mockDecryptFile.mockResolvedValue(avifBlob);

        const event = new MatrixEvent({
            type: "m.room.message",
            content: {
                msgtype: "m.image",
                body: "photo.avif",
                info: { mimetype: "image/avif", size: 4321, w: 100, h: 100 },
                file: { url: "mxc://matrix.org/avifsource" },
            },
        });
        const helper = new MediaEventHelper(event);

        // sourceBlob holds the decrypted (original) AVIF bytes.
        const blob = await helper.sourceBlob.value;
        expect(blob.type).toBe("image/avif");
        expect(mockDecodeHeicToJpeg).not.toHaveBeenCalled();

        // The display URL is built from those same undecoded bytes — AVIF is never routed to the decoder.
        expect(await helper.sourceUrl.value).toBe("blob");
        expect(mockDecodeHeicToJpeg).not.toHaveBeenCalled();
        expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    });

    it("keeps raw HEIC bytes in thumbnailBlob and decodes to JPEG only when building the thumbnail URL", async () => {
        stubClient();
        mockDecodeHeicToJpeg.mockClear();

        const event = new MatrixEvent({
            type: "m.room.message",
            content: {
                msgtype: "m.image",
                body: "photo.heic",
                info: {
                    mimetype: "image/heic",
                    size: 4321,
                    w: 100,
                    h: 100,
                    thumbnail_info: { mimetype: "image/heic" },
                    thumbnail_url: "mxc://matrix.org/heicthumb",
                },
                url: "mxc://matrix.org/heicsource",
            },
        });
        const helper = new MediaEventHelper(event);

        const blob = await helper.thumbnailBlob.value;
        expect(blob?.type).toBe("image/heic");
        expect(mockDecodeHeicToJpeg).not.toHaveBeenCalled();

        expect(await helper.thumbnailUrl.value).toBe("blob");
        expect(mockDecodeHeicToJpeg).toHaveBeenCalledWith(blob);
    });
});
