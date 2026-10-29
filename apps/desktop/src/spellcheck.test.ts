/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, vi, type Mock } from "vitest";
import type { Session } from "electron";

import { configureSpellChecker } from "./spellcheck.js";

describe("configureSpellChecker", () => {
    const createSession = (): {
        setSpellCheckerEnabled: Mock<Session["setSpellCheckerEnabled"]>;
        setSpellCheckerDictionaryDownloadURL: Mock<Session["setSpellCheckerDictionaryDownloadURL"]>;
    } => ({
        setSpellCheckerEnabled: vi.fn(),
        setSpellCheckerDictionaryDownloadURL: vi.fn(),
    });

    it.each([true, false])("should set whether the spellchecker is enabled to %s", (enabled) => {
        const session = createSession();
        configureSpellChecker(session, { enabled });
        expect(session.setSpellCheckerEnabled).toHaveBeenCalledWith(enabled);
    });

    it("should leave Electron's default dictionary URL in place when none is configured", () => {
        const session = createSession();
        configureSpellChecker(session, { enabled: true });
        configureSpellChecker(session, { enabled: true, dictionaryDownloadUrl: "" });
        expect(session.setSpellCheckerDictionaryDownloadURL).not.toHaveBeenCalled();
    });

    it("should pass on a dictionary URL which ends in a slash", () => {
        const session = createSession();
        configureSpellChecker(session, { enabled: true, dictionaryDownloadUrl: "https://example.com/dictionaries/" });
        expect(session.setSpellCheckerDictionaryDownloadURL).toHaveBeenCalledWith("https://example.com/dictionaries/");
    });

    it("should add the trailing slash to a dictionary URL when it is missing", () => {
        const session = createSession();
        configureSpellChecker(session, { enabled: true, dictionaryDownloadUrl: "https://example.com/dictionaries" });
        expect(session.setSpellCheckerDictionaryDownloadURL).toHaveBeenCalledWith("https://example.com/dictionaries/");
    });

    it("should set the dictionary URL before enabling the spellchecker", () => {
        const session = createSession();
        configureSpellChecker(session, { enabled: true, dictionaryDownloadUrl: "https://example.com/dictionaries/" });
        expect(session.setSpellCheckerDictionaryDownloadURL.mock.invocationCallOrder[0]).toBeLessThan(
            session.setSpellCheckerEnabled.mock.invocationCallOrder[0],
        );
    });
});
