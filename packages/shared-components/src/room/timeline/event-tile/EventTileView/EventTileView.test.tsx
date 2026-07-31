/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { fireEvent, render } from "@test-utils";
import { EventTileView, type EventTileViewProps } from "./index";

const renderState: EventTileViewProps["root"] = {
    id: "event-line-1",
    ariaLive: "off",
    scrollToken: "event-1",
    permalink: "https://example.org/event-1",
    data: {
        eventId: "$event-1",
        layout: "group",
        shape: "Room",
        isOwnEvent: true,
        hasReply: true,
    },
};

function createProps(overrides: Partial<EventTileViewProps> = {}): EventTileViewProps {
    return {
        root: renderState,
        classNames: {
            root: "custom-root",
            line: "custom-line",
        },
        slots: {
            body: <span data-testid="body">Body</span>,
            contextMenu: <span data-testid="context-menu">Context menu</span>,
        },
        ...overrides,
    };
}

describe("EventTileView", () => {
    it("renders the common root and line structure", () => {
        const { container, getByTestId } = render(<EventTileView {...createProps()} />);
        const root = container.firstElementChild;
        const line = getByTestId("body").parentElement;

        expect(root).toHaveClass("custom-root");
        expect(root).toHaveAttribute("aria-live", "off");
        expect(root).toHaveAttribute("aria-atomic", "true");
        expect(root).toHaveAttribute("data-scroll-tokens", "event-1");
        expect(root).toHaveAttribute("data-event-id", "$event-1");
        expect(root).toHaveAttribute("data-layout", "group");
        expect(root).toHaveAttribute("data-shape", "Room");
        expect(root).toHaveAttribute("data-self", "true");
        expect(root).toHaveAttribute("data-has-reply", "true");
        expect(line).toHaveClass("custom-line");
        expect(line).toHaveAttribute("id", "event-line-1");
        expect(getByTestId("context-menu")).toBeInTheDocument();
    });

    it("renders the thread layout in the original slot order", () => {
        const { container, getByTestId } = render(
            <EventTileView
                {...createProps({
                    classNames: {
                        senderDetails: "legacy-sender-details",
                    },
                    root: {
                        ...renderState,
                        data: { ...renderState.data, shape: "Thread" },
                    },
                    slots: {
                        avatar: <span data-testid="avatar">Avatar</span>,
                        sender: <span data-testid="sender">Sender</span>,
                        replyChain: <span data-testid="reply-chain">Reply chain</span>,
                        body: <span data-testid="body">Body</span>,
                        actionBar: <span data-testid="action-bar">Action bar</span>,
                        timestamp: <span data-testid="timestamp">Timestamp</span>,
                        receipt: <span data-testid="receipt">Receipt</span>,
                        footer: <span data-testid="footer">Footer</span>,
                    },
                })}
            />,
        );
        const root = container.firstElementChild!;
        const senderDetails = getByTestId("avatar").parentElement!;
        const line = getByTestId("body").parentElement!;

        expect(senderDetails).toContainElement(getByTestId("sender"));
        expect(senderDetails).toHaveClass("legacy-sender-details");
        expect(senderDetails).toBe(root.firstElementChild);
        expect(line).toContainElement(getByTestId("reply-chain"));
        expect(line).toContainElement(getByTestId("action-bar"));
        expect(line).toContainElement(getByTestId("timestamp"));
        expect(line).toContainElement(getByTestId("receipt"));
        expect(getByTestId("footer").parentElement).toBe(root);
    });

    it.each(["Notification", "ThreadsList"] as const)("renders the %s preview layout", (shape) => {
        const { container, getByTestId, queryByTestId } = render(
            <EventTileView
                {...createProps({
                    classNames: {
                        details: "legacy-details",
                        avatar: "legacy-avatar",
                        threadListActionBar: "legacy-thread-action-bar",
                    },
                    root: {
                        ...renderState,
                        data: { ...renderState.data, shape },
                    },
                    slots: {
                        sender: <span data-testid="sender">Sender</span>,
                        notificationRoomLabel:
                            shape === "Notification" ? <span data-testid="room-label">Room</span> : undefined,
                        timestamp: <span data-testid="timestamp">Timestamp</span>,
                        notificationBadge: <span data-testid="badge">Badge</span>,
                        roomAvatar: <span data-testid="room-avatar">Room avatar</span>,
                        avatar: <span data-testid="avatar">Avatar</span>,
                        body: <span data-testid="body">Body</span>,
                        threadInfo: <span data-testid="thread-info">Thread info</span>,
                        actionBar: <span data-testid="action-bar">Action bar</span>,
                        receipt: <span data-testid="receipt">Receipt</span>,
                    },
                })}
            />,
        );
        const root = container.firstElementChild!;
        const details = getByTestId("sender").parentElement!;
        const line = getByTestId("body").parentElement!;

        expect(root).toHaveAttribute("tabindex", "-1");
        expect(details).toContainElement(getByTestId("timestamp"));
        expect(details).toHaveClass("legacy-details");
        expect(details).toContainElement(getByTestId("badge"));
        expect(line).toContainElement(getByTestId("thread-info"));
        expect(getByTestId("receipt").parentElement).toBe(root);

        if (shape === "Notification") {
            const avatar = getByTestId("room-avatar").parentElement!;
            expect(avatar.parentElement).toBe(root);
            expect(avatar).toHaveClass("legacy-avatar");
            expect(queryByTestId("action-bar")).not.toBeInTheDocument();
        } else {
            const avatar = getByTestId("avatar");
            const actionBar = getByTestId("action-bar").parentElement!;
            expect(avatar.parentElement).toBe(root);
            expect(actionBar.parentElement).toBe(root);
            expect(actionBar).toHaveClass("legacy-thread-action-bar");
            expect(queryByTestId("room-avatar")).not.toBeInTheDocument();
        }
    });

    it("renders the file layout with permalink interactions", () => {
        const onPermalinkClick = vi.fn();
        const onPermalinkContextMenu = vi.fn();
        const { container, getByTestId } = render(
            <EventTileView
                {...createProps({
                    root: { ...renderState, data: { ...renderState.data, shape: "File" } },
                    classNames: {
                        senderDetails: "legacy-sender-details",
                        senderDetailsLink: "legacy-sender-details-link",
                    },
                    onPermalinkClick,
                    onPermalinkContextMenu,
                    slots: {
                        avatar: <span data-testid="avatar">Avatar</span>,
                        sender: <span data-testid="sender">Sender</span>,
                        timestamp: <span data-testid="timestamp">Timestamp</span>,
                        body: <span data-testid="body">Body</span>,
                    },
                })}
            />,
        );
        const root = container.firstElementChild!;
        const link = getByTestId("sender").parentElement!.parentElement!;
        const senderDetails = getByTestId("sender").parentElement!;

        expect(link).toHaveAttribute("href", renderState.permalink);
        expect(link).toHaveClass("legacy-sender-details-link");
        expect(senderDetails).toHaveClass("legacy-sender-details");
        expect(senderDetails).toContainElement(getByTestId("timestamp"));
        expect(getByTestId("body").parentElement).toBe(root.lastElementChild);

        fireEvent.click(link);
        fireEvent.contextMenu(senderDetails);
        expect(onPermalinkClick).toHaveBeenCalledOnce();
        expect(onPermalinkContextMenu).toHaveBeenCalledOnce();
    });

    it.each(["group", "irc"] as const)("renders the %s timeline layout", (layout) => {
        const { container, getByTestId } = render(
            <EventTileView
                {...createProps({
                    root: { ...renderState, data: { ...renderState.data, layout } },
                    slots: {
                        sender: <span data-testid="sender">Sender</span>,
                        avatar: <span data-testid="avatar">Avatar</span>,
                        timestamp: <span data-testid="timestamp">Timestamp</span>,
                        padlock: <span data-testid="padlock">Padlock</span>,
                        replyChain: <span data-testid="reply-chain">Reply chain</span>,
                        body: <span data-testid="body">Body</span>,
                        actionBar: <span data-testid="action-bar">Action bar</span>,
                        footer: <span data-testid="footer">Footer</span>,
                        threadInfo: <span data-testid="thread-info">Thread info</span>,
                        receipt: <span data-testid="receipt">Receipt</span>,
                        contextMenu: <span data-testid="context-menu">Context menu</span>,
                    },
                })}
            />,
        );
        const root = container.firstElementChild!;
        const line = getByTestId("body").parentElement!;

        expect(root).toHaveAttribute("tabindex", "-1");
        expect(line).toContainElement(getByTestId("reply-chain"));
        expect(line).toContainElement(getByTestId("action-bar"));

        if (layout === "irc") {
            expect(root.firstElementChild).toBe(getByTestId("timestamp"));
            expect(getByTestId("padlock").parentElement).toBe(root);
            expect(getByTestId("footer").parentElement).toBe(line);
            expect(getByTestId("thread-info").parentElement).toBe(line);
        } else {
            expect(getByTestId("timestamp").parentElement).toBe(line);
            expect(getByTestId("padlock").parentElement).toBe(line);
            expect(getByTestId("footer").parentElement).toBe(root);
            expect(getByTestId("thread-info").parentElement).toBe(root);
        }

        expect(getByTestId("receipt").parentElement).toBe(root);
    });

    it("forwards root and line interactions", () => {
        const onClick = vi.fn();
        const onContextMenu = vi.fn();
        const { container, getByTestId } = render(<EventTileView {...createProps({ onClick, onContextMenu })} />);

        fireEvent.click(container.firstElementChild!);
        fireEvent.contextMenu(getByTestId("body").parentElement!);

        expect(onClick).not.toHaveBeenCalled();
        expect(onContextMenu).toHaveBeenCalledOnce();

        const { container: previewContainer } = render(
            <EventTileView
                {...createProps({
                    root: { ...renderState, data: { ...renderState.data, shape: "Notification" } },
                    onClick,
                })}
            />,
        );
        fireEvent.click(previewContainer.firstElementChild!);
        expect(onClick).toHaveBeenCalledOnce();
    });

    it("forwards the root ref and supports a custom root element", () => {
        const rootRef = createRef<HTMLElement>();
        const { container } = render(
            <EventTileView {...createProps({ root: { ...renderState, as: "article" }, refs: { root: rootRef } })} />,
        );

        expect(container.firstElementChild?.tagName).toBe("ARTICLE");
        expect(rootRef.current).toBe(container.firstElementChild);
    });
});
