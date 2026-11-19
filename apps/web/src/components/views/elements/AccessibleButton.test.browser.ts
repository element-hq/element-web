/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it } from "vitest";

import "../../../../res/css/views/elements/_AccessibleButton.pcss";

describe("A disabled AccessibleButton", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    const opacityOf = (kind: string, disabled: boolean): string => {
        const button = document.createElement("div");
        button.className = `mx_AccessibleButton mx_AccessibleButton_hasKind mx_AccessibleButton_kind_${kind}`;
        button.classList.toggle("mx_AccessibleButton_disabled", disabled);
        document.body.append(button);
        return getComputedStyle(button).opacity;
    };

    it.each(["primary", "danger"])("fades the %s kind", (kind) => {
        expect(opacityOf(kind, false)).toBe("1");
        expect(opacityOf(kind, true)).toBe("0.4");
    });
});
