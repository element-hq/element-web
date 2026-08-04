/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import classNames from "classnames";
import { fn } from "storybook/test";
import { Avatar } from "@vector-im/compound-web";

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
    type ThreadMessagePreviewViewSnapshot,
} from "./ThreadSummary/ThreadSummaryView";
import styles from "./EventTileView.stories.module.css";

export const Slot = ({
    name,
    className,
    children,
}: React.PropsWithChildren<{ name: string; as?: "div" | "span"; className?: string }>): React.ReactElement => {
    if (!React.isValidElement(children)) {
        return <span data-story-boundary={`EventTileView.slots.${name}`}>{children}</span>;
    }

    const child = children as React.ReactElement<StorySlotProps>;
    const storyBoundary = `EventTileView.slots.${name}`;

    if (typeof child.type === "string") {
        return React.cloneElement(child, {
            className: classNames(styles.slot, child.props.className, className),
            "data-story-boundary": storyBoundary,
        });
    }

    return React.cloneElement(child, {
        className: classNames(styles.slot, child.props.className, className),
        storyBoundary,
        "data-story-boundary": storyBoundary,
    });
};

type StoryBoundary = HTMLElement;
type StorySlotProps = { className?: string; storyBoundary?: string; "data-story-boundary"?: string };

const getBoundary = (target: EventTarget | null, root: HTMLElement): StoryBoundary | null => {
    if (!(target instanceof HTMLElement)) return null;

    const boundary = target.closest<StoryBoundary>("[data-story-boundary], .storyEventTile, .storyEventLine");
    return boundary && root.contains(boundary) ? boundary : null;
};

export const StoryDebugFrame = ({ children }: React.PropsWithChildren): React.ReactElement => {
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
                        (activeBoundary.classList.contains("storyEventTile")
                            ? "EventTileView"
                            : "EventTileView.line")}
                </div>
            )}
        </div>
    );
};

export const StoryAvatar = ({
    room = false,
    label = "A",
    size = "30px",
    className,
    storyBoundary,
}: {
    room?: boolean;
    label?: string;
    size?: string;
    className?: string;
    storyBoundary?: string;
}): React.ReactElement => (
    <div className={className} data-story-boundary={storyBoundary}>
        <Avatar
            id={room ? "!story-room:example.org" : `@${label.toLowerCase()}:example.org`}
            name={room ? "Story room" : label === "A" ? "Alice Example" : "Bob Example"}
            type="round"
            size={size}
            aria-label={room ? "Story room avatar" : `${label} avatar`}
        />
    </div>
);

export const StorySender = ({
    name = "Alex Example",
    id = "@alex:example.org",
    className,
    storyBoundary,
}: {
    name?: string;
    id?: string;
    className?: string;
    storyBoundary?: string;
}): React.ReactElement => {
    const vm = useMockedViewModel(
        { displayName: name, displayIdentifier: id, emphasizeDisplayName: true },
        {},
    );
    return (
        <span className={styles.storyBoundaryHost} data-story-boundary={storyBoundary}>
            <DisambiguatedProfileView vm={vm} className={className} />
        </span>
    );
};

export const StoryTimestamp = ({
    className,
    storyBoundary,
    visible = true,
}: StorySlotProps & { visible?: boolean }): React.ReactElement => {
    const vm = useMockedViewModel(
        { ts: "12:34", tsSentAt: "Tuesday, 4 August 2026 at 12:34", inhibitTooltip: true },
        {},
    );
    return (
        <span className={className} data-story-boundary={storyBoundary}>
            {visible && <MessageTimestampView vm={vm} />}
        </span>
    );
};
export const StoryBody = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <div className={classNames(styles.body, className)} data-story-boundary={storyBoundary}>
        <div>Here is a realistic event tile body with enough text to show the available width.</div>
        <div>This second line makes wrapping and vertical rhythm visible in Storybook.</div>
    </div>
);
export const StoryReplyChain = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <blockquote className={classNames(styles.replyChain, className)} data-story-boundary={storyBoundary}>
        <span className={styles.replyAuthor}>Taylor Example</span>
        <span>Earlier message quoted in this reply.</span>
    </blockquote>
);
export const StoryActionBar = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => {
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
    return (
        <div className={className} data-story-boundary={storyBoundary}>
            <ActionBarView vm={vm} />
        </div>
    );
};

const useStoryReactionTooltipVm = (caption: string): ReactionsRowButtonTooltipViewModel =>
    useMockedViewModel({ formattedSenders: "Alice Example and Bob Example", caption }, {});

export const StoryFooter = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => {
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
            content: "👍",
            count: 2,
            isSelected: false,
            "aria-label": "Thumbs up, 2 reactions",
            tooltipVm: useStoryReactionTooltipVm("Thumbs up"),
        },
        { onClick: fn() },
    );
    const heartVm = useMockedViewModel(
        {
            content: "❤️",
            count: 1,
            isSelected: true,
            "aria-label": "Red heart, 1 reaction",
            tooltipVm: useStoryReactionTooltipVm("Red heart"),
        },
        { onClick: fn() },
    );
    return (
        <div className={classNames(styles.footer, className)} data-story-boundary={storyBoundary}>
            <ReactionsRowView vm={vm} className={styles.storyReactions}>
                <ReactionsRowButtonView vm={thumbsUpVm} />
                <ReactionsRowButtonView vm={heartVm} />
            </ReactionsRowView>
        </div>
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

export const StoryThreadInfo = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => {
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

    return <ThreadSummaryView vm={threadSummaryVm} className={className} data-story-boundary={storyBoundary} />;
};
export const StoryReceipt = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <span
        className={classNames(styles.receipt, className)}
        data-story-boundary={storyBoundary}
    >
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
export const StoryPadlock = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <span className={styles.storyBoundaryHost} data-story-boundary={storyBoundary}>
        <E2ePadlock icon={E2ePadlockIcon.Normal} title="End-to-end encrypted" className={className} />
    </span>
);
export const StoryContextMenu = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <span className={classNames(styles.contextMenu, className)} data-story-boundary={storyBoundary}>
        ⋯
    </span>
);

export const TimelineStoryFrame = ({
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

export const roomSlots: EventTileViewProps["slots"] = {
    sender: <Slot name="sender" as="div"><StorySender /></Slot>,
    avatar: <Slot name="avatar"><StoryAvatar /></Slot>,
    body: <Slot name="body" as="div"><StoryBody /></Slot>,
    timestamp: <Slot name="timestamp"><StoryTimestamp /></Slot>,
    padlock: <Slot name="padlock"><StoryPadlock /></Slot>,
    replyChain: <Slot name="replyChain" as="div"><StoryReplyChain /></Slot>,
    actionBar: <Slot name="actionBar" as="div"><StoryActionBar /></Slot>,
    footer: <Slot name="footer" as="div"><StoryFooter /></Slot>,
    threadInfo: <Slot name="threadInfo" as="div"><StoryThreadInfo /></Slot>,
    receipt: <Slot name="receipt"><StoryReceipt /></Slot>,
    contextMenu: <Slot name="contextMenu"><StoryContextMenu /></Slot>,
};

export type EventTileStoryProps = Omit<EventTileViewProps, "root"> & {
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
        const timestamp =
            layout === "irc" || showTimestamp ? (
                <Slot name="timestamp">
                    <StoryTimestamp visible={showTimestamp} />
                </Slot>
            ) : undefined;
        const showSenderAndAvatar = layout === "irc" || !tileState.continuation;
        const sender = showSenderAndAvatar ? (
            <Slot name="sender" as="div">
                <StorySender
                    name={isOwnEvent ? "Alice" : "Bob"}
                    id={isOwnEvent ? "@alice:example.org" : "@bob:example.org"}
                    className={layout === "irc" ? styles.ircSender : undefined}
                />
            </Slot>
        ) : undefined;

        const slots =
            shape === "Room"
                ? {
                      // Keep Bob's boundary examples as plain text events.
                      ...(isOwnEvent ? props.slots : { body: props.slots.body }),
                      sender,
                      avatar: showSenderAndAvatar ? (
                          <Slot name="avatar">
                              <StoryAvatar label={isOwnEvent ? "A" : "B"} size={layout === "irc" ? "14px" : "30px"} />
                          </Slot>
                      ) : undefined,
                      timestamp,
                      actionBar: showActionBar ? props.slots?.actionBar : undefined,
                  }
                : { ...props.slots, actionBar: showActionBar ? props.slots?.actionBar : undefined };

        return (
            <EventTileView
                key={suffix}
                {...props}
                classNames={{
                    ...props.classNames,
                    root: classNames(props.classNames?.root, "storyEventTile", styles.storyEventTile),
                    line: classNames(props.classNames?.line, "storyEventLine"),
                }}
                slots={slots}
                root={{
                    ...baseRoot,
                    id: `${baseRoot.id}-${suffix}`,
                    scrollToken: `${baseRoot.scrollToken}-${suffix}`,
                    data: { ...baseRoot.data, eventId: `${baseRoot.data.eventId}-${suffix}`, layout, shape, isOwnEvent },
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

export const EventTileViewStory = withViewDocs(EventTileViewStoryImpl, EventTileView);

export const eventTileStoryDefaults = {
    classNames: { details: styles.detailsContainer, line: styles.line },
    onClick: fn(),
    onContextMenu: fn(),
    onPermalinkClick: fn(),
    onPermalinkContextMenu: fn(),
    slots: roomSlots,
};
