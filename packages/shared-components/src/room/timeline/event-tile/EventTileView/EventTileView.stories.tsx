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
import { ThreadsIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { useMockedViewModel } from "../../../../core/viewmodel";
import { MemberAvatarView, type MemberAvatarViewSnapshot } from "../../../../core/MemberAvatar/MemberAvatarView";
import {
    EventPresentationProvider,
    useEventPresentation,
    type EventDensity,
    type EventLayout,
} from "../../EventPresentation";
import { withViewDocs } from "../../../../../.storybook/withViewDocs";
import {
    NotificationBadgeView,
    type NotificationBadgeViewSnapshot,
} from "../../../../notifications/NotificationBadgeView";
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
    FileBodyView,
    FileBodyViewInfoIcon,
    FileBodyViewState,
    type FileBodyViewSnapshot,
} from "../body/MFileBodyView";
import {
    DecryptionFailureBodyView,
    DecryptionFailureReason,
    type DecryptionFailureBodyViewSnapshot,
} from "../body/DecryptionFailureBodyView";
import { EventContentBodyView, type EventContentBodyViewSnapshot } from "../body/EventContentBodyView";
import { TextualBodyView, TextualBodyViewKind, type TextualBodyViewSnapshot } from "../body/TextualBodyView";
import {
    ThreadSummaryView,
    ThreadMessagePreviewView,
    type ThreadMessagePreviewViewSnapshot,
} from "./ThreadSummary/ThreadSummaryView";
import { EventPreviewView, type EventPreviewViewSnapshot } from "./EventPreviewView";
import { PinnedMessageBadge } from "./PinnedMessageBadge";
import { TextualEventView, type TextualEventViewSnapshot } from "./TextualEventView";
import { RoomAvatarView, type RoomAvatarViewSnapshot } from "../../../avatar/RoomAvatar/RoomAvatarView";
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

type StoryMemberAvatarProps = {
    label?: string;
    size?: string;
    className?: string;
};

const StoryMemberAvatar = ({ label = "A", size = "30px", className }: StoryMemberAvatarProps): React.ReactElement => {
    const snapshot: MemberAvatarViewSnapshot = {
        id: `@${label.toLowerCase()}:example.org`,
        name: getStoryMemberAvatarName(label),
        size,
    };
    const vm = useMockedViewModel(snapshot, {});

    return <MemberAvatarView vm={vm} classNames={className} />;
};

const StoryRoomAvatar = ({ size = "30px", className }: StoryMemberAvatarProps): React.ReactElement => {
    const snapshot: RoomAvatarViewSnapshot = {
        idName: "!story-room:example.org",
        name: "Story room",
        size,
        urls: [],
        type: "round",
        isClickable: false,
        className,
        altText: "Story room avatar",
    };
    const vm = useMockedViewModel(snapshot, { onClick: fn() });

    return <RoomAvatarView vm={vm} />;
};

function getStoryMemberAvatarName(label: string): string {
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
    layout: EventLayout,
    showSenderAndAvatar: boolean,
): React.ReactElement | undefined => {
    if (!showSenderAndAvatar) return undefined;

    const name = isOwnEvent ? "Alice" : "Bob";
    const id = isOwnEvent ? "@alice:example.org" : "@bob:example.org";
    return <StorySender name={name} id={id} />;
};

const createStoryAvatar = (
    isOwnEvent: boolean,
    layout: EventLayout,
    showSenderAndAvatar: boolean,
    sizeOverride?: string,
): React.ReactElement | undefined => {
    if (!showSenderAndAvatar) return undefined;

    const label = isOwnEvent ? "A" : "B";
    const size = sizeOverride ?? (layout === "irc" ? "14px" : "30px");
    return <StoryMemberAvatar label={label} size={size} />;
};

const StoryTimestamp = ({
    className,
    visible = true,
    linked = false,
}: {
    className?: string;
    visible?: boolean;
    linked?: boolean;
}): React.ReactElement | null => {
    const vm = useMockedViewModel(
        {
            ts: "12:34",
            tsSentAt: "Tuesday, 4 August 2026 at 12:34",
            inhibitTooltip: true,
            href: linked ? "https://example.org/event-tile-story" : undefined,
        },
        linked ? { onClick: fn(), onContextMenu: fn() } : {},
    );
    return visible ? <MessageTimestampView vm={vm} className={className} /> : null;
};
const StoryLinkedTimestamp = (): React.ReactElement => <StoryTimestamp linked />;
const StoryBody = (): React.ReactElement => {
    const contentSnapshot: EventContentBodyViewSnapshot = {
        body: [
            <div key="first-line">
                Here is a realistic event tile body with enough text to show the available width.
            </div>,
            <div key="second-line">This second line makes wrapping and vertical rhythm visible in Storybook.</div>,
        ],
        className: styles.body,
    };
    const contentVm = useMockedViewModel(contentSnapshot, {});
    const bodySnapshot: TextualBodyViewSnapshot = { kind: TextualBodyViewKind.TEXT };
    const bodyVm = useMockedViewModel(bodySnapshot, {});

    return <TextualBodyView vm={bodyVm} body={<EventContentBodyView vm={contentVm} as="div" />} />;
};
const StoryPreviewBody = (): React.ReactElement => {
    const snapshot: EventPreviewViewSnapshot = {
        isVisible: true,
        previewContent: "Can you review the draft?",
        previewTooltip: "Can you review the draft?",
    };
    const vm = useMockedViewModel(snapshot, {});
    return <EventPreviewView vm={vm} />;
};
const StorySearchBody = (): React.ReactElement => {
    const contentSnapshot: EventContentBodyViewSnapshot = {
        body: [
            <div key="first-line">
                Can you review the <mark>draft</mark> before the meeting?
            </div>,
            <div key="second-line">The highlighted term represents the matching search result.</div>,
        ],
        className: styles.body,
    };
    const contentVm = useMockedViewModel(contentSnapshot, {});
    const bodyVm = useMockedViewModel({ kind: TextualBodyViewKind.TEXT } satisfies TextualBodyViewSnapshot, {});
    return <TextualBodyView vm={bodyVm} body={<EventContentBodyView vm={contentVm} as="div" />} />;
};
const StoryFileBody = (): React.ReactElement => {
    const snapshot: FileBodyViewSnapshot = {
        state: FileBodyViewState.UNENCRYPTED,
        showInfo: true,
        infoLabel: "spec.pdf",
        infoTooltip: "spec.pdf (22 KB)",
        infoIcon: FileBodyViewInfoIcon.ATTACHMENT,
        infoHref: "https://example.org/spec.pdf",
        showDownload: true,
        downloadLabel: "Download file",
        downloadTitle: "Download spec.pdf",
        downloadHref: "https://example.org/download/spec.pdf",
    };
    const vm = useMockedViewModel(snapshot, {});
    return <FileBodyView vm={vm} />;
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
const StoryHighlightedBody = (): React.ReactElement => {
    const contentSnapshot: EventContentBodyViewSnapshot = {
        body: "Message with a highlighted word.",
        formattedBody: 'Message with a <span class="mx_EventTile_searchHighlight">highlighted</span> word.',
        className: styles.body,
    };
    const contentVm = useMockedViewModel(contentSnapshot, {});
    const bodyVm = useMockedViewModel({ kind: TextualBodyViewKind.TEXT }, {});

    return <TextualBodyView vm={bodyVm} body={<EventContentBodyView vm={contentVm} as="div" />} />;
};
const StoryEditedBody = (): React.ReactElement => {
    const contentSnapshot: EventContentBodyViewSnapshot = {
        body: "This message is currently being edited.",
        className: styles.body,
    };
    const contentVm = useMockedViewModel(contentSnapshot, {});
    const bodyVm = useMockedViewModel(
        {
            kind: TextualBodyViewKind.TEXT,
            showEditedMarker: true,
            editedMarkerText: "(edited)",
            editedMarkerAriaLabel: "Edited",
            editedMarkerTooltip: "This message was edited",
        },
        { onEditedMarkerClick: fn() },
    );

    return <TextualBodyView vm={bodyVm} body={<EventContentBodyView vm={contentVm} as="div" />} />;
};
const StoryEmoteBody = (): React.ReactElement => {
    const contentSnapshot: EventContentBodyViewSnapshot = {
        body: "waves hello to the room",
        className: styles.body,
    };
    const contentVm = useMockedViewModel(contentSnapshot, {});
    const bodyVm = useMockedViewModel(
        { kind: TextualBodyViewKind.EMOTE, emoteSenderName: "Bob" },
        { onEmoteSenderClick: fn() },
    );

    return <TextualBodyView vm={bodyVm} body={<EventContentBodyView vm={contentVm} as="div" />} />;
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
const StoryStickerBody = (): React.ReactElement => {
    const snapshot: ImageBodyViewSnapshot = {
        state: ImageBodyViewState.READY,
        alt: "Example sticker",
        src: storyMediaSrc,
        thumbnailSrc: storyMediaSrc,
        maxWidth: 240,
        maxHeight: 240,
        aspectRatio: "1 / 1",
    };
    const vm = useMockedViewModel(snapshot, {});
    return <ImageBodyView vm={vm} />;
};
const StoryDecryptionFailureBody = (): React.ReactElement => {
    const snapshot: DecryptionFailureBodyViewSnapshot = {
        decryptionFailureReason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
        isLocalDeviceVerified: true,
    };
    const vm = useMockedViewModel(snapshot, {});
    return <DecryptionFailureBodyView vm={vm} />;
};
const StoryDecryptionFailurePadlock = (): React.ReactElement => (
    <E2ePadlock icon={E2ePadlockIcon.DecryptionFailure} title="Unable to decrypt" />
);
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
const StoryActionBar = ({ isPinned = false }: { isPinned?: boolean } = {}): React.ReactElement | null => {
    const vm = useMockedViewModel(
        {
            actions: [ActionBarAction.React, ActionBarAction.Reply, ActionBarAction.Options],
            presentation: "icon" as const,
            isDownloadEncrypted: false,
            isDownloadLoading: false,
            isPinned,
            isQuoteExpanded: false,
            isThreadReplyAllowed: true,
        },
        { onReactionsClick: fn(), onReplyClick: fn(), onOptionsClick: fn() },
    );
    return <ActionBarView vm={vm} />;
};
const StoryPinnedActionBar = (): React.ReactElement => <StoryActionBar isPinned />;
const StoryThreadListActionBar = (): React.ReactElement => {
    const vm = useMockedViewModel(
        {
            actions: [ActionBarAction.ViewInRoom, ActionBarAction.CopyLink],
            presentation: "icon" as const,
            isDownloadEncrypted: false,
            isDownloadLoading: false,
            isPinned: false,
            isQuoteExpanded: false,
            isThreadReplyAllowed: false,
        },
        { onViewInRoomClick: fn(), onCopyLinkClick: fn() },
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
const StoryPinnedFooter = (): React.ReactElement => (
    <div className={styles.pinnedFooter}>
        <PinnedMessageBadge />
        <StoryFooter />
    </div>
);
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
    const previewVm = useMockedViewModel({ ...storyThreadPreview, showDisplayName: false }, {});

    return (
        <div className={styles.threadListInfo}>
            <ThreadsIcon className={styles.threadListIcon} />
            <span className={styles.threadListReplies}>3</span>
            <ThreadMessagePreviewView vm={previewVm} />
        </div>
    );
};
const StorySearchThreadInfo = (): React.ReactElement => (
    <a className={styles.searchThreadInfo} href="https://example.org/event-tile-story/thread">
        <ThreadsIcon />
        View in thread
    </a>
);
const StoryReceipt = ({ empty = false }: { empty?: boolean }): React.ReactElement => (
    <span className={styles.receipt}>
        <span className={styles.readReceiptGroup}>
            {empty ? (
                <span className={styles.readReceiptButton} aria-hidden="true">
                    <span className={styles.readReceiptContainer} />
                </span>
            ) : (
                <button type="button" className={styles.readReceiptButton} aria-label="Read by Alex and Taylor">
                    <span className={styles.readReceiptContainer} aria-hidden="true">
                        <span className={styles.receiptAvatar}>T</span>
                        <span className={styles.receiptAvatar}>A</span>
                    </span>
                </button>
            )}
        </span>
    </span>
);
const StoryPadlock = (): React.ReactElement => <E2ePadlock icon={E2ePadlockIcon.Normal} title="End-to-end encrypted" />;
const StoryContextMenu = (): React.ReactElement => <span className={styles.contextMenu}>⋯</span>;

const TimelineStoryFrame = ({
    density,
    layout,
    shape,
    rightPanel = false,
    presentationNotice,
    children,
}: React.PropsWithChildren<{
    density: string;
    layout: string;
    shape: EventTileViewProps["root"]["shape"];
    rightPanel?: boolean;
    presentationNotice?: StoryPresentationResolution["notice"];
}>): React.ReactElement => {
    const storyContext = !rightPanel
        ? "RoomView"
        : shape === "Card"
          ? "TimelineCard"
          : shape === "Notification"
            ? "NotificationPanel"
            : shape === "Pinned"
              ? "PinnedMessagesCard"
              : shape === "File"
                ? "FilePanel"
                : shape === "ThreadsList"
                  ? "ThreadPanel"
                  : "ThreadView";
    const messageListBoundary = shape === "Pinned" ? "PinnedMessagesCard.wrapper" : `${storyContext}.MessageList`;
    const storySurfaceClassName = classNames(styles.storySurface, {
        [styles.storyRightPanel]: rightPanel,
        [styles.storyPinnedPanel]: shape === "Pinned",
        [styles.storyFilePanel]: shape === "File",
        [styles.storyThreadsListPanel]: shape === "ThreadsList",
        [styles.storyThreadPanel]: shape === "Thread",
    });

    return (
        <StoryDebugFrame>
            {presentationNotice && (
                <div
                    className={classNames(styles.presentationNotice, {
                        [styles.presentationNoticeInvalid]: presentationNotice.invalid,
                    })}
                    role="status"
                >
                    {presentationNotice.text}
                </div>
            )}
            <div className={storySurfaceClassName} data-story-boundary="Timeline">
                <div
                    className={styles.timeline}
                    data-story-boundary={`${storyContext}.timeline`}
                    data-event-layout={layout}
                >
                    <div className={styles.scrollPanel} data-story-boundary="ScrollPanel">
                        <div className={styles.messageListWrapper} data-story-boundary="messageListWrapper">
                            <ol
                                className={styles.messageList}
                                data-story-boundary={messageListBoundary}
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
};

const baseRoot: EventTileViewProps["root"] = {
    id: "event-tile-story-line",
    ariaLive: "off",
    scrollToken: "event-tile-story",
    permalink: "https://example.org/event-tile-story",
    eventId: "$event-tile-story",
    shape: "Room",
    state: { isOwnEvent: false, hasReply: false },
};

const roomSlots: EventTileViewProps["slots"] = {
    sender: <StorySender />,
    avatar: <StoryMemberAvatar />,
    body: <StoryBody />,
    timestamp: <StoryTimestamp />,
    padlock: <StoryPadlock />,
    actionBar: <StoryActionBar />,
    footer: <StoryFooter />,
    threadInfo: <StoryThreadInfo />,
    receipt: <StoryReceipt />,
    contextMenu: <StoryContextMenu />,
};

/** Slots for the default Room-like shapes without a context menu fixture. */
const defaultShapeSlots: EventTileViewProps["slots"] = {
    sender: <StorySender />,
    avatar: <StoryMemberAvatar />,
    body: <StoryBody />,
    timestamp: <StoryLinkedTimestamp />,
    padlock: <StoryPadlock />,
    actionBar: <StoryActionBar />,
    footer: <StoryFooter />,
    threadInfo: <StoryThreadInfo />,
    receipt: <StoryReceipt />,
};

const threadSlots: EventTileViewProps["slots"] = {
    ...defaultShapeSlots,
    avatar: <StoryMemberAvatar size="32px" />,
    threadInfo: undefined,
};

type EventTileStoryProps = Omit<EventTileViewProps, "root"> & {
    shape: EventTileViewProps["root"]["shape"];
    state?: Partial<EventTileViewProps["root"]["state"]>;
    roomMessages?: "boundaries" | "alice" | "bob";
};

type StoryPresentation = {
    layout: EventLayout;
    density: EventDensity;
};

type StoryPresentationPolicy = {
    host: string;
    allowedLayouts: readonly EventLayout[];
    fixedLayout?: EventLayout;
    fixedDensity?: EventDensity;
    usesSharedPresentation: boolean;
};

type StoryPresentationResolution = {
    requested: StoryPresentation;
    effective: StoryPresentation;
    notice?: {
        invalid: boolean;
        text: string;
    };
};

const allEventLayouts: readonly EventLayout[] = ["group", "bubble", "irc"];

const storyPresentationPolicies: Partial<Record<EventTileViewProps["root"]["shape"], StoryPresentationPolicy>> = {
    Card: {
        host: "TimelineCard",
        allowedLayouts: ["group", "bubble"],
        usesSharedPresentation: true,
    },
    Notification: {
        host: "NotificationPanel",
        allowedLayouts: ["group"],
        fixedLayout: "group",
        usesSharedPresentation: true,
    },
    Pinned: {
        host: "PinnedMessagesCard",
        allowedLayouts: ["group"],
        fixedLayout: "group",
        fixedDensity: "default",
        usesSharedPresentation: false,
    },
    File: {
        host: "FilePanel",
        allowedLayouts: ["group"],
        fixedLayout: "group",
        usesSharedPresentation: true,
    },
    ThreadsList: {
        host: "ThreadPanel",
        allowedLayouts: ["group"],
        fixedLayout: "group",
        usesSharedPresentation: true,
    },
    Thread: {
        host: "ThreadView",
        allowedLayouts: ["group", "bubble"],
        usesSharedPresentation: true,
    },
};

const formatPresentation = ({ layout, density }: StoryPresentation): string =>
    `${layout === "group" ? "Group" : layout === "bubble" ? "Bubble" : "IRC"} / ${
        density === "compact" ? "Compact" : "Default"
    }`;

const resolveStoryPresentation = (
    shape: EventTileViewProps["root"]["shape"],
    requested: StoryPresentation,
): StoryPresentationResolution => {
    const policy = storyPresentationPolicies[shape] ?? {
        host: "RoomView",
        allowedLayouts: allEventLayouts,
        usesSharedPresentation: true,
    };
    const effectiveLayout =
        policy.fixedLayout ?? (policy.allowedLayouts.includes(requested.layout) ? requested.layout : "group");
    const effectiveDensity =
        policy.fixedDensity ??
        (requested.density === "default" || effectiveLayout === "group" ? requested.density : "default");
    const effective = { layout: effectiveLayout, density: effectiveDensity };
    const invalid = effective.layout !== requested.layout || effective.density !== requested.density;
    const unsupportedStory = !policy.usesSharedPresentation;

    if (!invalid && !unsupportedStory) {
        return { requested, effective };
    }

    const constraints = policy.fixedLayout
        ? `fixes the shape to ${shape} and the layout to Group`
        : `renders the ${shape} shape and supports ${policy.allowedLayouts.map((layout) => formatPresentation({ layout, density: "default" }).split(" /")[0]).join(" or ")} layout`;
    const densityConstraint = policy.fixedDensity
        ? " and Default density"
        : "; Compact density is available only with Group layout";
    const sourceConstraint = policy.usesSharedPresentation
        ? ""
        : " The application currently renders this panel with PinnedEventTile";
    const prefix = invalid ? "Unsupported presentation." : "Unsupported story.";
    const rendered = invalid
        ? ` Requested: ${formatPresentation(requested)} · Rendered: ${formatPresentation(effective)}.`
        : ` Requested and rendered: ${formatPresentation(effective)}.`;

    return {
        requested,
        effective,
        notice: {
            invalid: true,
            text: `${prefix} ${policy.host} ${constraints}${densityConstraint}.${sourceConstraint}${rendered}`,
        },
    };
};

const createStoryTimestamp = (
    layout: EventLayout,
    isLast: boolean,
    showActionBar: boolean,
): React.ReactElement | undefined => {
    const showTimestamp = layout === "irc" || isLast || showActionBar;
    return showTimestamp ? <StoryTimestamp visible={showTimestamp} linked /> : undefined;
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
    const baseSlots = isOwnEvent
        ? slots
        : {
              body: slots.body,
              // The application keeps an empty receipt group mounted on every event
              // while read receipts are enabled, even when this event has no receipts.
              receipt: slots.receipt ? <StoryReceipt empty /> : undefined,
          };
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
    const requestedPresentation = useEventPresentation();
    const presentation = resolveStoryPresentation(shape, requestedPresentation);
    const { layout, density } = presentation.effective;
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
        const sender = createStorySender(
            isOwnEvent,
            layout,
            showSenderAndAvatar && !tileState.noSender && !tileState.info,
        );
        const avatar = createStoryAvatar(isOwnEvent, layout, showSenderAndAvatar, tileState.info ? "14px" : undefined);
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

    const tiles = shape === "Pinned" ? null : shape === "Room" ? renderRoomTiles() : renderTile(false, "event");

    const rightPanel =
        shape === "Card" ||
        shape === "Notification" ||
        shape === "Pinned" ||
        shape === "File" ||
        shape === "ThreadsList" ||
        shape === "Thread";

    return (
        <EventPresentationProvider value={presentation.effective}>
            <TimelineStoryFrame
                density={density}
                layout={layout}
                shape={shape}
                rightPanel={rightPanel}
                presentationNotice={presentation.notice}
            >
                {tiles}
            </TimelineStoryFrame>
        </EventPresentationProvider>
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
    StoryDecryptionFailurePadlock,
    StoryEditedBody,
    StoryEmoteBody,
    StoryHighlightedBody,
    StoryInformationalBody,
    StoryLinkedTimestamp,
    StoryMediaBody,
    StoryReplyChain,
    StoryStickerBody,
};

const meta = {
    title: "Timeline/EventTileView/Shapes",
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
            avatar: <StoryMemberAvatar size="32px" />,
            body: <StoryPreviewBody />,
            timestamp: <StoryTimestamp />,
            notificationBadge: <StoryNotificationBadge />,
            threadInfo: <StoryThreadListInfo />,
            actionBar: <StoryThreadListActionBar />,
        },
    },
};

export const Thread: Story = {
    tags: interactiveTags,
    args: {
        shape: "Thread",
        slots: threadSlots,
    },
};

export const Card: Story = {
    tags: interactiveTags,
    args: {
        shape: "Card",
        slots: defaultShapeSlots,
    },
};

export const Notification: Story = {
    tags: interactiveTags,
    args: {
        shape: "Notification",
        slots: {
            sender: <StorySender />,
            body: <StoryPreviewBody />,
            timestamp: <StoryTimestamp />,
            roomAvatar: <StoryRoomAvatar size="28px" />,
            notificationRoomLabel: (
                <span className={styles.roomLabel}>
                    {" in "}
                    <strong>Example room</strong>
                </span>
            ),
            notificationBadge: <StoryNotificationBadge />,
            threadInfo: <StoryThreadListInfo />,
        },
    },
};

export const File: Story = {
    tags: interactiveTags,
    args: {
        shape: "File",
        slots: {
            sender: <StorySender />,
            avatar: <StoryMemberAvatar size="20px" />,
            timestamp: <StoryLinkedTimestamp />,
            body: <StoryFileBody />,
        },
    },
};

export const Search: Story = {
    tags: interactiveTags,
    args: {
        shape: "Search",
        slots: {
            ...defaultShapeSlots,
            body: <StorySearchBody />,
            threadInfo: <StorySearchThreadInfo />,
        },
    },
};

export const Pinned: Story = {
    tags: interactiveTags,
    args: {
        shape: "Pinned",
        slots: {
            ...defaultShapeSlots,
            actionBar: <StoryPinnedActionBar />,
            footer: <StoryPinnedFooter />,
        },
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

export const CardGroupDefault: Story = {
    name: "Card - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: Card.args,
};

export const CardBubbleDefault: Story = {
    name: "Card - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: Card.args,
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
