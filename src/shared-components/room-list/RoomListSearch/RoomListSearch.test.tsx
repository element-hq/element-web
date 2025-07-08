/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render } from "jest-matrix-react";
import React from "react";

import * as stories from "./RoomListSearch.stories.tsx";

const { Default, HideExploreButton, HideDialButton, HideAllButtons } = composeStories(stories);

describe("RoomListSearch", () => {
    it("renders the search bar with all the buttons", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the search bar with the explore button hidden", () => {
        const { container } = render(<HideExploreButton />);
        expect(container).toMatchSnapshot();
    });

    it("renders the search bar with the dial button hidden", () => {
        const { container } = render(<HideDialButton />);
        expect(container).toMatchSnapshot();
    });

    it("renders the search bar with all the button hidden", () => {
        const { container } = render(<HideAllButtons />);
        expect(container).toMatchSnapshot();
    });
});
