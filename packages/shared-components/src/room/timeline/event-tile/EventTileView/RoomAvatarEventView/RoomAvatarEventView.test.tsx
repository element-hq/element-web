/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render } from "@test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import * as stories from "./RoomAvatarEventView.stories.tsx";

const { Changed, Removed } = composeStories(stories);

describe("RoomAvatarEventView", () => {
    it("renders a changed room avatar event", () => {
        const { container } = render(<Changed />);
        expect(container).toMatchSnapshot();
    });

    it("renders a removed room avatar event", () => {
        const { container } = render(<Removed />);
        expect(container).toMatchSnapshot();
    });
});
