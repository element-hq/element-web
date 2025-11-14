/*
 * Copyright 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import counterpart from "counterpart";

import { registerTranslations, setMissingEntryGenerator, getLocale, setLocale } from "./i18n";

describe("i18n utils", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should wrap registerTranslations", () => {
        jest.spyOn(counterpart, "registerTranslations");

        registerTranslations("en", { test: "This is a test" });
        expect(counterpart.registerTranslations).toHaveBeenCalledWith("en", { test: "This is a test" });
    });

    it("should wrap setMissingEntryGenerator", () => {
        jest.spyOn(counterpart, "setMissingEntryGenerator");

        const dummyFn = jest.fn();

        setMissingEntryGenerator(dummyFn);
        expect(counterpart.setMissingEntryGenerator).toHaveBeenCalledWith(dummyFn);
    });

    it("should wrap getLocale", () => {
        jest.spyOn(counterpart, "getLocale");

        getLocale();
        expect(counterpart.getLocale).toHaveBeenCalled();
    });

    it("should wrap setLocale", () => {
        jest.spyOn(counterpart, "setLocale");

        setLocale("en");
        expect(counterpart.setLocale).toHaveBeenCalledWith("en");
    });
});
