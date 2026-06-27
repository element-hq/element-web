/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fireEvent, render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import RoomSearchResults from "../../../../../src/components/views/rooms/RoomSearchResults";
import { type SearchResultPreview } from "../../../../../src/Searching";

const preview = (eventId: string, sender: string, body: string, ts: number): SearchResultPreview => ({
    roomId: "!r:server",
    eventId,
    sender,
    body,
    ts,
});

// JSDOM does no layout, so the scroll metrics that drive infinite scroll are all 0 by default — stub them per test.
const setScrollMetrics = (
    el: HTMLElement,
    { scrollHeight, clientHeight, scrollTop }: { scrollHeight: number; clientHeight: number; scrollTop: number },
): void => {
    Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
    Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
    Object.defineProperty(el, "scrollTop", { configurable: true, writable: true, value: scrollTop });
};

describe("RoomSearchResults", () => {
    const previews = [
        preview("$a", "@alice:server", "hello gemini world", 1700000000000),
        preview("$b", "@bob:server", "another gemini line", 1690000000000),
    ];
    const getSenderName = (p: SearchResultPreview): string => (p.sender === "@alice:server" ? "Alice" : "Bob");

    const renderResults = (props: Partial<React.ComponentProps<typeof RoomSearchResults>> = {}): void => {
        render(
            <RoomSearchResults
                previews={previews}
                inProgress={false}
                hasMore={false}
                onResultClick={jest.fn()}
                onLoadMore={jest.fn()}
                getSenderName={getSenderName}
                {...props}
            />,
        );
    };

    it("renders a row per result with sender name and preview, reporting clicks by index", async () => {
        const onResultClick = jest.fn();
        renderResults({ onResultClick });

        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("hello gemini world")).toBeInTheDocument();
        expect(screen.getByText("Bob")).toBeInTheDocument();

        await userEvent.click(screen.getByText("another gemini line"));
        expect(onResultClick).toHaveBeenCalledWith(1);
    });

    it("shows an empty state when there are no results and the search has settled", () => {
        renderResults({ previews: [] });
        expect(screen.getByText("No messages found")).toBeInTheDocument();
    });

    it("shows a spinner while the search is in progress with no results yet", () => {
        const { container } = render(
            <RoomSearchResults
                previews={[]}
                inProgress={true}
                hasMore={false}
                onResultClick={jest.fn()}
                onLoadMore={jest.fn()}
                getSenderName={getSenderName}
            />,
        );
        expect(container.querySelector(".mx_Spinner")).toBeTruthy();
    });

    it("shows the error message when the search failed", () => {
        renderResults({ previews: [], error: new Error("boom") });
        expect(screen.getByText("boom")).toBeInTheDocument();
    });

    it("appends a spinner under the loaded rows while the next page is loading", () => {
        const { container } = render(
            <RoomSearchResults
                previews={previews}
                inProgress={true}
                hasMore={true}
                onResultClick={jest.fn()}
                onLoadMore={jest.fn()}
                getSenderName={getSenderName}
            />,
        );
        // The already-loaded rows stay visible (no flash to empty) and a spinner sits below them.
        expect(screen.getByText("hello gemini world")).toBeInTheDocument();
        expect(container.querySelector(".mx_RoomSearchResults_loadingMore .mx_Spinner")).toBeTruthy();
    });

    it("loads the next page when scrolled near the bottom", () => {
        const onLoadMore = jest.fn();
        const { container } = render(
            <RoomSearchResults
                previews={previews}
                inProgress={false}
                hasMore={true}
                onResultClick={jest.fn()}
                onLoadMore={onLoadMore}
                getSenderName={getSenderName}
            />,
        );
        const list = container.querySelector<HTMLElement>(".mx_RoomSearchResults")!;
        setScrollMetrics(list, { scrollHeight: 1000, clientHeight: 200, scrollTop: 900 });
        fireEvent.scroll(list);
        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it("does not load more when the user is not near the bottom", () => {
        const onLoadMore = jest.fn();
        const { container } = render(
            <RoomSearchResults
                previews={previews}
                inProgress={false}
                hasMore={true}
                onResultClick={jest.fn()}
                onLoadMore={onLoadMore}
                getSenderName={getSenderName}
            />,
        );
        const list = container.querySelector<HTMLElement>(".mx_RoomSearchResults")!;
        setScrollMetrics(list, { scrollHeight: 1000, clientHeight: 200, scrollTop: 0 });
        fireEvent.scroll(list);
        expect(onLoadMore).not.toHaveBeenCalled();
    });

    it("does not load more when there are no further pages", () => {
        const onLoadMore = jest.fn();
        const { container } = render(
            <RoomSearchResults
                previews={previews}
                inProgress={false}
                hasMore={false}
                onResultClick={jest.fn()}
                onLoadMore={onLoadMore}
                getSenderName={getSenderName}
            />,
        );
        const list = container.querySelector<HTMLElement>(".mx_RoomSearchResults")!;
        setScrollMetrics(list, { scrollHeight: 1000, clientHeight: 200, scrollTop: 900 });
        fireEvent.scroll(list);
        expect(onLoadMore).not.toHaveBeenCalled();
    });

    it("does not load more while a page is already loading", () => {
        const onLoadMore = jest.fn();
        const { container } = render(
            <RoomSearchResults
                previews={previews}
                inProgress={true}
                hasMore={true}
                onResultClick={jest.fn()}
                onLoadMore={onLoadMore}
                getSenderName={getSenderName}
            />,
        );
        const list = container.querySelector<HTMLElement>(".mx_RoomSearchResults")!;
        setScrollMetrics(list, { scrollHeight: 1000, clientHeight: 200, scrollTop: 900 });
        fireEvent.scroll(list);
        expect(onLoadMore).not.toHaveBeenCalled();
    });
});
