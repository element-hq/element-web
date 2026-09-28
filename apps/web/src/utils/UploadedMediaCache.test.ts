/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, beforeEach } from "vitest";

import {
    cacheUploadedMedia,
    clearUploadedMediaCache,
    forgetUploadedMedia,
    queryUploadedMediaCache,
} from "./UploadedMediaCache";

describe("UploadedMediaCache", () => {
    const blobOfSize = (size: number): Blob => new Blob([new Uint8Array(size)]);

    beforeEach(() => {
        clearUploadedMediaCache();
    });

    it("returns what was remembered for an mxc URI", () => {
        const blob = blobOfSize(10);
        cacheUploadedMedia("mxc://server/a", blob);
        expect(queryUploadedMediaCache("mxc://server/a")).toBe(blob);
    });

    it("returns undefined for an unknown, null or undefined mxc URI", () => {
        expect(queryUploadedMediaCache("mxc://server/nope")).toBeUndefined();
        expect(queryUploadedMediaCache(null)).toBeUndefined();
        expect(queryUploadedMediaCache(undefined)).toBeUndefined();
    });

    it("forgets a single entry and everything on clear", () => {
        cacheUploadedMedia("mxc://server/a", blobOfSize(1));
        cacheUploadedMedia("mxc://server/b", blobOfSize(1));
        forgetUploadedMedia("mxc://server/a");
        expect(queryUploadedMediaCache("mxc://server/a")).toBeUndefined();
        expect(queryUploadedMediaCache("mxc://server/b")).toBeDefined();
        clearUploadedMediaCache();
        expect(queryUploadedMediaCache("mxc://server/b")).toBeUndefined();
    });

    it("evicts the oldest uploads once the cache is over its size limit", () => {
        const third = 24 * 1024 * 1024;
        cacheUploadedMedia("mxc://server/a", blobOfSize(third));
        cacheUploadedMedia("mxc://server/b", blobOfSize(third));
        cacheUploadedMedia("mxc://server/c", blobOfSize(third));
        expect(queryUploadedMediaCache("mxc://server/a")).toBeUndefined();
        expect(queryUploadedMediaCache("mxc://server/b")).toBeDefined();
        expect(queryUploadedMediaCache("mxc://server/c")).toBeDefined();
    });

    it("does not keep a file which is bigger than the whole cache", () => {
        cacheUploadedMedia("mxc://server/small", blobOfSize(1));
        cacheUploadedMedia("mxc://server/huge", blobOfSize(65 * 1024 * 1024));
        expect(queryUploadedMediaCache("mxc://server/huge")).toBeUndefined();
        expect(queryUploadedMediaCache("mxc://server/small")).toBeDefined();
    });
});
