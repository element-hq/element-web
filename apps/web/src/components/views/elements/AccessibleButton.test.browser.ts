/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@vector-im/compound-web";

import "@vector-im/compound-design-tokens/assets/web/css/compound-design-tokens.css";
import "@vector-im/compound-web/dist/style.css";
import "../../../../res/css/views/elements/_AccessibleButton.pcss";

describe("A disabled AccessibleButton", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    const styleOf = (kind: string, disabled: boolean): CSSStyleDeclaration => {
        const button = document.createElement("div");
        button.className = `mx_AccessibleButton mx_AccessibleButton_hasKind mx_AccessibleButton_kind_${kind}`;
        button.classList.toggle("mx_AccessibleButton_disabled", disabled);
        document.body.append(button);
        return getComputedStyle(button);
    };

    it("fades the primary kind", () => {
        expect(styleOf("primary", false).opacity).toBe("1");
        expect(styleOf("primary", true).opacity).toBe("0.4");
    });

    it.each(["danger", "danger_sm"])("draws the %s kind as Compound draws a disabled destructive Button", (kind) => {
        document.body.insertAdjacentHTML(
            "beforeend",
            renderToStaticMarkup(
                createElement(Button, { kind: "primary", destructive: true, disabled: true }, "Leave"),
            ),
        );
        const compound = getComputedStyle(document.body.lastElementChild!);
        const enabled = styleOf(kind, false);
        const disabled = styleOf(kind, true);

        expect(disabled.backgroundColor).not.toBe(enabled.backgroundColor);
        expect([disabled.color, disabled.backgroundColor, disabled.borderTopColor, disabled.opacity]).toEqual([
            compound.color,
            compound.backgroundColor,
            compound.backgroundColor,
            "1",
        ]);
    });
});
