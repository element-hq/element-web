/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";

import { MatrixEvent } from "matrix-js-sdk/src/matrix";
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
