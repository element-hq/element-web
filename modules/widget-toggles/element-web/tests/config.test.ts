/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, test } from "vitest";

import { WidgetTogglesConfig } from "../src/config";

describe("WidgetTogglesConfig", () => {
    test("parses a valid config with an array of widget types", () => {
        const result = WidgetTogglesConfig.safeParse({ types: ["m.video", "m.audio"] });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.types).toEqual(["m.video", "m.audio"]);
        }
    });

    test("parses a valid config with an empty types array", () => {
        const result = WidgetTogglesConfig.safeParse({ types: [] });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.types).toEqual([]);
        }
    });

    test("rejects a config missing the types field", () => {
        const result = WidgetTogglesConfig.safeParse({});
        expect(result.success).toBe(false);
    });

    test("rejects a config where types is not an array", () => {
        const result = WidgetTogglesConfig.safeParse({ types: "m.video" });
        expect(result.success).toBe(false);
    });

    test("rejects a config where types contains non-string values", () => {
        const result = WidgetTogglesConfig.safeParse({ types: [1, 2, 3] });
        expect(result.success).toBe(false);
    });
});
