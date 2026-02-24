/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { VirtuosoMockContext } from "react-virtuoso";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";

import * as stories from "./RoomListView.stories";

const {
    Default,
    Loading,
    Empty,
    EmptyWithoutCreatePermission,
    WithActiveFilter,
    SmallList,
    LargeList,
    EmptyFavouriteFilter,
    EmptyPeopleFilter,
    EmptyRoomsFilter,
    EmptyUnreadFilter,
    EmptyInvitesFilter,
    EmptyMentionsFilter,
    EmptyLowPriorityFilter,
} = composeStories(stories);

const renderWithMockContext = (component: React.ReactElement): ReturnType<typeof render> => {
    return render(component, {
        wrapper: ({ children }) => (
            <VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 52 }}>
                {children}
            </VirtuosoMockContext.Provider>
        ),
    });
};

describe("<RoomListView />", () => {
    it("renders Default story", () => {
        const { container } = renderWithMockContext(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders Loading story", () => {
        const { container } = renderWithMockContext(<Loading />);
        expect(container).toMatchSnapshot();
    });

    it("renders Empty story", () => {
        const { container } = renderWithMockContext(<Empty />);
        expect(container).toMatchSnapshot();
    });

    it("renders EmptyWithoutCreatePermission story", () => {
        const { container } = renderWithMockContext(<EmptyWithoutCreatePermission />);
        expect(container).toMatchSnapshot();
    });

    it("renders WithActiveFilter story", () => {
        const { container } = renderWithMockContext(<WithActiveFilter />);
        expect(container).toMatchSnapshot();
    });

    it("renders SmallList story", () => {
        const { container } = renderWithMockContext(<SmallList />);
        expect(container).toMatchSnapshot();
    });

    it("renders LargeList story", () => {
        const { container } = renderWithMockContext(<LargeList />);
        expect(container).toMatchSnapshot();
    });

    it("renders EmptyFavouriteFilter story", () => {
        const { container } = renderWithMockContext(<EmptyFavouriteFilter />);
        expect(container).toMatchSnapshot();
    });

    it("renders EmptyPeopleFilter story", () => {
        const { container } = renderWithMockContext(<EmptyPeopleFilter />);
        expect(container).toMatchSnapshot();
    });

    it("renders EmptyRoomsFilter story", () => {
        const { container } = renderWithMockContext(<EmptyRoomsFilter />);
        expect(container).toMatchSnapshot();
    });

    it("renders EmptyUnreadFilter story", () => {
        const { container } = renderWithMockContext(<EmptyUnreadFilter />);
        expect(container).toMatchSnapshot();
    });

    it("renders EmptyInvitesFilter story", () => {
        const { container } = renderWithMockContext(<EmptyInvitesFilter />);
        expect(container).toMatchSnapshot();
    });

    it("renders EmptyMentionsFilter story", () => {
        const { container } = renderWithMockContext(<EmptyMentionsFilter />);
        expect(container).toMatchSnapshot();
    });

    it("renders EmptyLowPriorityFilter story", () => {
        const { container } = renderWithMockContext(<EmptyLowPriorityFilter />);
        expect(container).toMatchSnapshot();
    });

    it("should call onToggleFilter when filter is clicked", async () => {
        const user = userEvent.setup();
        renderWithMockContext(<Default />);

        await user.click(screen.getByRole("option", { name: "People" }));

        expect(Default.args.onToggleFilter).toHaveBeenCalled();
    });

    it("should call createRoom when New room button is clicked", async () => {
        const user = userEvent.setup();
        renderWithMockContext(<Empty />);

        await user.click(screen.getByRole("button", { name: "New room" }));

        expect(Empty.args.createRoom).toHaveBeenCalled();
    });

    it("should call createChatRoom when Start chat button is clicked", async () => {
        const user = userEvent.setup();
        renderWithMockContext(<Empty />);

        await user.click(screen.getByRole("button", { name: "Start chat" }));

        expect(Empty.args.createChatRoom).toHaveBeenCalled();
    });

    it("should call onToggleFilter when Show all chats is clicked in unread empty state", async () => {
        const user = userEvent.setup();
        renderWithMockContext(<EmptyUnreadFilter />);

        await user.click(screen.getByRole("button", { name: "Show all chats" }));

        expect(EmptyUnreadFilter.args.onToggleFilter).toHaveBeenCalled();
    });

    it("should call onToggleFilter when See all activity is clicked in invites empty state", async () => {
        const user = userEvent.setup();
        renderWithMockContext(<EmptyInvitesFilter />);

        await user.click(screen.getByRole("button", { name: "See all activity" }));

        expect(EmptyInvitesFilter.args.onToggleFilter).toHaveBeenCalled();
    });

    it("should call onToggleFilter when See all activity is clicked in mentions empty state", async () => {
        const user = userEvent.setup();
        renderWithMockContext(<EmptyMentionsFilter />);

        await user.click(screen.getByRole("button", { name: "See all activity" }));

        expect(EmptyMentionsFilter.args.onToggleFilter).toHaveBeenCalled();
    });

    it("should call onToggleFilter when See all activity is clicked in low priority empty state", async () => {
        const user = userEvent.setup();
        renderWithMockContext(<EmptyLowPriorityFilter />);

        await user.click(screen.getByRole("button", { name: "See all activity" }));

        expect(EmptyLowPriorityFilter.args.onToggleFilter).toHaveBeenCalled();
    });
});
