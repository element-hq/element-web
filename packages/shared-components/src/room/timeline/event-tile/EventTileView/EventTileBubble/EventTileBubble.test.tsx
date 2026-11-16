/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";
import React from "react";

import * as stories from "./EventTileBubble.stories.tsx";

const { Default, HasLockSolidIcon, HasChildren, IsCryptoEventBubble } = composeStories(stories);

describe("EventTileBubble", () => {
    it("renders the event tile bubble", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the event tile bubble with icon", () => {
        const { container } = render(<HasLockSolidIcon />);
        expect(container).toMatchSnapshot();
    });

    it("renders the event tile bubble with children", () => {
        const { container } = render(<HasChildren />);
        expect(container).toMatchSnapshot();
    });

    it("renders the event tile bubble as crypto event bubble", () => {
        const { container } = render(<IsCryptoEventBubble />);
        expect(container).toMatchSnapshot();
    });

    // The bubble inherits the line height of the timeline layout: 22px in the modern layout, 18px in bubble and IRC.
    it.each(["22px", "18px"])("centers the icon on the title with a %s line height", (lineHeight) => {
        render(
            <div style={{ lineHeight }}>
                <IsCryptoEventBubble />
            </div>,
        );

        const title = screen.getByText("Encryption enabled");
        const iconBox = title.parentElement!.querySelector("svg")!.getBoundingClientRect();
        const titleLineCenter = title.getBoundingClientRect().top + Number.parseFloat(lineHeight) / 2;
        expect(iconBox.top + iconBox.height / 2).toBe(titleLineCenter);
    });
});
