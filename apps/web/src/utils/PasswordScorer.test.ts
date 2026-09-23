/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect } from "vitest";
import { ZxcvbnFactory } from "@zxcvbn-ts/core";

import { scorePassword, baseOptions } from "./PasswordScorer.ts";

vi.mock("../languageHandler", () => ({
    getCurrentLanguage: vi.fn().mockReturnValue("en"),
    _t: vi.fn((k) => k),
}));
vi.mock("../SdkConfig", () => ({
    default: {
        get: vi.fn().mockReturnValue({
            brand: "BRAND",
        }),
    },
}));

describe("scorePassword", () => {
    const baseZxcvbn = new ZxcvbnFactory(baseOptions);

    it("should handle inputs with spaces by removing them", () => {
        const input = "apple banana cherry";
        const baseResult = baseZxcvbn.check(input);

        const output = scorePassword(null, input);
        expect(output).toBeDefined();
        expect(output!.score).toBe(3);
        expect(output!.score).toBeLessThan(baseResult.score);
    });
});
