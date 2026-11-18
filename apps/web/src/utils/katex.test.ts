/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { getKatex, loadKatex } from "./katex";

describe("katex", () => {
    it("is only available once loaded, and is loaded once", async () => {
        expect(getKatex()).toBeUndefined();

        const loading = loadKatex();
        expect(loadKatex()).toBe(loading);

        const katex = await loading;
        expect(getKatex()).toBe(katex);
        expect(katex.renderToString("x")).toContain("katex");
    });
});
