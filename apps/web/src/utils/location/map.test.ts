/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { setWorkerUrl } from "maplibre-gl";

vi.mock("maplibre-gl");

// Webpack defines these globals in the built app; map.ts reads them to locate the bundled maplibre worker.
const webpackGlobals = globalThis as { __webpack_public_path__?: string; __webpack_get_script_filename__?: unknown };

describe("map worker URL", () => {
    afterEach(() => {
        delete webpackGlobals.__webpack_public_path__;
        delete webpackGlobals.__webpack_get_script_filename__;
        vi.resetModules();
        vi.mocked(setWorkerUrl).mockClear();
    });

    it("points maplibre at the bundled worker under webpack", async () => {
        webpackGlobals.__webpack_public_path__ = "https://app.example.org/";
        webpackGlobals.__webpack_get_script_filename__ = (chunkId: string) => `bundles/abc123/${chunkId}.js`;

        await import("./map");

        expect(setWorkerUrl).toHaveBeenCalledWith("https://app.example.org/bundles/abc123/maplibre.worker.js");
    });

    it("leaves the worker URL alone outside webpack", async () => {
        await import("./map");

        expect(setWorkerUrl).not.toHaveBeenCalled();
    });
});
