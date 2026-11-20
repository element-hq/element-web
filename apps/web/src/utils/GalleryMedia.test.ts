/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { GalleryMedia } from "./GalleryMedia";
import { type GalleryItem } from "./gallery";
import { cacheUploadedMedia, clearUploadedMediaCache } from "./UploadedMediaCache";
import * as DecryptFile from "./DecryptFile";

describe("GalleryMedia", () => {
    const encryptedFile = (name: string): GalleryItem["file"] =>
        ({ url: `mxc://server/${name}` }) as GalleryItem["file"];

    const image = (extra: Partial<GalleryItem> = {}): GalleryItem => ({
        itemtype: MsgType.Image,
        body: "image.png",
        url: "mxc://server/image",
        info: { mimetype: "image/png" },
        ...extra,
    });

    const video = (extra: Partial<GalleryItem> = {}): GalleryItem => ({
        itemtype: MsgType.Video,
        body: "video.mp4",
        url: "mxc://server/video",
        info: { mimetype: "video/mp4" },
        ...extra,
    });

    const encryptedImage = (info: GalleryItem["info"] = { mimetype: "image/png" }): GalleryItem => ({
        itemtype: MsgType.Image,
        body: "image.png",
        file: encryptedFile("image"),
        info,
    });

    const encryptedVideo = (info: GalleryItem["info"] = { mimetype: "video/mp4" }): GalleryItem => ({
        itemtype: MsgType.Video,
        body: "video.mp4",
        file: encryptedFile("video"),
        info,
    });

    /** Stands in for the content repository: decrypting a file gives a blob named after its mxc. */
    const mockDecryption = (): void => {
        vi.spyOn(DecryptFile, "decryptFile").mockImplementation(async (file) => new Blob([`decrypted ${file!.url}`]));
    };

    // The blobs behind the object URLs handed out during a test.
    let blobs: Map<string, Blob>;

    const textOfBlobUrl = async (url: string | null): Promise<string> => {
        expect(url).toMatch(/^blob:/);
        expect(blobs.has(url!)).toBe(true);
        return blobs.get(url!)!.text();
    };

    beforeEach(() => {
        blobs = new Map();
        const createObjectURL = URL.createObjectURL.bind(URL);
        vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
            const url = createObjectURL(blob);
            blobs.set(url, blob as Blob);
            return url;
        });

        const client = stubClient();
        // Tells the source and the thumbnail apart, and shows which size was asked for.
        // eslint-disable-next-line no-restricted-properties
        vi.mocked(client.mxcUrlToHttp).mockImplementation(
            (mxc: string, width?: number, height?: number, method?: string) =>
                `https://server/${mxc.substring("mxc://server/".length)}?${[width, height, method].join(",")}`,
        );
    });

    afterEach(() => {
        clearUploadedMediaCache();
        vi.restoreAllMocks();
    });

    it("creates the media of every displayable item of an event, in order", () => {
        const event = new MatrixEvent({
            type: EventType.RoomMessage,
            content: {
                msgtype: "dm.filament.gallery",
                body: "",
                itemtypes: [image(), { itemtype: "m.file", body: "doc.pdf", url: "mxc://server/doc" }, video()],
            },
        });

        const media = GalleryMedia.forEvent(event);

        expect(media.map((item) => item.mxc)).toEqual(["mxc://server/image", "mxc://server/video"]);
        expect(media.map((item) => item.isVideo)).toEqual([false, true]);
    });

    it("exposes the item as the content of a standalone media message", () => {
        const media = new GalleryMedia(image());

        expect(media.content).toEqual({
            msgtype: "m.image",
            body: "image.png",
            url: "mxc://server/image",
            info: { mimetype: "image/png" },
        });
        expect(media.helper.media.srcMxc).toBe("mxc://server/image");
    });

    it("identifies an encrypted item by the mxc of its file", () => {
        expect(new GalleryMedia(encryptedImage()).mxc).toBe("mxc://server/image");
    });

    it("prefers the filename over the body for the name", () => {
        expect(new GalleryMedia(image()).name).toBe("image.png");
        expect(new GalleryMedia(image({ filename: "real-name.png", body: "A caption" })).name).toBe("real-name.png");
    });

    describe("getThumbnailUrl", () => {
        it("asks the content repository to scale an unencrypted image", async () => {
            await expect(new GalleryMedia(image()).getThumbnailUrl()).resolves.toBe(
                "https://server/image?800,600,scale",
            );
        });

        it("uses the attached thumbnail of an unencrypted SVG", async () => {
            const media = new GalleryMedia(
                image({ info: { mimetype: "image/svg+xml", thumbnail_url: "mxc://server/thumbnail" } }),
            );

            await expect(media.getThumbnailUrl()).resolves.toBe("https://server/thumbnail?800,600,scale");
        });

        it("scales the source of an unencrypted SVG which has no thumbnail", async () => {
            const media = new GalleryMedia(image({ info: { mimetype: "image/svg+xml" } }));

            await expect(media.getThumbnailUrl()).resolves.toBe("https://server/image?800,600,scale");
        });

        it("uses the attached thumbnail of an unencrypted video", async () => {
            const media = new GalleryMedia(
                video({ info: { mimetype: "video/mp4", thumbnail_url: "mxc://server/thumbnail" } }),
            );

            await expect(media.getThumbnailUrl()).resolves.toBe("https://server/thumbnail?,,");
        });

        it("has no thumbnail for an unencrypted video without one", async () => {
            await expect(new GalleryMedia(video()).getThumbnailUrl()).resolves.toBeNull();
        });

        it("decrypts the thumbnail of an encrypted image", async () => {
            mockDecryption();
            const media = new GalleryMedia(
                encryptedImage({ mimetype: "image/png", thumbnail_file: encryptedFile("thumbnail") }),
            );

            await expect(textOfBlobUrl(await media.getThumbnailUrl())).resolves.toBe(
                "decrypted mxc://server/thumbnail",
            );
            expect(DecryptFile.decryptFile).toHaveBeenCalledTimes(1);
        });

        it("falls back to the source of an encrypted image without a thumbnail", async () => {
            mockDecryption();
            const media = new GalleryMedia(encryptedImage());

            await expect(textOfBlobUrl(await media.getThumbnailUrl())).resolves.toBe("decrypted mxc://server/image");
        });

        it("refuses to display an encrypted image of an unsafe type which has no thumbnail", async () => {
            mockDecryption();
            const media = new GalleryMedia(encryptedImage({ mimetype: "image/svg+xml" }));

            await expect(media.getThumbnailUrl()).rejects.toThrow("cannot be displayed");
            expect(DecryptFile.decryptFile).not.toHaveBeenCalled();
        });

        it("refuses to display an encrypted image which does not say what type it is", async () => {
            mockDecryption();
            const media = new GalleryMedia(encryptedImage({}));

            await expect(media.getThumbnailUrl()).rejects.toThrow("cannot be displayed");
        });

        it("has no thumbnail for an encrypted video without one, and leaves the video alone", async () => {
            mockDecryption();
            const media = new GalleryMedia(encryptedVideo());

            await expect(media.getThumbnailUrl()).resolves.toBeNull();
            expect(DecryptFile.decryptFile).not.toHaveBeenCalled();
        });

        it("reports a thumbnail which cannot be decrypted", async () => {
            vi.spyOn(DecryptFile, "decryptFile").mockRejectedValue(new DecryptFile.DecryptError(new Error("bad key")));
            const media = new GalleryMedia(
                encryptedImage({ mimetype: "image/png", thumbnail_file: encryptedFile("thumbnail") }),
            );

            await expect(media.getThumbnailUrl()).rejects.toBeInstanceOf(DecryptFile.DecryptError);
        });

        it("serves an image this client uploaded from memory", async () => {
            cacheUploadedMedia("mxc://server/image", new Blob(["uploaded image"]));
            const media = new GalleryMedia(image());

            await expect(textOfBlobUrl(await media.getThumbnailUrl())).resolves.toBe("uploaded image");
        });

        it("serves the thumbnail of an image this client uploaded from memory", async () => {
            cacheUploadedMedia("mxc://server/image", new Blob(["uploaded image"]));
            cacheUploadedMedia("mxc://server/thumbnail", new Blob(["uploaded thumbnail"]));
            const media = new GalleryMedia(
                image({ info: { mimetype: "image/png", thumbnail_url: "mxc://server/thumbnail" } }),
            );

            await expect(textOfBlobUrl(await media.getThumbnailUrl())).resolves.toBe("uploaded thumbnail");
        });
    });

    describe("getSourceUrl", () => {
        it("points at the content repository for unencrypted media", async () => {
            await expect(new GalleryMedia(image()).getSourceUrl()).resolves.toBe("https://server/image?,,");
            await expect(new GalleryMedia(video()).getSourceUrl()).resolves.toBe("https://server/video?,,");
        });

        it("points at the content repository for an unencrypted image of any type", async () => {
            const media = new GalleryMedia(image({ info: { mimetype: "image/svg+xml" } }));

            await expect(media.getSourceUrl()).resolves.toBe("https://server/image?,,");
        });

        it("decrypts encrypted media", async () => {
            mockDecryption();

            await expect(textOfBlobUrl(await new GalleryMedia(encryptedImage()).getSourceUrl())).resolves.toBe(
                "decrypted mxc://server/image",
            );
            await expect(textOfBlobUrl(await new GalleryMedia(encryptedVideo()).getSourceUrl())).resolves.toBe(
                "decrypted mxc://server/video",
            );
        });

        it("shows the thumbnail of an encrypted image of an unsafe type instead", async () => {
            mockDecryption();
            const media = new GalleryMedia(
                encryptedImage({ mimetype: "image/svg+xml", thumbnail_file: encryptedFile("thumbnail") }),
            );

            await expect(textOfBlobUrl(await media.getSourceUrl())).resolves.toBe("decrypted mxc://server/thumbnail");
        });

        it("has nothing to show for an encrypted image of an unsafe type without a thumbnail", async () => {
            mockDecryption();
            const media = new GalleryMedia(encryptedImage({ mimetype: "image/svg+xml" }));

            await expect(media.getSourceUrl()).resolves.toBeNull();
        });

        it("has nothing to show for an encrypted video of an unsafe type", async () => {
            mockDecryption();
            const media = new GalleryMedia(
                encryptedVideo({ mimetype: "video/x-unknown", thumbnail_file: encryptedFile("thumbnail") }),
            );

            await expect(media.getSourceUrl()).resolves.toBeNull();
            expect(DecryptFile.decryptFile).not.toHaveBeenCalled();
        });

        it("serves media this client uploaded from memory", async () => {
            cacheUploadedMedia("mxc://server/video", new Blob(["uploaded video"]));

            await expect(textOfBlobUrl(await new GalleryMedia(video()).getSourceUrl())).resolves.toBe("uploaded video");
        });
    });

    it("releases the object URLs it handed out when destroyed", async () => {
        mockDecryption();
        const revoke = vi.spyOn(URL, "revokeObjectURL");
        const media = new GalleryMedia(
            encryptedImage({ mimetype: "image/png", thumbnail_file: encryptedFile("thumbnail") }),
        );
        const thumbnailUrl = await media.getThumbnailUrl();
        const sourceUrl = await media.getSourceUrl();

        media.destroy();

        expect(revoke).toHaveBeenCalledWith(thumbnailUrl);
        expect(revoke).toHaveBeenCalledWith(sourceUrl);
    });
});
