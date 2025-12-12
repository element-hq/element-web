/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";

import * as stories from "./RoomListSearchView.stories";
import {
    RoomListSearchView,
    type RoomListSearchViewActions,
    type RoomListSearchViewSnapshot,
} from "./RoomListSearchView";
import { MockViewModel } from "../../viewmodel/MockViewModel";

const { Default, WithDialPad, WithoutExplore, AllButtons } = composeStories(stories);

describe("RoomListSearchView", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Storybook snapshots", () => {
        it("renders the default state", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });

        it("renders with dial pad button", () => {
            const { container } = render(<WithDialPad />);
            expect(container).toMatchSnapshot();
        });

        it("renders without explore button", () => {
            const { container } = render(<WithoutExplore />);
            expect(container).toMatchSnapshot();
        });

        it("renders with all buttons visible", () => {
            const { container } = render(<AllButtons />);
            expect(container).toMatchSnapshot();
        });
    });

    describe("User interactions", () => {
        const onSearchClick = jest.fn();
        const onDialPadClick = jest.fn();
        const onExploreClick = jest.fn();

        class TestViewModel extends MockViewModel<RoomListSearchViewSnapshot> implements RoomListSearchViewActions {
            public onSearchClick = onSearchClick;
            public onDialPadClick = onDialPadClick;
            public onExploreClick = onExploreClick;
        }

        it("should call onSearchClick when search button is clicked", async () => {
            const user = userEvent.setup();
            const vm = new TestViewModel({
                displayExploreButton: false,
                displayDialButton: false,
                searchShortcut: "⌘ K",
            });

            render(<RoomListSearchView vm={vm} />);

            await user.click(screen.getByRole("button", { name: "Search ⌘ K" }));
            expect(onSearchClick).toHaveBeenCalledTimes(1);
        });

        it("should call onDialPadClick when dial pad button is clicked", async () => {
            const user = userEvent.setup();
            const vm = new TestViewModel({
                displayExploreButton: false,
                displayDialButton: true,
                searchShortcut: "⌘ K",
            });

            render(<RoomListSearchView vm={vm} />);

            await user.click(screen.getByRole("button", { name: "Open dial pad" }));
            expect(onDialPadClick).toHaveBeenCalledTimes(1);
        });

        it("should call onExploreClick when explore button is clicked", async () => {
            const user = userEvent.setup();
            const vm = new TestViewModel({
                displayExploreButton: true,
                displayDialButton: false,
                searchShortcut: "⌘ K",
            });

            render(<RoomListSearchView vm={vm} />);

            await user.click(screen.getByRole("button", { name: "Explore rooms" }));
            expect(onExploreClick).toHaveBeenCalledTimes(1);
        });
    });
});
