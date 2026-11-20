/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";

import { MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { type EncryptedFile } from "matrix-js-sdk/src/types";
import { stubClient } from "test-utils";

import { MediaEventHelper } from "./MediaEventHelper.ts";
import { cacheUploadedMedia, clearUploadedMediaCache } from "./UploadedMediaCache.ts";
import * as DecryptFile from "./DecryptFile.ts";

describe("MediaEventHelper", () => {
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

    it.each([
        ["captioned image", { msgtype: "m.image", filename: "image.png", body: "A caption" }, true],
        ["captioned file", { msgtype: "m.file", filename: "doc.pdf", body: "A caption" }, true],
        ["image without filename", { msgtype: "m.image", body: "image.png" }, false],
        ["image whose body is its filename", { msgtype: "m.image", filename: "image.png", body: "image.png" }, false],
        ["text message", { msgtype: "m.text", filename: "image.png", body: "Hello" }, false],
        // The body of a gallery is its caption, there is no file name to compare it with.
        ["captioned gallery", { msgtype: "dm.filament.gallery", body: "A caption", itemtypes: [] }, true],
        ["captioned gallery with the stable msgtype", { msgtype: "m.gallery", body: "A caption" }, true],
        ["gallery with an empty body", { msgtype: "dm.filament.gallery", body: "", itemtypes: [] }, false],
        ["gallery with a blank body", { msgtype: "dm.filament.gallery", body: "  ", itemtypes: [] }, false],
    ])("hasCaption returns the expected value for a %s", (_, content, expected) => {
        const event = new MatrixEvent({ type: "m.room.message", content });
        expect(MediaEventHelper.hasCaption(event)).toBe(expected);
    });

    it.each([
        ["image", { msgtype: "m.image", body: "image.png", url: "mxc://matrix.org/abcdef" }, true],
        ["video", { msgtype: "m.video", body: "video.mp4", url: "mxc://matrix.org/abcdef" }, true],
        ["gallery", { msgtype: "dm.filament.gallery", body: "", itemtypes: [] }, true],
        ["gallery with the stable msgtype", { msgtype: "m.gallery", body: "", itemtypes: [] }, true],
        ["file", { msgtype: "m.file", body: "doc.pdf", url: "mxc://matrix.org/abcdef" }, false],
        ["text message", { msgtype: "m.text", body: "Hello" }, false],
    ])("canHide returns the expected value for a %s", (_, content, expected) => {
        const event = new MatrixEvent({ type: "m.room.message", content });
        expect(MediaEventHelper.canHide(event)).toBe(expected);
    });

    it("canHide is false for a redacted gallery", () => {
        const event = new MatrixEvent({
            type: "m.room.message",
            content: { msgtype: "dm.filament.gallery", body: "", itemtypes: [] },
        });
        vi.spyOn(event, "isRedacted").mockReturnValue(true);
        expect(MediaEventHelper.canHide(event)).toBe(false);
    });

    it("isEligible is false for a gallery, which has no media of its own", () => {
        const event = new MatrixEvent({
            type: "m.room.message",
            content: {
                msgtype: "dm.filament.gallery",
                body: "",
                itemtypes: [{ itemtype: "m.image", body: "image.png", url: "mxc://matrix.org/abcdef" }],
            },
        });
        expect(MediaEventHelper.isEligible(event)).toBe(false);
    });

    describe("fromContent", () => {
        it("resolves the media of a content object which is not an event", async () => {
            stubClient();
            const helper = MediaEventHelper.fromContent({
                msgtype: MsgType.Image,
                body: "A caption",
                filename: "image.png",
                url: "mxc://matrix.org/abcdef",
                info: { thumbnail_url: "mxc://matrix.org/thumbnail" },
            });

            expect(helper.fileName).toBe("image.png");
            expect(helper.media.srcMxc).toBe("mxc://matrix.org/abcdef");
            expect(helper.media.thumbnailMxc).toBe("mxc://matrix.org/thumbnail");
            expect(helper.media.isEncrypted).toBe(false);
            await expect(helper.sourceUrl.value).resolves.toBe(helper.media.srcHttp);
        });

        it("decrypts with the keys of the content", async () => {
            stubClient();
            const decrypted = new Blob(["decrypted"], { type: "image/png" });
            const decrypt = vi.spyOn(DecryptFile, "decryptFile").mockResolvedValue(decrypted);
            const file = { url: "mxc://matrix.org/encrypted" } as EncryptedFile;
            const info = { mimetype: "image/png" };
            const helper = MediaEventHelper.fromContent({ msgtype: MsgType.Image, body: "image.png", file, info });

            expect(helper.media.isEncrypted).toBe(true);
            await expect(helper.sourceBlob.value).resolves.toBe(decrypted);
            expect(decrypt).toHaveBeenCalledWith(file, info);
            decrypt.mockRestore();
        });
    });

    describe("for media this client uploaded", () => {
        const uploaded = new Blob(["uploaded bytes"], { type: "image/png" });
        const thumbnail = new Blob(["thumbnail bytes"], { type: "image/jpeg" });

        afterEach(() => {
            clearUploadedMediaCache();
            vi.restoreAllMocks();
        });

        it("serves an encrypted source and thumbnail from memory instead of downloading and decrypting", async () => {
            stubClient();
            const decrypt = vi.spyOn(DecryptFile, "decryptFile");
            cacheUploadedMedia("mxc://matrix.org/source", uploaded);
            cacheUploadedMedia("mxc://matrix.org/thumbnail", thumbnail);
            const event = new MatrixEvent({
                type: "m.room.message",
                content: {
                    msgtype: "m.image",
                    body: "image.png",
                    info: {
                        mimetype: "image/png",
                        thumbnail_info: { mimetype: "image/jpeg" },
                        thumbnail_file: { url: "mxc://matrix.org/thumbnail" },
                    },
                    file: { url: "mxc://matrix.org/source" },
                },
            });
            const helper = new MediaEventHelper(event);

            expect(helper.isFromLocalUpload).toBe(true);
            await expect((await helper.sourceBlob.value).text()).resolves.toBe("uploaded bytes");
            await expect((await helper.thumbnailBlob.value)!.text()).resolves.toBe("thumbnail bytes");
            expect(decrypt).not.toHaveBeenCalled();
        });

        it("hands out an object URL for an unencrypted upload and revokes it on destroy", async () => {
            stubClient();
            const revoke = vi.spyOn(URL, "revokeObjectURL");
            cacheUploadedMedia("mxc://matrix.org/source", uploaded);
            const event = new MatrixEvent({
                type: "m.room.message",
                content: { msgtype: "m.image", body: "image.png", url: "mxc://matrix.org/source" },
            });
            const helper = new MediaEventHelper(event);

            const url = await helper.sourceUrl.value;
            expect(url).toMatch(/^blob:/);
            expect(url).not.toBe(helper.media.srcHttp);
            helper.destroy();
            expect(revoke).toHaveBeenCalledWith(url);
        });

        it("still uses the server for media someone else uploaded", async () => {
            stubClient();
            const event = new MatrixEvent({
                type: "m.room.message",
                content: { msgtype: "m.image", body: "image.png", url: "mxc://matrix.org/other" },
            });
            const helper = new MediaEventHelper(event);

            expect(helper.isFromLocalUpload).toBe(false);
            await expect(helper.sourceUrl.value).resolves.toBe(helper.media.srcHttp);
        });
    });
});
