/*
 * Copyright 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import counterpart from "counterpart";
import { vi, describe, it, beforeEach, expect } from "vitest";

import { registerTranslations, setMissingEntryGenerator, getLocale, setLocale } from "./i18n";

describe("i18n utils", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should wrap registerTranslations", () => {
        vi.spyOn(counterpart, "registerTranslations");

        registerTranslations("en", { test: "This is a test" });
        expect(counterpart.registerTranslations).toHaveBeenCalledWith("en", { test: "This is a test" });
    });

    it("should wrap setMissingEntryGenerator", () => {
        vi.spyOn(counterpart, "setMissingEntryGenerator");

        const dummyFn = vi.fn();

        setMissingEntryGenerator(dummyFn);
        expect(counterpart.setMissingEntryGenerator).toHaveBeenCalledWith(dummyFn);
    });

    it("should wrap getLocale", () => {
        vi.spyOn(counterpart, "getLocale");

        getLocale();
        expect(counterpart.getLocale).toHaveBeenCalled();
    });

    it("should wrap setLocale", () => {
        vi.spyOn(counterpart, "setLocale");

        setLocale("en");
        expect(counterpart.setLocale).toHaveBeenCalledWith("en");
    });
});
