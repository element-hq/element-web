/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SourceMapper } from "./sourcemaps.js";

const SCRIPT_URL = "http://localhost:8080/bundles/abc123/init.js";

// Maps line 1, column 1 of the script to line 10, column 5 of src/Foo.ts
const SOURCE_MAP = {
    version: 3,
    sources: ["webpack://element-web/./src/Foo.ts"],
    names: [],
    mappings: "AASI",
};

describe("SourceMapper", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(async (url: string) =>
            url === `${SCRIPT_URL}.map` ? Response.json(SOURCE_MAP) : new Response(null, { status: 404 }),
        );
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("rewrites script locations to their original source locations", async () => {
        const mapper = new SourceMapper();

        const mapped = await mapper.mapLocations(`Error: oops\n    at n (${SCRIPT_URL}:1:1)`);

        expect(mapped).toBe("Error: oops\n    at n (src/Foo.ts:10:5)");
    });

    it("leaves locations in scripts without a source map as they are", async () => {
        const mapper = new SourceMapper();
        const text = "Error: oops\n    at n (http://localhost:8080/vendor.js:1:1)";

        expect(await mapper.mapLocations(text)).toBe(text);
    });

    it("only fetches each script's source map once", async () => {
        const mapper = new SourceMapper();

        await mapper.mapLocations(`at a (${SCRIPT_URL}:1:1)\nat b (${SCRIPT_URL}:1:1)`);
        await mapper.mapLocations(`at c (${SCRIPT_URL}:1:1)`);

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not fetch anything for text without script locations", async () => {
        const mapper = new SourceMapper();

        expect(await mapper.mapLocations("log: Starting up")).toBe("log: Starting up");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
