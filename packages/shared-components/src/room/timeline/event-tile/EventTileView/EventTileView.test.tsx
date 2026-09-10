/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { fireEvent, render } from "@test-utils";
import type { EventLayout } from "../../EventPresentation";
import {
    EventTileView,
    type EventTileViewClassNames,
    type EventTileViewLine,
    type EventTileViewProps,
    type EventTileViewRootState,
} from "./index";
import styles from "./EventTileView.module.css";

const renderState: EventTileViewProps["root"] = {
    id: "event-line-1",
    ariaLive: "off",
    scrollToken: "event-1",
    permalink: "https://example.org/event-1",
    eventId: "$event-1",
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
    slotTimestamp: "mx_MessageTimestamp",
} satisfies Partial<EventTileViewClassNames>;

const applicationSlotClassNames: Record<string, keyof typeof applicationStylingClasses> = {
    timestamp: "slotTimestamp",
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

const rootStateMatrix = [
    { name: "informational", state: { info: true }, hook: "stateInfo" },
    { name: "bubble container", state: { bubbleContainer: true }, hook: "stateBubbleContainer" },
    { name: "left-aligned bubble", state: { leftAlignedBubble: true }, hook: "stateLeftAlignedBubble" },
    { name: "aligned between bubbles", state: { alignedBetweenBubbles: true }, hook: "stateAlignedBetweenBubbles" },
    { name: "no bubble", state: { noBubble: true }, hook: "stateNoBubble" },
    { name: "no sender", state: { noSender: true }, hook: "stateNoSender" },
    { name: "encryption failure", state: { encryptionFailure: true }, hook: "stateEncryptionFailure" },
    { name: "emote", state: { emote: true }, hook: "stateEmote" },
    { name: "reply chain", state: { hasReply: true }, hook: "stateHasReply" },
    { name: "editing", state: { editing: true }, hook: "stateEditing" },
    { name: "continuation", state: { continuation: true }, hook: "stateContinuation" },
    { name: "contextual", state: { contextual: true }, hook: "stateContextual" },
    { name: "action bar focused", state: { actionBarFocused: true }, hook: "stateActionBarFocused" },
    { name: "preview clamped", state: { previewClamped: true }, hook: "statePreviewClamped" },
] satisfies ReadonlyArray<{
    name: string;
    state: Partial<EventTileViewRootState>;
    hook: keyof typeof styles;
}>;

const lineStateMatrix = [
    { name: "media", state: { media: true }, hook: "lineMedia" },
    { name: "image", state: { image: true }, hook: "lineImage" },
    { name: "sticker", state: { sticker: true }, hook: "lineSticker" },
    { name: "emote", state: { emote: true }, hook: "lineEmote" },
] satisfies ReadonlyArray<{
    name: string;
    state: EventTileViewLine;
    hook: keyof typeof styles;
}>;

const groupLineSlotOrder = [
    "styling-contract-contextMenu",
    "event-tile-slot-timestamp",
    "event-tile-slot-padlock",
    "event-tile-slot-replyChain",
    "event-tile-slot-body",
    "event-tile-slot-actionBar",
];

const groupRootSlotOrder = [
    "event-tile-slot-sender",
    "event-tile-slot-avatar",
    "event-tile-line",
    "event-tile-slot-footer",
    "event-tile-slot-threadInfo",
    "event-tile-slot-receipt",
];

const ircLineSlotOrder = [
    "styling-contract-contextMenu",
    "event-tile-slot-replyChain",
    "event-tile-slot-body",
    "event-tile-slot-actionBar",
    "event-tile-slot-footer",
    "event-tile-slot-threadInfo",
];

const ircRootSlotOrder = [
    "event-tile-slot-timestamp",
    "event-tile-slot-padlock",
    "event-tile-slot-avatar",
    "event-tile-slot-sender",
    "event-tile-line",
    "event-tile-slot-receipt",
];

const shellPlacementMatrix = [
    { name: "informational", rootState: { info: true }, lineState: {}, layout: "group" },
    { name: "bubble container in group layout", rootState: { bubbleContainer: true }, lineState: {}, layout: "group" },
    {
        name: "bubble container in bubble layout",
        rootState: { bubbleContainer: true },
        lineState: {},
        layout: "bubble",
    },
    { name: "bubble container in IRC layout", rootState: { bubbleContainer: true }, lineState: {}, layout: "irc" },
    { name: "left-aligned bubble", rootState: { leftAlignedBubble: true }, lineState: {}, layout: "bubble" },
    { name: "aligned between bubbles", rootState: { alignedBetweenBubbles: true }, lineState: {}, layout: "bubble" },
    { name: "no bubble", rootState: { noBubble: true }, lineState: {}, layout: "bubble" },
    { name: "no sender", rootState: { noSender: true }, lineState: {}, layout: "bubble" },
    {
        name: "encryption failure with reply",
        rootState: { encryptionFailure: true, hasReply: true },
        lineState: {},
        layout: "bubble",
    },
    { name: "editing continuation", rootState: { editing: true, continuation: true }, lineState: {}, layout: "bubble" },
    { name: "media line", rootState: {}, lineState: { media: true }, layout: "group" },
    { name: "sticker line", rootState: {}, lineState: { sticker: true }, layout: "bubble" },
    { name: "emote line", rootState: {}, lineState: { emote: true }, layout: "bubble" },
    { name: "other-event bubble alignment", rootState: {}, lineState: {}, layout: "bubble", isOwnEvent: false },
] satisfies ReadonlyArray<{
    name: string;
    rootState: Partial<EventTileViewRootState>;
    lineState: EventTileViewLine;
    layout: EventLayout;
    isOwnEvent?: boolean;
}>;

describe("EventTileView", () => {
    it("renders the common root and line structure", () => {
        const { container, getByTestId } = render(<EventTileView {...createProps()} />);
        const root = container.firstElementChild;
        const line = getByTestId("body").closest(".custom-line");
        const contextMenu = getByTestId("context-menu");

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
        expect(contextMenu.parentElement).toBe(line);
        expect(contextMenu).not.toHaveAttribute("data-testid", "event-tile-slot-contextMenu");
    });

    it("renders the card shape with the room slot structure", () => {
        const { container, getByTestId } = render(
            <EventTileView
                {...createProps({
                    root: { ...renderState, shape: "Card" },
                    slots: createStylingContractSlots(),
                })}
            />,
        );

        expect(container.firstElementChild).toHaveClass(styles.shapeCard);
        expect(getByTestId("styling-contract-body").closest(`#${renderState.id}`)).toBeInTheDocument();
    });

    it("exposes the Search shape styling hook", () => {
        const { container } = render(
            <EventTileView
                {...createProps({
                    root: { ...renderState, shape: "Search" },
                    slots: createStylingContractSlots(),
                })}
            />,
        );

        expect(container.firstElementChild).toHaveClass(styles.shapeSearch);
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

    it.each(rootStateMatrix)("maps the $name root state to its semantic shell hook", ({ state, hook }) => {
        const { container } = render(
            <EventTileView
                {...createProps({
                    root: {
                        ...renderState,
                        state: { ...renderState.state, ...state },
                    },
                })}
            />,
        );

        expect(container.firstElementChild).toHaveClass(styles[hook]);
    });

    it("maps presentation density to a shell hook instead of event state", () => {
        const { container } = render(<EventTileView {...createProps()} />, {
            presentation: { layout: "group", density: "compact" },
        });

        expect(container.firstElementChild).toHaveClass(styles.densityCompact);
        expect(container.firstElementChild).not.toHaveClass("stateCompact");
    });

    it.each(lineStateMatrix)("maps the $name line state to its semantic shell hook", ({ state, hook }) => {
        const { getByTestId } = render(
            <EventTileView {...createProps({ line: state, slots: createStylingContractSlots() })} />,
        );

        expect(getByTestId("styling-contract-body").closest(`.${styles.line}`)).toHaveClass(styles[hook]);
    });

    it.each(shellPlacementMatrix)(
        "keeps $name slots contained and ordered by the shell",
        ({ rootState, lineState, layout, isOwnEvent = renderState.state.isOwnEvent }) => {
            const { container } = render(
                <EventTileView
                    {...createProps({
                        root: {
                            ...renderState,
                            state: { ...renderState.state, ...rootState, isOwnEvent },
                        },
                        line: lineState,
                        slots: createStylingContractSlots(),
                    })}
                />,
                { presentation: { layout } },
            );
            const root = container.firstElementChild;
            const line = root?.querySelector(`#${renderState.id}`);

            if (!root || !line) {
                throw new Error("Expected EventTile root and line to be present");
            }

            const lineSlotOrder = layout === "irc" ? ircLineSlotOrder : groupLineSlotOrder;
            const rootSlotOrder = layout === "irc" ? ircRootSlotOrder : groupRootSlotOrder;

            expect(Array.from(line.children).map((child) => child.getAttribute("data-testid"))).toEqual(lineSlotOrder);
            expect(Array.from(root.children).map((child) => child.getAttribute("data-testid") ?? child.id)).toEqual(
                rootSlotOrder,
            );

            const containedLineSlots =
                layout === "irc"
                    ? ["replyChain", "body", "actionBar", "footer", "threadInfo"]
                    : ["timestamp", "padlock", "replyChain", "body", "actionBar"];
            for (const slotName of containedLineSlots) {
                expect(root.querySelector(`[data-testid="event-tile-slot-${slotName}"]`)?.parentElement).toBe(line);
            }
        },
    );

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

        for (const slot of ["timestamp"]) {
            expect(
                group.getByTestId(`styling-contract-${slot}`).closest('[data-testid^="event-tile-slot-"]'),
            ).toHaveClass(applicationStylingClasses[applicationSlotClassNames[slot]]);
            expect(
                group.getByTestId(`styling-contract-${slot}`).closest('[data-testid^="event-tile-slot-"]'),
            ).toHaveClass(slotClasses[slot]);
            expect(
                group.getByTestId(`styling-contract-${slot}`).closest('[data-testid^="event-tile-slot-"]'),
            ).toHaveAttribute("data-testid", `event-tile-slot-${slot}`);
        }

        const preview = render(
            <EventTileView
                {...createProps({
                    classNames: applicationStylingClasses,
                    root: { ...renderState, shape: "Notification" },
                    slots: createStylingContractSlots(),
                })}
            />,
        );
        expect(preview.getByTestId("styling-contract-notificationRoomLabel").parentElement).toHaveClass(
            slotClasses.notificationRoomLabel,
        );
        expect(preview.getByTestId("styling-contract-notificationBadge").parentElement).toHaveClass(
            slotClasses.notificationBadge,
        );
        expect(preview.getByTestId("styling-contract-room-avatar").parentElement).toHaveClass(slotClasses.avatar);
    });

    it("renders multiple slot children inside one wrapper boundary", () => {
        const { getByTestId } = render(
            <EventTileView
                {...createProps({
                    slots: {
                        body: (
                            <>
                                <span data-testid="fragment-child-one">One</span>
                                <span data-testid="fragment-child-two">Two</span>
                            </>
                        ),
                    },
                })}
            />,
        );

        const firstChild = getByTestId("fragment-child-one");
        const secondChild = getByTestId("fragment-child-two");
        const wrapper = firstChild.closest('[data-testid="event-tile-slot-body"]');

        expect(wrapper).not.toBeNull();
        expect(secondChild.parentElement).toBe(wrapper);
        expect(wrapper).toHaveClass(styles.slotBody);
        expect(wrapper?.children).toHaveLength(2);
    });

    it.each([undefined, null, false] as const)("does not render a wrapper for an empty %s slot", (content) => {
        const { container } = render(
            <EventTileView
                {...createProps({
                    slots: {
                        body: <span data-testid="body">Body</span>,
                        avatar: content,
                    },
                })}
            />,
        );

        expect(container.querySelector('[data-testid="event-tile-slot-avatar"]')).not.toBeInTheDocument();
    });

    it("derives receipt gutter styling from receipt slot presence", () => {
        const withReceipt = render(
            <EventTileView
                {...createProps({
                    slots: {
                        body: <span data-testid="body">Body</span>,
                        receipt: <span data-testid="receipt">Receipt</span>,
                    },
                })}
            />,
        );
        const withoutReceipt = render(<EventTileView {...createProps()} />);

        expect(withReceipt.container.querySelector("li")).toHaveClass(styles.hasReceiptSlot);
        expect(withoutReceipt.container.querySelector("li")).not.toHaveClass(styles.hasReceiptSlot);
    });

    it.each(["group", "bubble"] as const)("renders the %s thread layout in the original slot order", (layout) => {
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
            { presentation: { layout } },
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

        expect(Array.from(line.children).map((child) => child.getAttribute("data-testid"))).toEqual([
            "event-tile-slot-replyChain",
            "event-tile-slot-body",
            "event-tile-slot-actionBar",
            "event-tile-slot-timestamp",
            "event-tile-slot-receipt",
        ]);
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
                    root: renderState,
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
            { presentation: { layout } },
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

        const expectedRootSlotOrder = layout === "irc" ? ircRootSlotOrder : groupRootSlotOrder;
        expect(Array.from(root.children).map((child) => child.getAttribute("data-testid") ?? child.id)).toEqual(
            expectedRootSlotOrder,
        );

        if (layout === "irc") {
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
