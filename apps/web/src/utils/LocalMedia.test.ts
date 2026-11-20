/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalMedia } from "./LocalMedia";

describe("LocalMedia", () => {
    const photo = new File(["photo"], "photo.png", { type: "image/png" });
    const clip = new File(["a video"], "clip.mp4", { type: "video/mp4" });

    beforeEach(() => {
        vi.spyOn(URL, "createObjectURL").mockImplementation((file) => `blob:${(file as File).name}`);
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("is named after the file", () => {
        const media = new LocalMedia(photo);

        expect(media.name).toBe("photo.png");
        media.destroy();
    });

    it("falls back to a generic name for a file without one", () => {
        const media = new LocalMedia(new File(["data"], "", { type: "image/png" }));

        expect(media.name).toBe("Attachment");
        media.destroy();
    });

    it("tells videos from images by their type", () => {
        const image = new LocalMedia(photo);
        const video = new LocalMedia(clip);

        expect(image.isVideo).toBe(false);
        expect(video.isVideo).toBe(true);
        image.destroy();
        video.destroy();
    });

    it("describes the size and type of the file", () => {
        const media = new LocalMedia(clip);

        expect(media.info).toEqual({ size: 7, mimetype: "video/mp4" });
        media.destroy();
    });

    it("has no helper, as there is no event to download the media from", () => {
        const media = new LocalMedia(photo);

        expect(media.helper).toBeUndefined();
        media.destroy();
    });

    it("creates a URL for the file only when one is asked for, and only once", async () => {
        const media = new LocalMedia(photo);
        expect(URL.createObjectURL).not.toHaveBeenCalled();

        expect(await media.getSourceUrl()).toBe("blob:photo.png");
        expect(await media.getSourceUrl()).toBe("blob:photo.png");

        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        expect(URL.createObjectURL).toHaveBeenCalledWith(photo);
        media.destroy();
    });

    it("releases the URL of the file when destroyed", async () => {
        const media = new LocalMedia(photo);
        await media.getSourceUrl();

        media.destroy();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo.png");

        // Destroying again has nothing left to release
        media.destroy();
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it("releases nothing when no URL was made", () => {
        const media = new LocalMedia(photo);

        media.destroy();

        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    it("makes a new URL when asked again after being destroyed", async () => {
        const media = new LocalMedia(photo);
        await media.getSourceUrl();
        media.destroy();

        await media.getSourceUrl();

        expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
        media.destroy();
    });
});
