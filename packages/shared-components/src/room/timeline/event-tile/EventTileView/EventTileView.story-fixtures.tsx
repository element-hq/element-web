/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import classNames from "classnames";
import { fn } from "storybook/test";

import { useEventPresentation } from "../../EventPresentation";
import { withViewDocs } from "../../../../../.storybook/withViewDocs";
import { EventTileView, type EventTileViewProps } from "./index";
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

    return React.cloneElement(child, {
        className: classNames(styles.slot, child.props.className, className),
        storyBoundary: `EventTileView.slots.${name}`,
        "data-story-boundary": `EventTileView.slots.${name}`,
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
    className,
    storyBoundary,
}: {
    room?: boolean;
    label?: string;
    className?: string;
    storyBoundary?: string;
}): React.ReactElement => (
    <span
        className={classNames(room ? styles.roomAvatar : styles.avatar, className)}
        data-story-boundary={storyBoundary}
        aria-hidden="true"
    >
        {room ? "R" : label}
    </span>
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
}): React.ReactElement => (
    <div className={classNames(styles.sender, className)} data-story-boundary={storyBoundary}>
        <span className={styles.senderName}>{name}</span>
        <span className={styles.senderId}>{id}</span>
    </div>
);

export const StoryTimestamp = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <time className={classNames(styles.timestamp, className)} data-story-boundary={storyBoundary}>
        12:34
    </time>
);
export const StoryBody = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <div className={classNames(styles.body, className)} data-story-boundary={storyBoundary}>
        <div>Here is a realistic event tile body with enough text to show the available width.</div>
        <div>This second line makes wrapping and vertical rhythm visible in Storybook.</div>
    </div>
);
export const StoryReplyChain = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <div className={classNames(styles.replyChain, className)} data-story-boundary={storyBoundary}>
        <span className={styles.replyAuthor}>Taylor Example</span>
        <span>Earlier message quoted in this reply.</span>
    </div>
);
export const StoryActionBar = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <div
        className={classNames(styles.actionBarContent, className)}
        data-story-boundary={storyBoundary}
        role="toolbar"
        aria-label="Message actions"
    >
        <button type="button">Reply</button>
        <button type="button">React</button>
        <button type="button">More</button>
    </div>
);
export const StoryFooter = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <div className={classNames(styles.footer, className)} data-story-boundary={storyBoundary}>
        <span>👍 2</span>
        <span>❤️ 1</span>
    </div>
);
export const StoryThreadInfo = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <div className={classNames(styles.threadInfo, className)} data-story-boundary={storyBoundary}>
        3 replies
    </div>
);
export const StoryReceipt = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <span className={classNames(styles.receipt, className)} data-story-boundary={storyBoundary}>
        Read
    </span>
);
export const StoryPadlock = ({ className, storyBoundary }: StorySlotProps): React.ReactElement => (
    <span className={classNames(styles.padlock, className)} data-story-boundary={storyBoundary}>
        🔒
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
};

function EventTileViewStoryContent({ shape, state, ...props }: EventTileStoryProps): React.ReactElement {
    const { layout, density } = useEventPresentation();
    const renderTile = (isOwnEvent: boolean, suffix: string): React.ReactElement => (
        <EventTileView
            key={suffix}
            {...props}
            classNames={{
                ...props.classNames,
                root: classNames(props.classNames?.root, "storyEventTile"),
                line: classNames(props.classNames?.line, "storyEventLine"),
            }}
            slots={
                shape === "Room"
                    ? {
                          ...props.slots,
                          sender: <Slot name="sender" as="div"><StorySender name={isOwnEvent ? "Alice" : "Bob"} id={isOwnEvent ? "@alice:example.org" : "@bob:example.org"} /></Slot>,
                          avatar: <Slot name="avatar"><StoryAvatar label={isOwnEvent ? "A" : "B"} /></Slot>,
                      }
                    : props.slots
            }
            root={{
                ...baseRoot,
                id: `${baseRoot.id}-${suffix}`,
                scrollToken: `${baseRoot.scrollToken}-${suffix}`,
                data: { ...baseRoot.data, eventId: `${baseRoot.data.eventId}-${suffix}`, layout, shape, isOwnEvent },
                state,
            }}
        />
    );
    return (
        <TimelineStoryFrame density={density} layout={layout}>
            {shape === "Room" ? (
                <>
                    {renderTile(false, "received")}
                    {renderTile(true, "sent")}
                </>
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
