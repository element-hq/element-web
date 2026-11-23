/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
import React from "react";
import { fireEvent, render } from "test-utils-rtl";
import parse from "html-react-parser";

import { combineRenderers, emoticonRenderer } from "./index";

describe("emoticon", () => {
    function renderEmoticons(input: string): HTMLElement {
        const { container } = render(
            <>{parse(input, { replace: combineRenderers(emoticonRenderer)({ isHtml: true }) })}</>,
        );
        return container;
    }

    it("animates emoticons only while hovered", () => {
        const container = renderEmoticons(
            `<img data-mx-emoticon src="https://server/thumbnail/emoticon?width=32" alt="cat" title="cat_wave">`,
        );
        const img = container.querySelector("img")!;
        expect(img.getAttribute("alt")).toBe("cat");
        expect(img.getAttribute("src")).toBe("https://server/thumbnail/emoticon?width=32");

        fireEvent.mouseEnter(img);
        expect(img.getAttribute("src")).toBe("https://server/thumbnail/emoticon?width=32&animated=true");

        fireEvent.mouseLeave(img);
        expect(img.getAttribute("src")).toBe("https://server/thumbnail/emoticon?width=32");
    });

    it("leaves other images alone", () => {
        const container = renderEmoticons(`<img src="https://server/thumbnail/image?width=32">`);
        const img = container.querySelector("img")!;

        fireEvent.mouseEnter(img);
        expect(img.getAttribute("src")).toBe("https://server/thumbnail/image?width=32");
    });
});
