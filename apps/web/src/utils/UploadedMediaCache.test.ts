/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, beforeEach } from "vitest";

import { clearUploadedMedia, forgetUploadedMedia, getUploadedMedia, rememberUploadedMedia } from "./UploadedMediaCache";

describe("UploadedMediaCache", () => {
    const blobOfSize = (size: number): Blob => new Blob([new Uint8Array(size)]);

    beforeEach(() => {
        clearUploadedMedia();
    });

    it("returns what was remembered for an mxc URI", () => {
        const blob = blobOfSize(10);
        rememberUploadedMedia("mxc://server/a", blob);
        expect(getUploadedMedia("mxc://server/a")).toBe(blob);
    });

    it("returns undefined for an unknown, null or undefined mxc URI", () => {
        expect(getUploadedMedia("mxc://server/nope")).toBeUndefined();
        expect(getUploadedMedia(null)).toBeUndefined();
        expect(getUploadedMedia(undefined)).toBeUndefined();
    });

    it("forgets a single entry and everything on clear", () => {
        rememberUploadedMedia("mxc://server/a", blobOfSize(1));
        rememberUploadedMedia("mxc://server/b", blobOfSize(1));
        forgetUploadedMedia("mxc://server/a");
        expect(getUploadedMedia("mxc://server/a")).toBeUndefined();
        expect(getUploadedMedia("mxc://server/b")).toBeDefined();
        clearUploadedMedia();
        expect(getUploadedMedia("mxc://server/b")).toBeUndefined();
    });

    it("evicts the oldest uploads once the cache is over its size limit", () => {
        const third = 24 * 1024 * 1024;
        rememberUploadedMedia("mxc://server/a", blobOfSize(third));
        rememberUploadedMedia("mxc://server/b", blobOfSize(third));
        rememberUploadedMedia("mxc://server/c", blobOfSize(third));
        expect(getUploadedMedia("mxc://server/a")).toBeUndefined();
        expect(getUploadedMedia("mxc://server/b")).toBeDefined();
        expect(getUploadedMedia("mxc://server/c")).toBeDefined();
    });

    it("does not keep a file which is bigger than the whole cache", () => {
        rememberUploadedMedia("mxc://server/small", blobOfSize(1));
        rememberUploadedMedia("mxc://server/huge", blobOfSize(65 * 1024 * 1024));
        expect(getUploadedMedia("mxc://server/huge")).toBeUndefined();
        expect(getUploadedMedia("mxc://server/small")).toBeDefined();
    });
});
