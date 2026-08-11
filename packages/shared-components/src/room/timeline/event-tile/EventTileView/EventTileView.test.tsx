/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { fireEvent, render } from "@test-utils";
import { EventTileView, type EventTileViewClassNames, type EventTileViewProps } from "./index";
import styles from "./EventTileView.module.css";

const renderState: EventTileViewProps["root"] = {
    id: "event-line-1",
    ariaLive: "off",
    scrollToken: "event-1",
    permalink: "https://example.org/event-1",
    eventId: "$event-1",
    layout: "group",
    shape: "Room",
    state: {
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
            slotContextMenu: "custom-context-menu",
        },
        slots: {
            body: <span data-testid="body">Body</span>,
            contextMenu: <span data-testid="context-menu">Context menu</span>,
        },
        ...overrides,
    };
}

/**
 * Styling hooks consumed by the web application's EventTile PCSS.
 *
 * Keep these names in this test until the application styling is migrated to
 * shared-component selectors. The shared shell must preserve them alongside
 * its own module classes.
 */
const applicationStylingClasses = {
    root: "mx_EventTile",
    line: "mx_EventTile_line",
    details: "mx_EventTile_details",
    slotAvatar: "mx_EventTile_avatar",
    senderDetails: "mx_EventTile_senderDetails",
    senderDetailsLink: "mx_EventTile_senderDetailsLink",
    slotBody: "mx_EventTile_body",
    slotNotificationRoomLabel: "mx_EventTile_truncated",
    slotNotificationBadge: "mx_NotificationBadge",
    slotSender: "mx_DisambiguatedProfile",
    slotTimestamp: "mx_MessageTimestamp",
    slotPadlock: "mx_EventTile_e2eIcon",
    slotReplyChain: "mx_EventTile_reply",
    slotActionBar: "mx_MessageActionBar",
    slotFooter: "mx_EventTile_footer",
    slotThreadInfo: "mx_ThreadSummary",
    slotReceipt: "mx_ReadReceiptGroup_container",
} satisfies Partial<EventTileViewClassNames>;

const applicationSlotClassNames: Record<string, keyof typeof applicationStylingClasses> = {
    avatar: "slotAvatar",
    sender: "slotSender",
    body: "slotBody",
    timestamp: "slotTimestamp",
    padlock: "slotPadlock",
    replyChain: "slotReplyChain",
    actionBar: "slotActionBar",
    footer: "slotFooter",
    threadInfo: "slotThreadInfo",
    receipt: "slotReceipt",
};

const slotClasses: Record<string, string> = {
    avatar: styles.slotAvatar,
    sender: styles.slotSender,
    body: styles.slotBody,
    contextMenu: styles.slotContextMenu,
    replyChain: styles.slotReplyChain,
    actionBar: styles.slotActionBar,
    timestamp: styles.slotTimestamp,
    padlock: styles.slotPadlock,
    footer: styles.slotFooter,
    threadInfo: styles.slotThreadInfo,
    receipt: styles.slotReceipt,
    roomAvatar: styles.slotAvatar,
    notificationRoomLabel: styles.slotNotificationRoomLabel,
    notificationBadge: styles.slotNotificationBadge,
};

function createStylingContractSlots(): EventTileViewProps["slots"] {
    const slot = (name: string): React.ReactElement => <span data-testid={`styling-contract-${name}`}>{name}</span>;

    return {
        avatar: slot("avatar"),
        sender: slot("sender"),
        body: slot("body"),
        timestamp: slot("timestamp"),
        padlock: slot("padlock"),
        replyChain: slot("replyChain"),
        actionBar: slot("actionBar"),
        footer: slot("footer"),
        threadInfo: slot("threadInfo"),
        receipt: slot("receipt"),
        roomAvatar: slot("room-avatar"),
        notificationRoomLabel: slot("notificationRoomLabel"),
        notificationBadge: slot("notificationBadge"),
        contextMenu: slot("contextMenu"),
    };
}

describe("EventTileView", () => {
    it("renders the common root and line structure", () => {
        const { container, getByTestId } = render(<EventTileView {...createProps()} />);
        const root = container.firstElementChild;
        const line = getByTestId("body").closest(".custom-line");
        const contextMenu = getByTestId("context-menu").parentElement;

        expect(root).toHaveClass("custom-root");
        expect(root).toHaveAttribute("aria-live", "off");
        expect(root).toHaveAttribute("aria-atomic", "true");
        expect(root).toHaveAttribute("data-scroll-tokens", "event-1");
        expect(root).toHaveAttribute("data-event-id", "$event-1");
        expect(root).toHaveClass(styles.layoutGroup);
        expect(root).toHaveClass(styles.stateOwnEvent);
        expect(line).toHaveClass("custom-line");
        expect(line).toHaveAttribute("id", "event-line-1");
        expect(getByTestId("context-menu")).toBeInTheDocument();
        expect(contextMenu).toHaveClass("custom-context-menu");
        expect(contextMenu).toHaveClass(styles.slot);
        expect(contextMenu).toHaveAttribute("data-testid", "event-tile-slot-contextMenu");
    });

    it("exposes shell state through application-neutral state classes", () => {
        const { container } = render(
            <EventTileView
                {...createProps({
                    root: {
                        ...renderState,
                        state: {
                            ...renderState.state,
                            highlighted: true,
                            selected: true,
                            editing: true,
                            continuation: true,
                            lastInSection: true,
                        },
                    },
                })}
            />,
        );
        const root = container.firstElementChild!;

        expect(root).toHaveClass(styles.stateHighlighted);
        expect(root).toHaveClass(styles.stateSelected);
        expect(root).toHaveClass(styles.stateEditing);
        expect(root).toHaveClass(styles.stateContinuation);
        expect(root).toHaveClass(styles.stateLastInSection);
    });

    it("preserves the application styling contract across rendering modes", () => {
        const group = render(
            <EventTileView
                {...createProps({
                    classNames: applicationStylingClasses,
                    slots: createStylingContractSlots(),
                })}
            />,
        );
        const groupRoot = group.container.firstElementChild!;

        expect(groupRoot).toHaveClass(applicationStylingClasses.root);
        expect(
            group.getByTestId("styling-contract-body").closest(`.${applicationStylingClasses.line}`),
        ).toBeInTheDocument();

        for (const slot of [
            "sender",
            "avatar",
            "body",
            "timestamp",
            "padlock",
            "replyChain",
            "actionBar",
            "footer",
            "threadInfo",
            "receipt",
        ]) {
            expect(group.getByTestId(`styling-contract-${slot}`).closest(`.${styles.slot}`)).toHaveClass(
                applicationStylingClasses[applicationSlotClassNames[slot]],
            );
            expect(group.getByTestId(`styling-contract-${slot}`).closest(`.${styles.slot}`)).toHaveClass(
                slotClasses[slot],
            );
            expect(group.getByTestId(`styling-contract-${slot}`).closest(`.${styles.slot}`)).toHaveAttribute(
                "data-testid",
                `event-tile-slot-${slot}`,
            );
        }

        const thread = render(
            <EventTileView
                {...createProps({
                    classNames: applicationStylingClasses,
                    root: { ...renderState, shape: "Thread" },
                    slots: createStylingContractSlots(),
                })}
            />,
        );
        expect(thread.container.querySelector(".mx_EventTile_senderDetails")).toHaveClass(
            applicationStylingClasses.senderDetails,
        );

        const preview = render(
            <EventTileView
                {...createProps({
                    classNames: applicationStylingClasses,
                    root: { ...renderState, shape: "Notification" },
                    slots: createStylingContractSlots(),
                })}
            />,
        );
        expect(preview.container.querySelector(".mx_EventTile_details")).toHaveClass(applicationStylingClasses.details);
        expect(preview.getByTestId("styling-contract-notificationRoomLabel").parentElement).toHaveClass(
                applicationStylingClasses.slotNotificationRoomLabel,
        );
        expect(preview.getByTestId("styling-contract-notificationBadge").parentElement).toHaveClass(
                applicationStylingClasses.slotNotificationBadge,
        );
        expect(preview.getByTestId("styling-contract-room-avatar").parentElement).toHaveClass(
                applicationStylingClasses.slotAvatar,
        );

        const file = render(
            <EventTileView
                {...createProps({
                    classNames: applicationStylingClasses,
                    root: { ...renderState, shape: "File" },
                    slots: createStylingContractSlots(),
                })}
            />,
        );
        expect(file.container.querySelector(".mx_EventTile_senderDetailsLink")).toHaveClass(
            applicationStylingClasses.senderDetailsLink,
        );
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
                        shape: "Thread",
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
        const senderDetails = getByTestId("avatar").parentElement?.parentElement;
        const line = getByTestId("body").parentElement?.parentElement;

        if (!senderDetails || !line) {
            throw new Error("Expected EventTile thread layout elements to be present");
        }

        expect(senderDetails).toContainElement(getByTestId("sender"));
        expect(senderDetails).toHaveClass("legacy-sender-details");
        expect(senderDetails).toBe(root.firstElementChild);
        expect(line).toContainElement(getByTestId("reply-chain"));
        expect(line).toContainElement(getByTestId("action-bar"));
        expect(line).toContainElement(getByTestId("timestamp"));
        expect(line).toContainElement(getByTestId("receipt"));
        expect(getByTestId("footer").parentElement?.parentElement).toBe(root);
    });

    it.each(["Notification", "ThreadsList"] as const)("renders the %s preview layout", (shape) => {
        const { container, getByTestId, queryByTestId } = render(
            <EventTileView
                {...createProps({
                    classNames: {
                        details: "legacy-details",
                        slotAvatar: "legacy-avatar",
                        slotActionBar: "legacy-thread-action-bar",
                    },
                    root: {
                        ...renderState,
                        shape,
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
        const details = getByTestId("sender").parentElement?.parentElement;
        const line = getByTestId("body").parentElement?.parentElement;

        if (!details || !line) {
            throw new Error(`Expected EventTile ${shape} layout elements to be present`);
        }

        expect(root).toHaveAttribute("tabindex", "-1");
        expect(root).toHaveClass(shape === "Notification" ? styles.shapeNotification : styles.shapeThreadsList);
        expect(details).toContainElement(getByTestId("timestamp"));
        expect(details).toHaveClass("legacy-details");
        expect(details).toContainElement(getByTestId("badge"));
        expect(line).toContainElement(getByTestId("thread-info"));
        expect(getByTestId("receipt").parentElement?.parentElement).toBe(root);

        if (shape === "Notification") {
            const avatar = getByTestId("room-avatar").parentElement!;
            expect(avatar.parentElement).toBe(root);
            expect(avatar).toHaveClass("legacy-avatar");
            expect(queryByTestId("action-bar")).not.toBeInTheDocument();
        } else {
            const avatar = getByTestId("avatar").parentElement!;
            const actionBar = getByTestId("action-bar").parentElement!;
            expect(avatar.parentElement).toBe(root);
            expect(actionBar.parentElement).toBe(root);
            expect(actionBar).toHaveClass("legacy-thread-action-bar");
            expect(queryByTestId("room-avatar")).not.toBeInTheDocument();
        }
    });

    it("renders the file layout with permalink interactions", () => {
        const onPermalinkClick = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
        });
        const onPermalinkContextMenu = vi.fn();
        const { container, getByTestId } = render(
            <EventTileView
                {...createProps({
                    root: { ...renderState, shape: "File" },
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
        const link = getByTestId("sender").closest("a");
        const senderDetails = getByTestId("sender").closest(".legacy-sender-details");

        expect(root).toHaveClass(styles.shapeFile);

        if (!link) {
            throw new Error("Expected sender details link");
        }
        if (!senderDetails) {
            throw new Error("Expected sender details container");
        }

        expect(link).toHaveAttribute("href", renderState.permalink);
        expect(link).toHaveClass("legacy-sender-details-link");
        expect(senderDetails).toHaveClass("legacy-sender-details");
        expect(senderDetails).toContainElement(getByTestId("timestamp"));
        expect(getByTestId("body").closest("#event-line-1")).toBe(root.lastElementChild);

        fireEvent.click(link);
        fireEvent.contextMenu(senderDetails);
        expect(onPermalinkClick).toHaveBeenCalledOnce();
        expect(onPermalinkContextMenu).toHaveBeenCalledOnce();
    });

    it("falls back to a safe file permalink", () => {
        const { getByTestId } = render(
            <EventTileView
                {...createProps({
                    root: { ...renderState, permalink: undefined, shape: "File" },
                })}
            />,
        );

        expect(getByTestId("body").closest("#event-line-1")?.previousElementSibling).toHaveAttribute("href", "#");
    });

    it.each(["group", "irc"] as const)("renders the %s timeline layout", (layout) => {
        const { container, getByTestId } = render(
            <EventTileView
                {...createProps({
                    root: { ...renderState, layout },
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
        const line = getByTestId("body").parentElement?.parentElement;

        if (!line) {
            throw new Error(`Expected EventTile ${layout} layout line to be present`);
        }

        expect(root).toHaveAttribute("tabindex", "-1");
        expect(root).toHaveClass(layout === "irc" ? styles.layoutIrc : styles.layoutGroup);
        expect(line).toContainElement(getByTestId("reply-chain"));
        expect(line).toContainElement(getByTestId("action-bar"));

        if (layout === "irc") {
            expect(root.children[0]).toContainElement(getByTestId("padlock"));
            expect(root.children[1]).toContainElement(getByTestId("timestamp"));
            expect(root.children[2]).toContainElement(getByTestId("avatar"));
            expect(root.children[3]).toContainElement(getByTestId("sender"));
            expect(root.children[4]).toBe(line);
            expect(root.children[5]).toContainElement(getByTestId("receipt"));
            expect(getByTestId("padlock").parentElement?.parentElement).toBe(root);
            expect(getByTestId("footer").parentElement?.parentElement).toBe(line);
            expect(getByTestId("thread-info").parentElement?.parentElement).toBe(line);
        } else {
            expect(getByTestId("timestamp").parentElement?.parentElement).toBe(line);
            expect(getByTestId("padlock").parentElement?.parentElement).toBe(line);
            expect(getByTestId("footer").parentElement?.parentElement).toBe(root);
            expect(getByTestId("thread-info").parentElement?.parentElement).toBe(root);
        }

        expect(getByTestId("receipt").parentElement?.parentElement).toBe(root);
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
                    root: { ...renderState, shape: "Notification" },
                    onClick,
                })}
            />,
        );
        fireEvent.click(previewContainer.firstElementChild!);
        expect(onClick).toHaveBeenCalledOnce();
    });

    it("does not attach a context menu handler to preview lines", () => {
        const onContextMenu = vi.fn();
        const { getByTestId } = render(
            <EventTileView
                {...createProps({
                    root: { ...renderState, shape: "Notification" },
                    onContextMenu,
                })}
            />,
        );

        fireEvent.contextMenu(getByTestId("body").parentElement!);
        expect(onContextMenu).not.toHaveBeenCalled();
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
