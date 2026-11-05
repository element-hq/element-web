/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SourceMapper } from "./sourcemaps.js";

const SCRIPT_URL = "http://localhost:8080/bundles/abc123/init.js";

// A minified function `a`, defined at column 10 (1-based), which throws at column 15
const SCRIPT = "function a(){throw Error()}";

// Maps the start of the script to src/Foo.ts, and the `a` at column 10 to `realName` at line 1, column 10 of src/Foo.ts
const SOURCE_MAP = {
    version: 3,
    sources: ["webpack://element-web/./src/Foo.ts"],
    names: ["realName"],
    mappings: "AAAA,SAASA",
};

describe("SourceMapper", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(async (url: string) => {
            if (url === SCRIPT_URL) return new Response(SCRIPT);
            if (url === `${SCRIPT_URL}.map`) return Response.json(SOURCE_MAP);
            return new Response(null, { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("rewrites stack frames to their original function names and source locations", async () => {
        const mapper = new SourceMapper();

        const mapped = await mapper.mapLocations(`Error: oops\n    at a (${SCRIPT_URL}:1:15)`);

        expect(mapped).toBe("Error: oops\n    at realName (src/Foo.ts:1:10)");
    });

    it("only rewrites the function's own part of a dotted name", async () => {
        const mapper = new SourceMapper();

        expect(await mapper.mapLocations(`at Object.a (${SCRIPT_URL}:1:15)`)).toBe(
            "at Object.realName (src/Foo.ts:1:10)",
        );
    });

    it("rewrites locations in frames without a function name", async () => {
        const mapper = new SourceMapper();

        expect(await mapper.mapLocations(`at ${SCRIPT_URL}:1:15`)).toBe("at src/Foo.ts:1:10");
    });

    it("keeps a function name whose definition can't be found", async () => {
        const mapper = new SourceMapper();

        expect(await mapper.mapLocations(`at zz (${SCRIPT_URL}:1:15)`)).toBe("at zz (src/Foo.ts:1:10)");
    });

    it("leaves frames in scripts without a source map as they are", async () => {
        const mapper = new SourceMapper();
        const text = "Error: oops\n    at n (http://localhost:8080/vendor.js:1:1)";

        expect(await mapper.mapLocations(text)).toBe(text);
    });

    it("only fetches each script and its source map once", async () => {
        const mapper = new SourceMapper();

        await mapper.mapLocations(`at a (${SCRIPT_URL}:1:15)\nat b (${SCRIPT_URL}:1:15)`);
        await mapper.mapLocations(`at c (${SCRIPT_URL}:1:15)`);

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not fetch anything for text without script locations", async () => {
        const mapper = new SourceMapper();

        expect(await mapper.mapLocations("log: Starting up")).toBe("log: Starting up");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
