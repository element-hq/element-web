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
    className: "custom-root",
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

const lineState: EventTileViewProps["line"] = {
    className: "custom-line",
    id: "event-line-1",
};

function createProps(overrides: Partial<EventTileViewProps> = {}): EventTileViewProps {
    return {
        root: renderState,
        line: lineState,
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
        expect(senderDetails).toBe(root.firstElementChild);
        expect(line).toContainElement(getByTestId("reply-chain"));
        expect(line).toContainElement(getByTestId("action-bar"));
        expect(line).toContainElement(getByTestId("timestamp"));
        expect(line).toContainElement(getByTestId("receipt"));
        expect(getByTestId("footer").parentElement).toBe(root);
    });

    it("forwards root and line interactions", () => {
        const onClick = vi.fn();
        const onContextMenu = vi.fn();
        const { container, getByTestId } = render(<EventTileView {...createProps({ onClick, onContextMenu })} />);

        fireEvent.click(container.firstElementChild!);
        fireEvent.contextMenu(getByTestId("body").parentElement!);

        expect(onClick).toHaveBeenCalledOnce();
        expect(onContextMenu).toHaveBeenCalledOnce();
    });

    it("forwards the root ref and supports a custom root element", () => {
        const rootRef = createRef<HTMLElement>();
        const { container } = render(<EventTileView {...createProps({ as: "article", refs: { root: rootRef } })} />);

        expect(container.firstElementChild?.tagName).toBe("ARTICLE");
        expect(rootRef.current).toBe(container.firstElementChild);
    });
});
