/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";
import React from "react";

import * as stories from "./EventTileBubble.stories.tsx";

const { Default, HasLockSolidIcon, HasChildren, HasTimestamp, HasTimestampAndChildren, IsCryptoEventBubble } =
    composeStories(stories);

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

    it("renders the event tile bubble with timestamp", () => {
        const { container } = render(<HasTimestamp />);
        expect(container).toMatchSnapshot();
    });

    it("renders the event tile bubble with timestamp and children", () => {
        const { container } = render(<HasTimestampAndChildren />);
        expect(container).toMatchSnapshot();
    });

    it("renders the event tile bubble as crypto event bubble", () => {
        const { container } = render(<IsCryptoEventBubble />);
        expect(container).toMatchSnapshot();
    });
});
