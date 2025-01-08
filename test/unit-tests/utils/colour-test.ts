/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Emmanuel Ezeka <eec.studies@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { textToHtmlRainbow } from "../../../src/utils/colour";

describe("textToHtmlRainbow", () => {
    it("correctly transform text to html without splitting the emoji in two", () => {
        expect(textToHtmlRainbow("🐻")).toBe('<span data-mx-color="#ff00be">🐻</span>');
        expect(textToHtmlRainbow("🐕‍🦺")).toBe('<span data-mx-color="#ff00be">🐕‍🦺</span>');
    });
});
