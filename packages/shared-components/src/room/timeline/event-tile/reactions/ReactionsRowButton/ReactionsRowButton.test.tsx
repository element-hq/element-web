/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { fireEvent, render } from "@test-utils";
import React from "react";
import { describe, it, expect } from "vitest";

import * as stories from "./ReactionsRowButton.stories";

const { Default, Selected } = composeStories(stories);

describe("ReactionsRowButton", () => {
    it("renders the default reaction button", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the selected reaction button", () => {
        const { container } = render(<Selected />);
        expect(container).toMatchSnapshot();
    });

    it("shows the animated reaction image only while hovered or focused", () => {
        const { container } = render(
            <Default imageSrc="https://server/static" animatedImageSrc="https://server/animated" imageAlt="party" />,
        );
        const button = container.querySelector("button")!;
        const img = container.querySelector("img")!;
        expect(img.getAttribute("src")).toBe("https://server/static");

        fireEvent.mouseEnter(button);
        expect(img.getAttribute("src")).toBe("https://server/animated");
        fireEvent.mouseLeave(button);
        expect(img.getAttribute("src")).toBe("https://server/static");

        fireEvent.focus(button);
        expect(img.getAttribute("src")).toBe("https://server/animated");
        fireEvent.blur(button);
        expect(img.getAttribute("src")).toBe("https://server/static");
    });
});
