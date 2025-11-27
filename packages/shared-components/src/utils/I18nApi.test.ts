/*
 * Copyright 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type TranslationKey } from "../i18nKeys";
import { I18nApi } from "./I18nApi";

describe("I18nApi", () => {
    it("can register a translation and use it", () => {
        const i18n = new I18nApi();
        i18n.register({
            "hello.world": {
                en: "Hello, World!",
            },
        });

        expect(i18n.translate("hello.world" as TranslationKey)).toBe("Hello, World!");
    });
});
