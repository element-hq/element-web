/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../res/css/views/settings/tabs/user/_HelpUserSettingsTab.pcss";

describe("The Help & About credits", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("start right under their heading, without the browser's margins around the list", () => {
        document.body.innerHTML = `<ul class="mx_HelpUserSettingsTab_credits"><li>The default cover photo</li></ul>`;
        const list = getComputedStyle(document.querySelector("ul")!);

        expect(list.marginBlockStart).toBe("0px");
        expect(list.marginBlockEnd).toBe("0px");
    });
});
