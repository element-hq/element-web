/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it } from "vitest";

import "../res/css/_common.pcss";

describe("Identifiers", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    const fontFeatureSettings = (html: string): string => {
        document.body.innerHTML = html;
        return getComputedStyle(document.body.firstElementChild!).fontFeatureSettings;
    };

    it.each([
        ["a copyable field", `<div class="mx_CopyableText">!1x2:example.org</div>`],
        ["a public room's address", `<span class="mx_SpotlightDialog_result_publicRoomAlias">#1x2:example.org</span>`],
        ["the login username field", `<input id="mx_LoginForm_username" value="@1x2:example.org">`],
        ["the registration username field", `<input id="mx_RegistrationForm_username" value="1x2">`],
    ])("turns off contextual alternates, which draw an x between digits as a multiplication sign, in %s", (_, html) => {
        expect(fontFeatureSettings(html)).toContain('"calt" 0');
    });

    it("keeps contextual alternates in other text", () => {
        expect(fontFeatureSettings("<p>1x2</p>")).not.toContain('"calt" 0');
    });
});
