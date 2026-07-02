/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";

import { getLanguagesFromBrowser } from "./browser";

describe("getLanguagesFromBrowser", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("should return navigator.languages if available", () => {
        vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["en", "de"]);
        expect(getLanguagesFromBrowser()).toEqual(["en", "de"]);
    });

    it("should return navigator.language if available", () => {
        vi.spyOn(window.navigator, "languages", "get").mockReturnValue([]);
        vi.spyOn(window.navigator, "language", "get").mockReturnValue("de");
        expect(getLanguagesFromBrowser()).toEqual(["de"]);
    });

    it("should return 'en' otherwise", () => {
        vi.spyOn(window.navigator, "languages", "get").mockReturnValue([]);
        vi.spyOn(window.navigator, "language", "get").mockReturnValue(undefined as any);
        expect(getLanguagesFromBrowser()).toEqual(["en"]);
    });
});
