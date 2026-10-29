/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, vi } from "vitest";

import { configureSpellCheckerDictionaries } from "./spellcheck.js";

describe("configureSpellCheckerDictionaries", () => {
    const createSession = (): { setSpellCheckerDictionaryDownloadURL: ReturnType<typeof vi.fn> } => ({
        setSpellCheckerDictionaryDownloadURL: vi.fn(),
    });

    it("should leave Electron's default in place when no URL is configured", () => {
        const session = createSession();
        configureSpellCheckerDictionaries(session, undefined);
        configureSpellCheckerDictionaries(session, "");
        expect(session.setSpellCheckerDictionaryDownloadURL).not.toHaveBeenCalled();
    });

    it("should pass on a URL which ends in a slash", () => {
        const session = createSession();
        configureSpellCheckerDictionaries(session, "https://example.com/dictionaries/");
        expect(session.setSpellCheckerDictionaryDownloadURL).toHaveBeenCalledWith("https://example.com/dictionaries/");
    });

    it("should add the trailing slash when it is missing", () => {
        const session = createSession();
        configureSpellCheckerDictionaries(session, "https://example.com/dictionaries");
        expect(session.setSpellCheckerDictionaryDownloadURL).toHaveBeenCalledWith("https://example.com/dictionaries/");
    });
});
