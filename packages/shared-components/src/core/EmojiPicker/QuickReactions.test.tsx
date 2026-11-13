/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// The footer's label and emoji take their sizes from Compound's typography tokens, which the
// unit tests don't load otherwise.
import "@vector-im/compound-design-tokens/assets/web/css/compound-design-tokens.css";

import React from "react";
import { render, screen, within } from "@test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickReactions } from "./QuickReactions";

describe("QuickReactions", () => {
    afterEach(() => {
        document.documentElement.style.fontSize = "";
    });

    function renderQuickReactions(): { footer: HTMLElement; toolbar: HTMLElement; emojis: HTMLElement[] } {
        render(<QuickReactions onClick={vi.fn()} />);
        const toolbar = screen.getByRole("toolbar", { name: "Quick Reactions" });
        return { footer: toolbar.parentElement!, toolbar, emojis: within(toolbar).getAllByRole("button") };
    }

    it.each([16, 20, 24])("keeps the emoji inside the footer at a %ipx font size", (fontSize) => {
        document.documentElement.style.fontSize = `${fontSize}px`;
        const { footer, emojis } = renderQuickReactions();

        const footerBottom = footer.getBoundingClientRect().bottom;
        for (const emoji of emojis) {
            expect(emoji.getBoundingClientRect().bottom).toBeLessThanOrEqual(footerBottom);
        }
    });
});
