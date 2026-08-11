/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import classNames from "classnames";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Avatar } from "@vector-im/compound-web";
import { ThreadsIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { useMockedViewModel } from "../../../../core/viewmodel";
import { useEventPresentation } from "../../EventPresentation";
import { withViewDocs } from "../../../../../.storybook/withViewDocs";
import { EventTileView, type EventTileViewProps } from "./index";
import { E2ePadlock, E2ePadlockIcon } from "./E2ePadlock";
import { DisambiguatedProfileView } from "./DisambiguatedProfile";
import { ActionBarAction, ActionBarView } from "../actions/ActionBarView";
import { MessageTimestampView } from "../timestamp/MessageTimestampView";
import { ReactionsRowView } from "../reactions/ReactionsRow";
import { ReactionsRowButtonView } from "../reactions/ReactionsRowButton";
import { type ReactionsRowButtonTooltipViewModel } from "../reactions/ReactionsRowButtonTooltip";
import {
    ThreadSummaryView,
    ThreadMessagePreviewView,
    type ThreadMessagePreviewViewSnapshot,
} from "./ThreadSummary/ThreadSummaryView";
import styles from "./EventTileView.stories.module.css";

type StoryBoundary = HTMLElement;

const getBoundary = (target: EventTarget | null, root: HTMLElement): StoryBoundary | null => {
    if (!(target instanceof HTMLElement)) return null;

    const boundary = target.closest<StoryBoundary>(
        "[data-story-boundary], [data-event-tile-slot], .storyEventTile, .storyEventLine",
    );
    return boundary && root.contains(boundary) ? boundary : null;
};

const StoryDebugFrame = ({ children }: React.PropsWithChildren): React.ReactElement => {
    const frameRef = React.useRef<HTMLDivElement>(null);
    const activeBoundaryRef = React.useRef<StoryBoundary | null>(null);
    const [activeBoundary, setActiveBoundary] = React.useState<StoryBoundary | null>(null);

    const clearActiveBoundary = (): void => {
        activeBoundaryRef.current?.removeAttribute("data-story-hovered");
        activeBoundaryRef.current = null;
        setActiveBoundary(null);
    };

    const updateActiveBoundary = (event: React.PointerEvent<HTMLDivElement>): void => {
        const frame = frameRef.current;
        if (!frame) return;

        const boundary = getBoundary(event.target, frame);
        if (boundary === activeBoundaryRef.current) return;

        activeBoundaryRef.current?.removeAttribute("data-story-hovered");
        boundary?.setAttribute("data-story-hovered", "true");
        activeBoundaryRef.current = boundary;
        setActiveBoundary(boundary);
    };

    React.useEffect(() => {
        return () => activeBoundaryRef.current?.removeAttribute("data-story-hovered");
    }, []);

    return (
        <div
            ref={frameRef}
            className={styles.debugFrame}
            onPointerMove={updateActiveBoundary}
            onPointerLeave={clearActiveBoundary}
        >
            {children}
            {activeBoundary && (
                <div className={styles.debugTooltip} role="status">
                    {activeBoundary.dataset.storyBoundary ??
                        (activeBoundary.dataset.eventTileSlot
                            ? `EventTileView.slots.${activeBoundary.dataset.eventTileSlot}`
                            : activeBoundary.classList.contains("storyEventTile")
                              ? "EventTileView"
                              : "EventTileView.line")}
                </div>
            )}
        </div>
    );
};

const StoryAvatar = ({
    room = false,
    label = "A",
    size = "30px",
    className,
}: {
    room?: boolean;
    label?: string;
    size?: string;
    className?: string;
}): React.ReactElement => (
    <Avatar
        id={room ? "!story-room:example.org" : `@${label.toLowerCase()}:example.org`}
        name={room ? "Story room" : label === "A" ? "Alice Example" : "Bob Example"}
        type="round"
        size={size}
        className={className}
        aria-label={room ? "Story room avatar" : `${label} avatar`}
    />
);

const StorySender = ({
    name = "Alex Example",
    id = "@alex:example.org",
    className,
}: {
    name?: string;
    id?: string;
    className?: string;
}): React.ReactElement => {
    const vm = useMockedViewModel({ displayName: name, displayIdentifier: id, emphasizeDisplayName: true }, {});
    return <DisambiguatedProfileView vm={vm} className={className} />;
};

const StoryTimestamp = ({
    className,
    visible = true,
}: {
    className?: string;
    visible?: boolean;
}): React.ReactElement | null => {
    const vm = useMockedViewModel(
        { ts: "12:34", tsSentAt: "Tuesday, 4 August 2026 at 12:34", inhibitTooltip: true },
        {},
    );
    return visible ? <MessageTimestampView vm={vm} className={className} /> : null;
};
const StoryBody = (): React.ReactElement => (
    <div className={styles.body}>
        <div>Here is a realistic event tile body with enough text to show the available width.</div>
        <div>This second line makes wrapping and vertical rhythm visible in Storybook.</div>
    </div>
);
const StoryReplyChain = (): React.ReactElement => (
    <blockquote className={styles.replyChain}>
        <span className={styles.replyAuthor}>Taylor Example</span>
        <span>Earlier message quoted in this reply.</span>
    </blockquote>
);
const StoryActionBar = (): React.ReactElement | null => {
    const vm = useMockedViewModel(
        {
            actions: [ActionBarAction.React, ActionBarAction.Reply, ActionBarAction.Options],
            presentation: "icon" as const,
            isDownloadEncrypted: false,
            isDownloadLoading: false,
            isPinned: false,
            isQuoteExpanded: false,
            isThreadReplyAllowed: true,
        },
        { onReactionsClick: fn(), onReplyClick: fn(), onOptionsClick: fn() },
    );
    return <ActionBarView vm={vm} />;
};

const useStoryReactionTooltipVm = (caption: string): ReactionsRowButtonTooltipViewModel =>
    useMockedViewModel({ formattedSenders: "Alice Example and Bob Example", caption }, {});

const StoryFooter = (): React.ReactElement => {
    const vm = useMockedViewModel(
        {
            ariaLabel: "Reactions",
            isVisible: true,
            showAddReactionButton: true,
            addReactionButtonLabel: "Add reaction",
            addReactionButtonVisible: true,
        },
        { onAddReactionClick: fn(), onAddReactionContextMenu: fn() },
    );
    const thumbsUpVm = useMockedViewModel(
        {
            "content": "👍",
            "count": 2,
            "isSelected": false,
            "aria-label": "Thumbs up, 2 reactions",
            "tooltipVm": useStoryReactionTooltipVm("Thumbs up"),
        },
        { onClick: fn() },
    );
    const heartVm = useMockedViewModel(
        {
            "content": "❤️",
            "count": 1,
            "isSelected": true,
            "aria-label": "Red heart, 1 reaction",
            "tooltipVm": useStoryReactionTooltipVm("Red heart"),
        },
        { onClick: fn() },
    );
    return (
        <ReactionsRowView vm={vm} className={styles.storyReactions}>
            <ReactionsRowButtonView vm={thumbsUpVm} />
            <ReactionsRowButtonView vm={heartVm} />
        </ReactionsRowView>
    );
};
const storyThreadPreview: ThreadMessagePreviewViewSnapshot = {
    isVisible: true,
    avatar: {
        id: "@alice:example.org",
        name: "Alice Example",
        label: "Alice Example avatar",
    },
    showDisplayName: true,
    senderName: "Alice Example",
    previewContent: "Can you review the draft?",
    previewTooltip: "Can you review the draft?",
};

const StoryThreadInfo = (): React.ReactElement => {
    const previewVm = useMockedViewModel(storyThreadPreview, {});
    const threadSummaryVm = useMockedViewModel(
        {
            isVisible: true,
            replyCountLabel: "3 replies",
            openThreadLabel: "Open thread",
            notificationIndicator: undefined,
            narrow: false,
            previewVm,
        },
        { onClick: fn() },
    );

    return <ThreadSummaryView vm={threadSummaryVm} />;
};

/** The ThreadsList view uses the compact inline replies preview, not ThreadSummaryView. */
const StoryThreadListInfo = (): React.ReactElement => {
    const previewVm = useMockedViewModel(storyThreadPreview, {});

    return (
        <div className={styles.threadListInfo}>
            <ThreadsIcon className={styles.threadListIcon} />
            <span className={styles.threadListReplies}>3</span>
            <ThreadMessagePreviewView vm={previewVm} />
        </div>
    );
};
const StoryReceipt = (): React.ReactElement => (
    <span className={styles.receipt}>
        <span className={styles.readReceiptGroup}>
            <button type="button" className={styles.readReceiptButton} aria-label="Read by Alex and Taylor">
                <span className={styles.readReceiptContainer} aria-hidden="true">
                    <span className={styles.receiptAvatar}>T</span>
                    <span className={styles.receiptAvatar}>A</span>
                </span>
            </button>
        </span>
    </span>
);
const StoryPadlock = (): React.ReactElement => <E2ePadlock icon={E2ePadlockIcon.Normal} title="End-to-end encrypted" />;
const StoryContextMenu = (): React.ReactElement => <span className={styles.contextMenu}>⋯</span>;

const TimelineStoryFrame = ({
    density,
    layout,
    children,
}: React.PropsWithChildren<{ density: string; layout: string }>): React.ReactElement => (
    <StoryDebugFrame>
        <div className={styles.storySurface} data-story-boundary="Timeline">
            <div className={styles.timeline} data-story-boundary="RoomView.timeline" data-event-layout={layout}>
                <div className={styles.scrollPanel} data-story-boundary="ScrollPanel">
                    <div className={styles.messageListWrapper} data-story-boundary="messageListWrapper">
                        <ol
                            className={styles.messageList}
                            data-story-boundary="RoomView.MessageList"
                            data-event-density={density}
                        >
                            {children}
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    </StoryDebugFrame>
);

const baseRoot: EventTileViewProps["root"] = {
    id: "event-tile-story-line",
    ariaLive: "off",
    scrollToken: "event-tile-story",
    permalink: "https://example.org/event-tile-story",
    data: { eventId: "$event-tile-story", layout: "group", shape: "Room", isOwnEvent: false, hasReply: true },
};

const roomSlots: EventTileViewProps["slots"] = {
    sender: <StorySender />,
    avatar: <StoryAvatar />,
    body: <StoryBody />,
    timestamp: <StoryTimestamp />,
    padlock: <StoryPadlock />,
    replyChain: <StoryReplyChain />,
    actionBar: <StoryActionBar />,
    footer: <StoryFooter />,
    threadInfo: <StoryThreadInfo />,
    receipt: <StoryReceipt />,
    contextMenu: <StoryContextMenu />,
};

type EventTileStoryProps = Omit<EventTileViewProps, "root"> & {
    shape: EventTileViewProps["root"]["data"]["shape"];
    state?: EventTileViewProps["root"]["state"];
    roomMessages?: "boundaries" | "alice";
};

function EventTileViewStoryContent({
    shape,
    state,
    roomMessages = "boundaries",
    ...props
}: EventTileStoryProps): React.ReactElement {
    const { layout, density } = useEventPresentation();
    const [tileInteractions, setTileInteractions] = React.useState<
        Record<string, { hovered: boolean; focused: boolean }>
    >({});

    const updateTileInteraction = (suffix: string, update: Partial<{ hovered: boolean; focused: boolean }>): void => {
        setTileInteractions((current) => ({
            ...current,
            [suffix]: {
                ...(current[suffix] ?? { hovered: false, focused: false }),
                ...update,
            },
        }));
    };

    const renderTile = (
        isOwnEvent: boolean,
        suffix: string,
        boundaryState: EventTileViewProps["root"]["state"] = {},
        isLast = false,
    ): React.ReactElement => {
        const tileState = { ...boundaryState, ...state };
        const interaction = tileInteractions[suffix] ?? { hovered: false, focused: false };
        const showActionBar = interaction.hovered || interaction.focused;
        const showTimestamp = isLast || showActionBar;
        const timestamp = layout === "irc" || showTimestamp ? <StoryTimestamp visible={showTimestamp} /> : undefined;
        const showSenderAndAvatar = layout === "irc" || !tileState.continuation;
        const sender = showSenderAndAvatar ? (
            <StorySender
                name={isOwnEvent ? "Alice" : "Bob"}
                id={isOwnEvent ? "@alice:example.org" : "@bob:example.org"}
                className={layout === "irc" ? styles.ircSender : undefined}
            />
        ) : undefined;

        const slots =
            shape === "Room"
                ? {
                      // Keep Bob's boundary examples as plain text events.
                      ...(isOwnEvent ? props.slots : { body: props.slots.body }),
                      sender,
                      avatar: showSenderAndAvatar ? (
                          <StoryAvatar label={isOwnEvent ? "A" : "B"} size={layout === "irc" ? "14px" : "30px"} />
                      ) : undefined,
                      timestamp,
                      actionBar: showActionBar ? props.slots?.actionBar : undefined,
                  }
                : {
                      ...props.slots,
                      actionBar: showActionBar ? props.slots?.actionBar : undefined,
                      // The application Thread rendering branch places no thread-info slot.
                      threadInfo: shape === "Thread" ? undefined : props.slots?.threadInfo,
                  };

        return (
            <EventTileView
                key={suffix}
                {...props}
                classNames={{
                    ...props.classNames,
                    root: classNames(
                        props.classNames?.root,
                        "storyEventTile",
                        styles.storyEventTile,
                        isOwnEvent && styles.storyOwnEvent,
                    ),
                    line: classNames(props.classNames?.line, "storyEventLine"),
                }}
                slots={slots}
                root={{
                    ...baseRoot,
                    id: `${baseRoot.id}-${suffix}`,
                    scrollToken: `${baseRoot.scrollToken}-${suffix}`,
                    data: {
                        ...baseRoot.data,
                        eventId: `${baseRoot.data.eventId}-${suffix}`,
                        layout,
                        shape,
                        isOwnEvent,
                    },
                    state: tileState,
                }}
                onMouseEnter={(event) => {
                    props.onMouseEnter?.(event);
                    updateTileInteraction(suffix, { hovered: true });
                }}
                onMouseLeave={(event) => {
                    props.onMouseLeave?.(event);
                    updateTileInteraction(suffix, { hovered: false });
                }}
                onFocus={(event) => {
                    props.onFocus?.(event);
                    updateTileInteraction(suffix, { focused: true });
                }}
                onBlur={(event) => {
                    props.onBlur?.(event);
                    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                        updateTileInteraction(suffix, { focused: false });
                    }
                }}
            />
        );
    };
    return (
        <TimelineStoryFrame density={density} layout={layout}>
            {shape === "Room" ? (
                roomMessages === "alice" ? (
                    renderTile(true, "alice-single", { continuation: false, lastInSection: true }, true)
                ) : (
                    <>
                        {renderTile(false, "bob-first", { continuation: false, lastInSection: false })}
                        {renderTile(false, "bob-middle", { continuation: true, lastInSection: false })}
                        {renderTile(false, "bob-last", { continuation: true, lastInSection: true })}
                        {renderTile(true, "alice-single", { continuation: false, lastInSection: true }, true)}
                    </>
                )
            ) : (
                renderTile(false, "event")
            )}
        </TimelineStoryFrame>
    );
}

const EventTileViewStoryImpl = (props: EventTileStoryProps): React.ReactElement => (
    <EventTileViewStoryContent {...props} />
);

const EventTileViewStory = withViewDocs(EventTileViewStoryImpl, EventTileView);

const eventTileStoryDefaults = {
    classNames: { details: styles.detailsContainer, line: styles.line },
    onClick: fn(),
    onContextMenu: fn(),
    onPermalinkClick: fn(),
    onPermalinkContextMenu: fn(),
    slots: roomSlots,
};

const meta = {
    title: "Timeline/EventTileView",
    component: EventTileViewStory,
    tags: ["autodocs"],
    render: (args) => <EventTileViewStory {...args} />,
    argTypes: {
        shape: {
            control: "select",
            options: ["Room", "Thread", "ThreadsList", "File", "Notification", "Search", "Pinned"],
        },
        classNames: { table: { disable: true } },
        state: {
            control: "object",
        },
        onMouseEnter: { table: { disable: true } },
        onMouseLeave: { table: { disable: true } },
        onFocus: { table: { disable: true } },
        onBlur: { table: { disable: true } },
        onClick: { table: { disable: true } },
        onContextMenu: { table: { disable: true } },
        onPermalinkClick: { table: { disable: true } },
        onPermalinkContextMenu: { table: { disable: true } },
        refs: { table: { disable: true } },
        slots: { table: { category: "Slots" } },
    },
    args: {
        shape: "Room",
        state: {},
        ...eventTileStoryDefaults,
    },
} satisfies Meta<typeof EventTileViewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Room: Story = {};

export const ThreadsList: Story = {
    args: {
        shape: "ThreadsList",
        slots: {
            sender: <StorySender />,
            avatar: <StoryAvatar />,
            body: <StoryBody />,
            timestamp: <StoryTimestamp />,
            notificationBadge: <span className={styles.notificationDot} role="img" aria-label="Unread notifications" />,
            threadInfo: <StoryThreadListInfo />,
            actionBar: <StoryActionBar />,
        },
    },
};

export const Thread: Story = {
    args: {
        shape: "Thread",
    },
};

export const Notification: Story = {
    args: {
        shape: "Notification",
        slots: {
            sender: <StorySender />,
            body: <StoryBody />,
            timestamp: <StoryTimestamp />,
            roomAvatar: <StoryAvatar room size="28px" />,
            notificationRoomLabel: <span className={styles.roomLabel}>in Example room</span>,
            notificationBadge: <span className={styles.notificationDot} role="img" aria-label="Unread notifications" />,
            threadInfo: <StoryThreadListInfo />,
            receipt: <StoryReceipt />,
        },
    },
};

export const File: Story = {
    args: {
        shape: "File",
        slots: {
            sender: <StorySender />,
            avatar: <StoryAvatar />,
            timestamp: <StoryTimestamp />,
            body: <StoryBody />,
            contextMenu: <StoryContextMenu />,
        },
    },
};

export const Highlighted: Story = {
    args: {
        shape: "Thread",
        state: { highlighted: true },
        slots: {
            sender: <StorySender />,
            avatar: <StoryAvatar />,
            timestamp: <StoryTimestamp />,
            body: <StoryBody />,
        },
    },
};

export const Selected: Story = {
    args: {
        shape: "Thread",
        state: { selected: true },
        slots: {
            sender: <StorySender />,
            avatar: <StoryAvatar />,
            timestamp: <StoryTimestamp />,
            body: <StoryBody />,
        },
    },
};
