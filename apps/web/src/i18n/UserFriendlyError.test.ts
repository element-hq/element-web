/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fetchMock from "@fetch-mock/vitest";

import SdkConfig from "../../src/SdkConfig";
import { setLanguage } from "./settings";
import { UserFriendlyError } from "./UserFriendlyError";
import { setupTranslationOverridesForTests } from "./__mocks__";

describe("UserFriendlyError", () => {
    const testErrorMessage = "This email address is already in use (%(email)s)" as TranslationKey;
    beforeEach(async () => {
        await setLanguage("en");
        // Setup some  strings with variable substituations that we can use in the tests.
        const deOverride = "Diese E-Mail-Adresse wird bereits verwendet (%(email)s)";
        await setupTranslationOverridesForTests({
            [testErrorMessage]: {
                en: testErrorMessage,
                de: deOverride,
            },
        });
    });

    afterEach(() => {
        SdkConfig.reset();
        fetchMock.removeRoute("i18n-override");
    });

    it("includes English message and localized translated message", async () => {
        await setLanguage("de");

        const friendlyError = new UserFriendlyError(testErrorMessage, {
            email: "test@example.com",
            cause: undefined,
        });

        // Ensure message is in English so it's readable in the logs
        expect(friendlyError.message).toStrictEqual("This email address is already in use (test@example.com)");
        // Ensure the translated message is localized appropriately
        expect(friendlyError.translatedMessage).toStrictEqual(
            "Diese E-Mail-Adresse wird bereits verwendet (test@example.com)",
        );
    });

    it("includes underlying cause error", async () => {
        await setLanguage("de");

        const underlyingError = new Error("Fake underlying error");
        const friendlyError = new UserFriendlyError(testErrorMessage, {
            email: "test@example.com",
            cause: underlyingError,
        });

        expect(friendlyError.cause).toStrictEqual(underlyingError);
    });

    it("ok to omit the substitution variables and cause object, there just won't be any cause", async () => {
        const friendlyError = new UserFriendlyError("foo error" as TranslationKey);
        expect(friendlyError.cause).toBeUndefined();
    });
});
