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
import { NotificationBadgeView, type NotificationBadgeViewSnapshot } from "../../../../notifications/NotificationBadgeView";
import { EventTileView, type EventTileViewProps } from "./index";
import { E2ePadlock, E2ePadlockIcon } from "./E2ePadlock";
import { DisambiguatedProfileView } from "./DisambiguatedProfile";
import { ActionBarAction, ActionBarView } from "../actions/ActionBarView";
import { MessageTimestampView } from "../timestamp/MessageTimestampView";
import { ReactionsRowView } from "../reactions/ReactionsRow";
import { ReactionsRowButtonView } from "../reactions/ReactionsRowButton";
import { type ReactionsRowButtonTooltipViewModel } from "../reactions/ReactionsRowButtonTooltip";
import { ImageBodyView, ImageBodyViewState, type ImageBodyViewSnapshot } from "../body/MImageBodyView";
import {
    DecryptionFailureBodyView,
    DecryptionFailureReason,
    type DecryptionFailureBodyViewSnapshot,
} from "../body/DecryptionFailureBodyView";
import {
    EventContentBodyView,
    type EventContentBodyViewSnapshot,
} from "../body/EventContentBodyView";
import { TextualBodyView, TextualBodyViewKind, type TextualBodyViewSnapshot } from "../body/TextualBodyView";
import {
    ThreadSummaryView,
    ThreadMessagePreviewView,
    type ThreadMessagePreviewViewSnapshot,
} from "./ThreadSummary/ThreadSummaryView";
import { TextualEventView, type TextualEventViewSnapshot } from "./TextualEventView";
import styles from "./EventTileView.stories.module.css";
import storyMediaSrc from "../../../../../static/image-body/install-spinner.png";

type StoryBoundary = HTMLElement;
const eventTileSlotTestIdPrefix = "event-tile-slot-";

const getBoundaryLabel = (boundary: StoryBoundary): string => {
    const storyBoundary = boundary.dataset.storyBoundary;
    if (storyBoundary) return storyBoundary;

    const testId = boundary.dataset.testid;
    if (testId?.startsWith(eventTileSlotTestIdPrefix)) {
        return `EventTileView.slots.${testId.slice(eventTileSlotTestIdPrefix.length)}`;
    }

    if (boundary.classList.contains("storyEventTile")) return "EventTileView";
    return "EventTileView.line";
};

const getBoundary = (target: EventTarget | null, root: HTMLElement): StoryBoundary | null => {
    if (!(target instanceof HTMLElement)) return null;

    const boundary = target.closest<StoryBoundary>(
        `[data-story-boundary], [data-testid^="${eventTileSlotTestIdPrefix}"], .storyEventTile, .storyEventLine`,
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
            {activeBoundary && <output className={styles.debugTooltip}>{getBoundaryLabel(activeBoundary)}</output>}
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
        name={getStoryAvatarName(room, label)}
        type="round"
        size={size}
        className={className}
        aria-label={room ? "Story room avatar" : `${label} avatar`}
    />
);

function getStoryAvatarName(room: boolean, label: string): string {
    if (room) return "Story room";
    if (label === "A") return "Alice Example";
    return "Bob Example";
}

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

const createStorySender = (
    isOwnEvent: boolean,
    layout: EventTileViewProps["root"]["layout"],
    showSenderAndAvatar: boolean,
): React.ReactElement | undefined => {
    if (!showSenderAndAvatar) return undefined;

    const name = isOwnEvent ? "Alice" : "Bob";
    const id = isOwnEvent ? "@alice:example.org" : "@bob:example.org";
    const className = layout === "irc" ? styles.ircSender : undefined;
    return <StorySender name={name} id={id} className={className} />;
};

const createStoryAvatar = (
    isOwnEvent: boolean,
    layout: EventTileViewProps["root"]["layout"],
    showSenderAndAvatar: boolean,
): React.ReactElement | undefined => {
    if (!showSenderAndAvatar) return undefined;

    const label = isOwnEvent ? "A" : "B";
    const size = layout === "irc" ? "14px" : "30px";
    return <StoryAvatar label={label} size={size} />;
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
const StoryBody = (): React.ReactElement => {
    const contentSnapshot: EventContentBodyViewSnapshot = {
        body: [
            <div key="first-line">Here is a realistic event tile body with enough text to show the available width.</div>,
            <div key="second-line">This second line makes wrapping and vertical rhythm visible in Storybook.</div>,
        ],
        className: styles.body,
    };
    const contentVm = useMockedViewModel(contentSnapshot, {});
    const bodySnapshot: TextualBodyViewSnapshot = { kind: TextualBodyViewKind.TEXT };
    const bodyVm = useMockedViewModel(bodySnapshot, {});

    return <TextualBodyView vm={bodyVm} body={<EventContentBodyView vm={contentVm} as="div" />} />;
};
const StoryInformationalBody = (): React.ReactElement => {
    const snapshot: TextualEventViewSnapshot = {
        content: (
            <>
                <div>Alex changed the room name to Example room.</div>
                <div>This informational event demonstrates the shared textual event styling.</div>
            </>
        ),
    };
    const vm = useMockedViewModel(snapshot, {});
    return <TextualEventView vm={vm} />;
};
const StoryReplyChain = (): React.ReactElement => (
    <blockquote className={styles.replyChain}>
        <span className={styles.replyAuthor}>Taylor Example</span>
        <span>Earlier message quoted in this reply.</span>
    </blockquote>
);
const StoryMediaBody = (): React.ReactElement => {
    const snapshot: ImageBodyViewSnapshot = {
        state: ImageBodyViewState.READY,
        alt: "Example media",
        src: storyMediaSrc,
        thumbnailSrc: storyMediaSrc,
        maxWidth: 320,
        maxHeight: 180,
        aspectRatio: "16 / 9",
    };
    const vm = useMockedViewModel(snapshot, {});
    return <ImageBodyView vm={vm} />;
};
const StoryStickerBody = (): React.ReactElement => (
    <div className={styles.stickerBody} aria-label="Sticker placeholder">
        🌈
    </div>
);
const StoryDecryptionFailureBody = (): React.ReactElement => {
    const snapshot: DecryptionFailureBodyViewSnapshot = {
        decryptionFailureReason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
        isLocalDeviceVerified: true,
    };
    const vm = useMockedViewModel(snapshot, {});
    return <DecryptionFailureBodyView vm={vm} />;
};
const StoryNotificationBadge = (): React.ReactElement => {
    const snapshot: NotificationBadgeViewSnapshot = {
        shouldRender: true,
        isVisible: true,
        isNotification: true,
        isHighlight: false,
        isKnocked: false,
        badgeType: "dot",
        symbol: null,
        isClickable: false,
        showUnsentTooltip: false,
    };
    const vm = useMockedViewModel(snapshot, {});
    return <NotificationBadgeView vm={vm} />;
};
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
    eventId: "$event-tile-story",
    layout: "group",
    shape: "Room",
    state: { isOwnEvent: false, hasReply: false },
};

const roomSlots: EventTileViewProps["slots"] = {
    sender: <StorySender />,
    avatar: <StoryAvatar />,
    body: <StoryBody />,
    timestamp: <StoryTimestamp />,
    padlock: <StoryPadlock />,
    actionBar: <StoryActionBar />,
    footer: <StoryFooter />,
    threadInfo: <StoryThreadInfo />,
    receipt: <StoryReceipt />,
    contextMenu: <StoryContextMenu />,
};

type EventTileStoryProps = Omit<EventTileViewProps, "root"> & {
    shape: EventTileViewProps["root"]["shape"];
    state?: Partial<EventTileViewProps["root"]["state"]>;
    roomMessages?: "boundaries" | "alice" | "bob";
};

const createStoryTimestamp = (
    layout: EventTileViewProps["root"]["layout"],
    isLast: boolean,
    showActionBar: boolean,
): React.ReactElement | undefined => {
    const showTimestamp = layout === "irc" || isLast || showActionBar;
    return showTimestamp ? <StoryTimestamp visible={showTimestamp} /> : undefined;
};

const createRoomStorySlots = ({
    isOwnEvent,
    slots,
    sender,
    avatar,
    timestamp,
    showActionBar,
}: {
    isOwnEvent: boolean;
    slots: EventTileViewProps["slots"];
    sender?: React.ReactNode;
    avatar?: React.ReactNode;
    timestamp?: React.ReactNode;
    showActionBar: boolean;
}): EventTileViewProps["slots"] => {
    const baseSlots = isOwnEvent ? slots : { body: slots.body };
    return {
        ...baseSlots,
        sender,
        avatar,
        timestamp,
        actionBar: showActionBar ? slots.actionBar : undefined,
    };
};

const createPreviewStorySlots = ({
    shape,
    slots,
    showActionBar,
}: {
    shape: EventTileViewProps["root"]["shape"];
    slots: EventTileViewProps["slots"];
    showActionBar: boolean;
}): EventTileViewProps["slots"] => {
    const threadInfo = shape === "Thread" ? undefined : slots.threadInfo;
    return {
        ...slots,
        actionBar: showActionBar ? slots.actionBar : undefined,
        // The application Thread rendering branch places no thread-info slot.
        threadInfo,
    };
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
        boundaryState: Partial<EventTileViewProps["root"]["state"]> = {},
        isLast = false,
    ): React.ReactElement => {
        const tileState = { ...boundaryState, ...state };
        const interaction = tileInteractions[suffix] ?? { hovered: false, focused: false };
        const showActionBar = interaction.hovered || interaction.focused;
        const timestamp = createStoryTimestamp(layout, isLast, showActionBar);
        const showSenderAndAvatar = layout === "irc" || !tileState.continuation;
        const sender = createStorySender(isOwnEvent, layout, showSenderAndAvatar && !tileState.noSender);
        const avatar = createStoryAvatar(isOwnEvent, layout, showSenderAndAvatar);
        const slots =
            shape === "Room"
                ? createRoomStorySlots({
                      isOwnEvent,
                      slots: props.slots,
                      sender,
                      avatar,
                      timestamp,
                      showActionBar,
                  })
                : createPreviewStorySlots({ shape, slots: props.slots, showActionBar });

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
                        layout === "bubble" && styles.storyLayoutBubble,
                    ),
                    line: classNames(props.classNames?.line, "storyEventLine"),
                }}
                slots={slots}
                root={{
                    ...baseRoot,
                    id: `${baseRoot.id}-${suffix}`,
                    scrollToken: `${baseRoot.scrollToken}-${suffix}`,
                    eventId: `${baseRoot.eventId}-${suffix}`,
                    layout,
                    shape,
                    state: {
                        ...baseRoot.state,
                        ...tileState,
                        isOwnEvent,
                    },
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

    const renderRoomTiles = (): React.ReactNode => {
        if (roomMessages === "alice") {
            return renderTile(true, "alice-single", { continuation: false, lastInSection: true }, true);
        }

        if (roomMessages === "bob") {
            return renderTile(false, "bob-single", { continuation: false, lastInSection: true }, true);
        }

        return (
            <>
                {renderTile(false, "bob-first", { continuation: false, lastInSection: false })}
                {renderTile(false, "bob-middle", { continuation: true, lastInSection: false })}
                {renderTile(false, "bob-last", { continuation: true, lastInSection: true })}
                {renderTile(true, "alice-single", { continuation: false, lastInSection: true }, true)}
            </>
        );
    };

    const tiles = shape === "Room" ? renderRoomTiles() : renderTile(false, "event");

    return (
        <TimelineStoryFrame density={density} layout={layout}>
            {tiles}
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

const groupGlobals = { eventLayout: "group", eventDensity: "default" } as const;
const bubbleGlobals = {
    eventLayout: "bubble",
    eventDensity: "default",
} as const;
const ircGlobals = { eventLayout: "irc", eventDensity: "default" } as const;
const compactGroupGlobals = { eventLayout: "group", eventDensity: "compact" } as const;

const storyHelpers = {
    EventTileViewStory,
    eventTileStoryDefaults,
    bubbleGlobals,
    groupGlobals,
    ircGlobals,
    compactGroupGlobals,
    StoryDecryptionFailureBody,
    StoryInformationalBody,
    StoryMediaBody,
    StoryReplyChain,
    StoryStickerBody,
};

const meta = {
    title: "Timeline/EventTileView/Layout & Shape",
    component: EventTileViewStory,
    tags: ["autodocs"],
    render: (args) => <EventTileViewStory {...args} />,
    argTypes: {
        shape: {
            table: { disable: true },
        },
        classNames: { table: { disable: true } },
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
        ...eventTileStoryDefaults,
    },
    storyHelpers,
} satisfies Meta<typeof EventTileViewStory> & { storyHelpers: typeof storyHelpers };

export default meta;
type Story = StoryObj<typeof meta>;

const interactiveTags = ["skip-test", "!snapshot"];
const visualTags = ["!dev", "!autodocs", "snapshot"];

export const Room: Story = { tags: interactiveTags };

export const ThreadsList: Story = {
    tags: interactiveTags,
    args: {
        shape: "ThreadsList",
        slots: {
            sender: <StorySender />,
            avatar: <StoryAvatar />,
            body: <StoryBody />,
            timestamp: <StoryTimestamp />,
            notificationBadge: <StoryNotificationBadge />,
            threadInfo: <StoryThreadListInfo />,
            actionBar: <StoryActionBar />,
        },
    },
};

export const Thread: Story = {
    tags: interactiveTags,
    args: {
        shape: "Thread",
    },
};

export const Notification: Story = {
    tags: interactiveTags,
    args: {
        shape: "Notification",
        slots: {
            sender: <StorySender />,
            body: <StoryBody />,
            timestamp: <StoryTimestamp />,
            roomAvatar: <StoryAvatar room size="28px" />,
            notificationRoomLabel: <span className={styles.roomLabel}>in Example room</span>,
            notificationBadge: <StoryNotificationBadge />,
            threadInfo: <StoryThreadListInfo />,
            receipt: <StoryReceipt />,
        },
    },
};

export const File: Story = {
    tags: interactiveTags,
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

export const Search: Story = {
    tags: interactiveTags,
    args: {
        shape: "Search",
    },
};

export const Pinned: Story = {
    tags: interactiveTags,
    args: {
        shape: "Pinned",
    },
};

export const RoomGroupDefault: Story = {
    name: "Room - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: Room.args,
};

export const RoomGroupCompact: Story = {
    name: "Room - Group - Compact",
    tags: visualTags,
    globals: compactGroupGlobals,
    args: Room.args,
};

export const RoomBubbleDefault: Story = {
    name: "Room - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: Room.args,
};

export const RoomIrcDefault: Story = {
    name: "Room - IRC - Default",
    tags: visualTags,
    globals: ircGlobals,
    args: Room.args,
};

export const ThreadsListGroup: Story = {
    name: "Threads list - Group",
    tags: visualTags,
    globals: groupGlobals,
    args: ThreadsList.args,
};

export const ThreadGroup: Story = {
    name: "Thread - Group",
    tags: visualTags,
    globals: groupGlobals,
    args: Thread.args,
};

export const NotificationGroup: Story = {
    name: "Notification - Group",
    tags: visualTags,
    globals: groupGlobals,
    args: Notification.args,
};

export const FileGroup: Story = {
    name: "File - Group",
    tags: visualTags,
    globals: groupGlobals,
    args: File.args,
};

export const SearchGroup: Story = {
    name: "Search - Group",
    tags: visualTags,
    globals: groupGlobals,
    args: Search.args,
};

export const PinnedGroup: Story = {
    name: "Pinned - Group",
    tags: visualTags,
    globals: groupGlobals,
    args: Pinned.args,
};
