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
import { TextualEventView, type TextualEventViewSnapshot } from "./TextualEventView";
import bodyStyles from "../body/EventContentBodyView/EventContentBody.module.css";
import { RoomAvatarView, type RoomAvatarViewSnapshot } from "../../../avatar/RoomAvatar/RoomAvatarView";
import styles from "./EventTileView.stories.module.css";
import storyMediaSrc from "../../../../../static/image-body/install-spinner.png";

type StoryBoundary = HTMLElement;
const eventTileSlotTestIdPrefix = "event-tile-slot-";
const boundarySelector = `[data-story-boundary], [data-testid^="${eventTileSlotTestIdPrefix}"], .storyEventTile, .storyEventLine`;
const slotBoundarySelector = `[data-testid^="${eventTileSlotTestIdPrefix}"]`;

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

const getBoundaryDepth = (boundary: StoryBoundary, root: HTMLElement): number => {
    let depth = 0;
    let current: Element | null = boundary;
    while (current && current !== root) {
        depth += 1;
        current = current.parentElement;
    }
    return depth;
};

const containsPoint = (boundary: StoryBoundary, clientX: number, clientY: number): boolean => {
    const elements = [boundary, ...boundary.querySelectorAll("*")];
    return elements.some((element) =>
        Array.from(element.getClientRects()).some(
            (rect) => clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom,
        ),
    );
};

const getBoundary = (
    target: EventTarget | null,
    root: HTMLElement,
    clientX?: number,
    clientY?: number,
): StoryBoundary | null => {
    // Padlock icons are SVG elements, so hovering their path otherwise skips
    // the slot boundary and leaves the Storybook diagnostics blank.
    if (!(target instanceof Element)) return null;

    const directBoundary = target.closest<StoryBoundary>(boundarySelector);
    if (!directBoundary || !root.contains(directBoundary)) return null;

    // Prefer the slot under the pointer over a structural parent. This keeps
    // the diagnostics useful when a line overlaps a slot or when a slot uses
    // display: contents and the browser reports the line as the target.
    if (clientX !== undefined && clientY !== undefined) {
        const pointElements = root.ownerDocument.elementsFromPoint(clientX, clientY);
        for (const element of pointElements) {
            const boundary = element.closest<StoryBoundary>(slotBoundarySelector);
            if (boundary && root.contains(boundary)) return boundary;
        }

        const slotBoundary = Array.from(root.querySelectorAll<StoryBoundary>(slotBoundarySelector))
            .filter((boundary) => containsPoint(boundary, clientX, clientY))
            .sort((a, b) => getBoundaryDepth(b, root) - getBoundaryDepth(a, root))[0];
        if (slotBoundary) return slotBoundary;
    }

    return directBoundary;
};

const StoryDebugFrame = ({
    children,
    ref,
}: React.PropsWithChildren<{ ref?: React.Ref<HTMLDivElement> }>): React.ReactElement => {
    const frameRef = React.useRef<HTMLDivElement>(null);
    const activeBoundaryRef = React.useRef<StoryBoundary | null>(null);
    const [activeBoundary, setActiveBoundary] = React.useState<StoryBoundary | null>(null);

    const clearActiveBoundary = (): void => {
        activeBoundaryRef.current?.removeAttribute("data-story-hovered");
        activeBoundaryRef.current?.removeAttribute("data-story-hovered-contents");
        activeBoundaryRef.current = null;
        setActiveBoundary(null);
    };

    const updateActiveBoundary = (event: React.PointerEvent<HTMLDivElement>): void => {
        const frame = frameRef.current;
        if (!frame) return;

        const boundary = getBoundary(event.target, frame, event.clientX, event.clientY);
        if (boundary === activeBoundaryRef.current) return;

        activeBoundaryRef.current?.removeAttribute("data-story-hovered");
        activeBoundaryRef.current?.removeAttribute("data-story-hovered-contents");
        boundary?.setAttribute("data-story-hovered", "true");
        if (boundary && boundary.getClientRects().length === 0) {
            boundary.setAttribute("data-story-hovered-contents", "true");
        }
        activeBoundaryRef.current = boundary;
        setActiveBoundary(boundary);
    };

    React.useEffect(() => {
        return () => {
            activeBoundaryRef.current?.removeAttribute("data-story-hovered");
            activeBoundaryRef.current?.removeAttribute("data-story-hovered-contents");
        };
    }, []);

    const setFrameRef = (element: HTMLDivElement | null): void => {
        frameRef.current = element;
        if (typeof ref === "function") ref(element);
        else if (ref) ref.current = element;
    };

    return (
        <div
            ref={setFrameRef}
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
    if (label === "T") return "Taylor Example";
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

const createStorySender = (isOwnEvent: boolean, showSenderAndAvatar: boolean): React.ReactElement | undefined => {
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
        body: "Here is a realistic event tile body with enough text to show the available width.\nThis second line makes wrapping and vertical rhythm visible in Storybook.",
    };
    const contentVm = useMockedViewModel(contentSnapshot, {});
    const bodySnapshot: TextualBodyViewSnapshot = { kind: TextualBodyViewKind.TEXT };
    const bodyVm = useMockedViewModel(bodySnapshot, {});

    return <TextualBodyView vm={bodyVm} body={<EventContentBodyView vm={contentVm} as="div" />} />;
};
const StoryShortBody = (): React.ReactElement => {
    const contentVm = useMockedViewModel({ body: "Short text message." } satisfies EventContentBodyViewSnapshot, {});
    const bodyVm = useMockedViewModel({ kind: TextualBodyViewKind.TEXT } satisfies TextualBodyViewSnapshot, {});

    return <TextualBodyView vm={bodyVm} body={<EventContentBodyView vm={contentVm} as="div" />} />;
};
const StoryPreviewBody = (): React.ReactElement => {
    const snapshot: EventPreviewViewSnapshot = {
        isVisible: true,
        previewContent:
            "This is a deliberately long preview message with enough content to demonstrate the two-line clamp styling.",
        previewTooltip:
            "This is a deliberately long preview message with enough content to demonstrate the two-line clamp styling.",
    };
    const vm = useMockedViewModel(snapshot, {});
    return <EventPreviewView vm={vm} />;
};
const StorySearchBody = (): React.ReactElement => {
    const contentSnapshot: EventContentBodyViewSnapshot = {
        body: "Can you review the draft before the meeting?\nThe highlighted term represents the matching search result.",
        formattedBody: `Can you review the <span class="${bodyStyles.EventTile_searchHighlight}">draft</span> before the meeting?\nThe highlighted term represents the matching search result.`,
        className: styles.body,
    };
    const contentVm = useMockedViewModel(contentSnapshot, {});
    const bodyVm = useMockedViewModel({ kind: TextualBodyViewKind.TEXT } satisfies TextualBodyViewSnapshot, {});
    return <TextualBodyView vm={bodyVm} body={<EventContentBodyView vm={contentVm} as="div" />} />;
};
const StorySearchContextBody = ({ body }: { body: string }): React.ReactElement => {
    const contentVm = useMockedViewModel({ body, className: styles.body } satisfies EventContentBodyViewSnapshot, {});
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
const StoryInformationalBody = ({
    children = "Alex changed the room name.",
}: React.PropsWithChildren): React.ReactElement => {
    const snapshot: TextualEventViewSnapshot = {
        content: <div>{children}</div>,
    };
    const vm = useMockedViewModel(snapshot, {});
    return <TextualEventView vm={vm} />;
};
const StoryCallStartedBody = (): React.ReactElement => (
    <StoryInformationalBody>Alex started a voice call.</StoryInformationalBody>
);
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
const StoryMessageComposer = (): React.ReactElement => (
    <div className={styles.messageComposer} role="group" aria-label="Message composer">
        <div
            className={styles.messageComposerInput}
            role="textbox"
            aria-label="Edit message"
            contentEditable
            suppressContentEditableWarning
        >
            This message is currently being edited.
        </div>
        <div className={styles.messageComposerActions}>
            <span>Editing message</span>
            <button type="button">Save</button>
            <button type="button">Cancel</button>
        </div>
    </div>
);
const StoryEditedMessageBody = (): React.ReactElement => {
    const contentSnapshot: EventContentBodyViewSnapshot = {
        body: "This message was edited.",
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
const storyMediaSizes = {
    small: { label: "Small", maxWidth: 1, maxHeight: 1, aspectRatio: "1 / 1" },
    medium: { label: "Medium", maxWidth: 320, maxHeight: 180, aspectRatio: "16 / 9" },
    large: { label: "Large", maxWidth: 800, maxHeight: 600, aspectRatio: "4 / 3" },
} as const;

type StoryMediaSize = keyof typeof storyMediaSizes;

const StoryMediaImage = ({
    label,
    maxWidth,
    maxHeight,
    aspectRatio,
}: Pick<ImageBodyViewSnapshot, "maxWidth" | "maxHeight" | "aspectRatio"> & { label: string }): React.ReactElement => {
    const snapshot: ImageBodyViewSnapshot = {
        state: ImageBodyViewState.READY,
        alt: `${label} example media`,
        src: storyMediaSrc,
        thumbnailSrc: storyMediaSrc,
        maxWidth,
        maxHeight,
        aspectRatio,
    };
    const vm = useMockedViewModel(snapshot, {});
    return <ImageBodyView vm={vm} />;
};
const StoryMediaBody = ({ size = "medium" }: { size?: StoryMediaSize }): React.ReactElement => (
    <StoryMediaImage {...storyMediaSizes[size]} />
);
const StoryStickerBody = (): React.ReactElement => (
    <div className={styles.stickerBody} role="img" aria-label="Example sticker">
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

const StoryNarrowContext = React.createContext(false);

const StoryThreadInfo = (): React.ReactElement => {
    const narrow = React.useContext(StoryNarrowContext);
    const previewVm = useMockedViewModel({ ...storyThreadPreview, showDisplayName: !narrow }, {});
    const threadSummaryVm = useMockedViewModel(
        {
            isVisible: true,
            replyCountLabel: narrow ? "3" : "3 replies",
            openThreadLabel: "Open thread",
            notificationIndicator: undefined,
            narrow,
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
                        <span className={styles.receiptAvatar}>
                            <StoryMemberAvatar label="T" size="14px" />
                        </span>
                        <span className={styles.receiptAvatar}>
                            <StoryMemberAvatar label="A" size="14px" />
                        </span>
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
    containerWidth,
    rightPanel = false,
    presentationNotice,
    children,
}: React.PropsWithChildren<{
    density: string;
    layout: string;
    shape: EventTileViewProps["root"]["shape"];
    containerWidth?: number;
    rightPanel?: boolean;
    presentationNotice?: StoryPresentationResolution["notice"];
}>): React.ReactElement => {
    const frameRef = React.useRef<HTMLDivElement>(null);
    const [availableWidth, setAvailableWidth] = React.useState(0);
    const defaultContainerWidth = rightPanel ? 320 : 680;

    React.useLayoutEffect(() => {
        const frame = frameRef.current;
        if (!frame) return;

        const updateAvailableWidth = (): void => setAvailableWidth(frame.clientWidth);
        updateAvailableWidth();

        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(updateAvailableWidth);
        observer.observe(frame);
        return () => observer.disconnect();
    }, []);

    const minContainerWidth = rightPanel ? 320 : availableWidth > 0 ? Math.floor(availableWidth / 2) : 500;
    // MainSplit uses maxWidth="50%" for its resizable right panel. RoomView's
    // timeline has no narrower width constraint than its available flex width.
    const maxContainerWidth = Math.max(
        minContainerWidth,
        availableWidth > 0 ? (rightPanel ? Math.floor(availableWidth / 2) : availableWidth) : rightPanel ? 640 : 1000,
    );
    const [selectedContainerWidth, setSelectedContainerWidth] = React.useState(containerWidth ?? defaultContainerWidth);

    React.useEffect(() => {
        setSelectedContainerWidth(containerWidth ?? defaultContainerWidth);
    }, [containerWidth, defaultContainerWidth]);

    const effectiveContainerWidth = Math.min(maxContainerWidth, Math.max(minContainerWidth, selectedContainerWidth));
    const narrow = effectiveContainerWidth <= 500;
    const applicationContainerLabel = rightPanel ? "320px min - 50% max" : "50% min - 100% max";

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
        <StoryDebugFrame ref={frameRef}>
            <StoryNarrowContext.Provider value={narrow}>
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
                <div
                    className={classNames(styles.storyContainer, {
                        [styles.storyRightPanelContainer]: rightPanel,
                    })}
                    style={{ width: `${effectiveContainerWidth}px` }}
                    data-story-boundary="EventTileView.container"
                >
                    <div className={styles.storyContainerLabel} data-story-boundary="EventTileView.containerLabel">
                        EventTileView host · width: {applicationContainerLabel}
                    </div>
                    <div className={styles.storyContainerControls}>
                        <label htmlFor="event-tile-story-container-width">{effectiveContainerWidth}px</label>
                        <input
                            id="event-tile-story-container-width"
                            type="range"
                            min={minContainerWidth}
                            max={maxContainerWidth}
                            step="8"
                            value={effectiveContainerWidth}
                            aria-label="Story host container width"
                            onChange={(event) => setSelectedContainerWidth(Number(event.target.value))}
                        />
                        <output>{`${minContainerWidth}–${maxContainerWidth}px`}</output>
                    </div>
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
                </div>
            </StoryNarrowContext.Provider>
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

/**
 * Slots used by an ordinary room-timeline event. Optional slots are only
 * supplied by the focused state stories below, matching the application
 * where they are derived from the event and interaction state.
 */
const roomSlots: EventTileViewProps["slots"] = {
    sender: <StorySender />,
    avatar: <StoryMemberAvatar />,
    body: <StoryBody />,
    timestamp: <StoryTimestamp />,
    actionBar: <StoryActionBar />,
    receipt: <StoryReceipt />,
    contextMenu: <StoryContextMenu />,
};

/** A valid Room event with the optional slots that can coexist on a timeline tile. */
const richRoomSlots: EventTileViewProps["slots"] = {
    ...roomSlots,
    padlock: <StoryPadlock />,
    replyChain: <StoryReplyChain />,
    footer: <StoryFooter />,
    threadInfo: <StoryThreadInfo />,
    receipt: <StoryReceipt empty />,
};

const richOwnRoomSlots: EventTileViewProps["slots"] = {
    ...richRoomSlots,
    replyChain: undefined,
    receipt: <StoryReceipt />,
};

/** Slots available to message-shaped surfaces such as Card and Thread. */
const cardSlots: EventTileViewProps["slots"] = {
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
    ...cardSlots,
    avatar: <StoryMemberAvatar size="32px" />,
    threadInfo: undefined,
};

const threadsListSlots: EventTileViewProps["slots"] = {
    sender: <StorySender />,
    avatar: <StoryMemberAvatar size="32px" />,
    body: <StoryPreviewBody />,
    timestamp: <StoryTimestamp />,
    notificationBadge: <StoryNotificationBadge />,
    threadInfo: <StoryThreadListInfo />,
    actionBar: <StoryThreadListActionBar />,
};

const notificationSlots: EventTileViewProps["slots"] = {
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
};

type EventTileStoryProps = Omit<EventTileViewProps, "root"> & {
    shape: EventTileViewProps["root"]["shape"];
    /** Width of the Storybook host container around the tile, in pixels. */
    containerWidth?: number;
    /** Whether the story should render the EventTileView-level sender and avatar slots. */
    showSenderAndAvatar?: boolean;
    state?: Partial<EventTileViewProps["root"]["state"]>;
    roomMessages?: "boundaries" | "alice" | "bob" | "media" | "threeEach" | "informational" | "alignedBetween" | "rich";
    searchMessages?: "result";
    /** Whether contextual search messages should use the interactive opacity styling. */
    showSearchContextOpacity?: boolean;
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
              ...slots,
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
    sender,
    avatar,
    timestamp,
}: {
    shape: EventTileViewProps["root"]["shape"];
    slots: EventTileViewProps["slots"];
    showActionBar: boolean;
    sender?: React.ReactNode;
    avatar?: React.ReactNode;
    timestamp?: React.ReactNode;
}): EventTileViewProps["slots"] => {
    const threadInfo = shape === "Thread" ? undefined : slots.threadInfo;
    return {
        ...slots,
        sender,
        avatar,
        timestamp,
        actionBar: showActionBar ? slots.actionBar : undefined,
        // The application Thread rendering branch places no thread-info slot.
        threadInfo,
    };
};

function EventTileViewStoryContent({
    shape,
    containerWidth,
    showSenderAndAvatar: showSenderAndAvatarStoryOverride,
    state,
    roomMessages = "boundaries",
    searchMessages,
    showSearchContextOpacity = false,
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
        bodyOverride?: React.ReactNode,
        showSenderAndAvatarOverride?: boolean,
        slotsOverride?: EventTileViewProps["slots"],
    ): React.ReactElement => {
        const tileState = {
            previewClamped: shape === "ThreadsList" || shape === "Notification",
            ...boundaryState,
            ...state,
        };
        const interaction = tileInteractions[suffix] ?? { hovered: false, focused: false };
        const showActionBar =
            shape === "ThreadsList" || tileState.actionBarFocused || interaction.hovered || interaction.focused;
        const timestamp = createStoryTimestamp(layout, isLast, showActionBar);
        const showSenderAndAvatar =
            showSenderAndAvatarOverride ??
            showSenderAndAvatarStoryOverride ??
            (layout === "irc" || !tileState.continuation);
        const sender = createStorySender(isOwnEvent, showSenderAndAvatar && !tileState.noSender && !tileState.info);
        const avatar = createStoryAvatar(isOwnEvent, layout, showSenderAndAvatar, tileState.info ? "14px" : undefined);
        const tileSlots = {
            ...(slotsOverride ?? props.slots),
            ...(bodyOverride === undefined ? {} : { body: bodyOverride }),
        };
        const slots =
            shape === "Room"
                ? createRoomStorySlots({
                      isOwnEvent,
                      slots: tileSlots,
                      sender,
                      avatar,
                      timestamp,
                      showActionBar,
                  })
                : createPreviewStorySlots({
                      shape,
                      slots: tileSlots,
                      showActionBar,
                      sender,
                      avatar,
                      timestamp,
                  });

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
        if (roomMessages === "media") {
            return (
                <>
                    {renderTile(
                        false,
                        "media-small",
                        { continuation: false, lastInSection: false },
                        false,
                        <StoryMediaBody size="small" />,
                    )}
                    {renderTile(
                        false,
                        "media-medium",
                        { continuation: true, lastInSection: false },
                        false,
                        <StoryMediaBody size="medium" />,
                    )}
                    {renderTile(
                        false,
                        "media-large",
                        { continuation: true, lastInSection: true },
                        true,
                        <StoryMediaBody size="large" />,
                    )}
                </>
            );
        }

        if (roomMessages === "rich") {
            return (
                <>
                    {renderTile(
                        false,
                        "rich-bob-first",
                        { continuation: false, lastInSection: false, hasReply: true },
                        false,
                        undefined,
                        undefined,
                        richRoomSlots,
                    )}
                    {renderTile(
                        false,
                        "rich-bob-continuation",
                        { continuation: true, lastInSection: false },
                        false,
                        <StoryShortBody />,
                        undefined,
                        { body: <StoryShortBody />, receipt: <StoryReceipt empty /> },
                    )}
                    {renderTile(
                        true,
                        "rich-alice-last",
                        { continuation: false, lastInSection: true },
                        true,
                        <StoryEditedMessageBody />,
                        undefined,
                        richOwnRoomSlots,
                    )}
                </>
            );
        }

        if (roomMessages === "alice") {
            return renderTile(true, "alice-single", { continuation: false, lastInSection: true }, true);
        }

        if (roomMessages === "bob") {
            return renderTile(false, "bob-single", { continuation: false, lastInSection: true }, true);
        }

        if (roomMessages === "threeEach") {
            return (
                <>
                    {renderTile(false, "bob-first", { continuation: false, lastInSection: false })}
                    {renderTile(false, "bob-middle", { continuation: true, lastInSection: false })}
                    {renderTile(false, "bob-last", { continuation: true, lastInSection: true }, true)}
                    {renderTile(true, "alice-first", { continuation: false, lastInSection: false })}
                    {renderTile(true, "alice-middle", { continuation: true, lastInSection: false })}
                    {renderTile(true, "alice-last", { continuation: true, lastInSection: true }, true)}
                </>
            );
        }

        if (roomMessages === "informational") {
            return (
                <>
                    {renderTile(
                        false,
                        "informational-first",
                        { info: true, continuation: false, lastInSection: false },
                        false,
                        <StoryInformationalBody>Alex changed the room name.</StoryInformationalBody>,
                    )}
                    {renderTile(
                        false,
                        "informational-second",
                        { info: true, continuation: false, lastInSection: false },
                        false,
                        <StoryInformationalBody>Notifications are enabled.</StoryInformationalBody>,
                    )}
                    {renderTile(
                        false,
                        "informational-last",
                        { info: true, continuation: false, lastInSection: true },
                        true,
                        <StoryInformationalBody>
                            This longer informational event demonstrates how shared textual event styling handles a
                            detailed message that wraps across two rows in the timeline.
                        </StoryInformationalBody>,
                    )}
                </>
            );
        }

        if (roomMessages === "alignedBetween") {
            // The application uses this placement for MatrixRTC m.rtc.notification events.
            return (
                <>
                    {renderTile(
                        false,
                        "aligned-before",
                        { continuation: false, lastInSection: true },
                        false,
                        <StoryShortBody />,
                    )}
                    {renderTile(
                        false,
                        "aligned-event",
                        { alignedBetweenBubbles: true, continuation: false, lastInSection: true },
                        false,
                        <StoryCallStartedBody />,
                        false,
                    )}
                    {renderTile(
                        true,
                        "aligned-after",
                        { continuation: false, lastInSection: true },
                        true,
                        <StoryShortBody />,
                    )}
                </>
            );
        }

        return (
            <>
                {renderTile(false, "bob-first", { continuation: false, lastInSection: false })}
                {renderTile(false, "bob-middle", { continuation: true, lastInSection: false })}
                {renderTile(false, "bob-last", { continuation: true, lastInSection: true })}
                {renderTile(
                    true,
                    "alice-single",
                    { continuation: false, lastInSection: true },
                    true,
                    <StoryEditedMessageBody />,
                )}
            </>
        );
    };

    const renderSearchTiles = (): React.ReactNode => (
        <>
            {renderTile(
                false,
                "search-context-before",
                { contextual: showSearchContextOpacity, continuation: false, lastInSection: false },
                false,
                <StorySearchContextBody body="Earlier context message in the room." />,
            )}
            {renderTile(
                false,
                "search-result",
                { contextual: false, continuation: true, lastInSection: false },
                false,
                <StorySearchBody />,
            )}
            {renderTile(
                false,
                "search-context-after",
                { contextual: showSearchContextOpacity, continuation: true, lastInSection: true },
                true,
                <StorySearchContextBody body="Later context message in the room." />,
            )}
        </>
    );

    // PinnedMessagesCard is still rendered by the legacy PinnedEventTile in the
    // application. Keep this story as a presentation diagnostic rather than
    // rendering an EventTileView that does not represent the real panel.
    const renderTiles = (): React.ReactNode => {
        if (shape === "Pinned") return null;
        if (shape === "Room") return renderRoomTiles();
        if (shape === "Search" && searchMessages === "result") return renderSearchTiles();

        return renderTile(false, "event", { continuation: false, lastInSection: true }, true);
    };

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
                containerWidth={containerWidth}
                rightPanel={rightPanel}
                presentationNotice={presentation.notice}
            >
                {renderTiles()}
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

const shapeDescriptions = {
    Room: "Application slot contract: sender, avatar, body, timestamp, and optional padlock, replyChain, footer, threadInfo, receipt, actionBar, and contextMenu slots. Optional slots depend on the event and interaction state.",
    Thread: "Application slot contract: sender, avatar, body, timestamp, and optional padlock, footer, receipt, and actionBar slots. The threadInfo slot is omitted because this shape is already rendered in a thread view.",
    Notification:
        "Application slot contract: sender, body, timestamp, roomAvatar, notificationRoomLabel, notificationBadge, and threadInfo slots. Member avatar, footer, receipt, padlock, and actionBar slots are omitted.",
    ThreadsList:
        "Application slot contract: sender, avatar, preview body, timestamp, notificationBadge, threadInfo, and actionBar slots. Footer, receipt, padlock, and contextMenu slots are omitted.",
    File: "Application slot contract: sender, avatar, plain timestamp, and file body slots. Footer, receipt, threadInfo, and actionBar slots are omitted; the FilePanel host is not reproduced here.",
    Card: "Application slot contract: sender, avatar, body, timestamp, padlock, footer, threadInfo, receipt, and optional actionBar slots. This shape is used by message cards and has no contextMenu slot.",
    Search: "Application slot contract: sender, avatar, body, timestamp, and threadInfo slots. Search results omit footer and receipt slots; contextual events are dimmed while the matching formatted body remains undimmed and highlighted.",
    Pinned: "The application currently renders PinnedEventTile for pinned messages, so this story is not an application EventTileView example and has no application slot contract.",
} as const;

const shapeDescriptionParameters = (shape: keyof typeof shapeDescriptions, note?: string) => ({
    parameters: {
        docs: {
            description: {
                story: note ? `${shapeDescriptions[shape]} ${note}` : shapeDescriptions[shape],
            },
        },
    },
});

const storyHelpers = {
    EventTileViewStory,
    eventTileStoryDefaults,
    bubbleGlobals,
    groupGlobals,
    ircGlobals,
    compactGroupGlobals,
    StoryDecryptionFailureBody,
    StoryDecryptionFailurePadlock,
    StoryEditedMessageBody,
    StoryMessageComposer,
    StoryEmoteBody,
    StoryHighlightedBody,
    StoryInformationalBody,
    StoryLinkedTimestamp,
    StoryPadlock,
    StoryMediaBody,
    StoryNotificationBadge,
    StoryPreviewBody,
    StoryShortBody,
    StoryReplyChain,
    StoryStickerBody,
    StoryThreadListActionBar,
    StoryThreadListInfo,
    shapeDescriptionParameters,
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
        containerWidth: {
            table: { disable: true },
        },
        showSenderAndAvatar: { table: { disable: true } },
        classNames: { table: { disable: true } },
        state: { table: { disable: true } },
        roomMessages: { table: { disable: true } },
        searchMessages: { table: { disable: true } },
        showSearchContextOpacity: { table: { disable: true } },
        line: { table: { disable: true } },
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

export const Room: Story = {
    tags: interactiveTags,
    ...shapeDescriptionParameters("Room"),
    args: {
        roomMessages: "rich",
        slots: richRoomSlots,
    },
};

export const ThreadsList: Story = {
    tags: interactiveTags,
    ...shapeDescriptionParameters("ThreadsList"),
    args: {
        shape: "ThreadsList",
        slots: threadsListSlots,
    },
};

export const Thread: Story = {
    tags: interactiveTags,
    ...shapeDescriptionParameters("Thread"),
    args: {
        shape: "Thread",
        slots: threadSlots,
    },
};

export const Card: Story = {
    tags: interactiveTags,
    ...shapeDescriptionParameters("Card"),
    args: {
        shape: "Card",
        slots: cardSlots,
    },
};

export const Notification: Story = {
    tags: interactiveTags,
    ...shapeDescriptionParameters("Notification"),
    args: {
        shape: "Notification",
        slots: notificationSlots,
    },
};

export const File: Story = {
    tags: interactiveTags,
    ...shapeDescriptionParameters("File"),
    args: {
        shape: "File",
        slots: {
            sender: <StorySender />,
            avatar: <StoryMemberAvatar size="20px" />,
            timestamp: <StoryTimestamp />,
            body: <StoryFileBody />,
        },
    },
};

export const Search: Story = {
    tags: interactiveTags,
    ...shapeDescriptionParameters("Search"),
    args: {
        shape: "Search",
        // Search results include contextual events around the undimmed matching event.
        searchMessages: "result",
        showSearchContextOpacity: true,
        state: {},
        slots: {
            sender: <StorySender />,
            avatar: <StoryMemberAvatar />,
            body: <StorySearchBody />,
            timestamp: <StoryLinkedTimestamp />,
            threadInfo: <StorySearchThreadInfo />,
        },
    },
};

export const Pinned: Story = {
    tags: interactiveTags,
    ...shapeDescriptionParameters("Pinned"),
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
    args: { ...Search.args, showSearchContextOpacity: false },
};

export const PinnedGroup: Story = {
    name: "Pinned - Group",
    tags: visualTags,
    globals: groupGlobals,
    args: Pinned.args,
};
