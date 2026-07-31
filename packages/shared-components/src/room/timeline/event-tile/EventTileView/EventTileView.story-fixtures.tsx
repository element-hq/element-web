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
    as = "span",
    className,
    children,
}: React.PropsWithChildren<{ name: string; as?: "div" | "span"; className?: string }>): React.ReactElement => {
    const Element = as;
    return (
        <Element className={classNames(styles.slot, className)} data-slot={name}>
            {children}
        </Element>
    );
};

export const StoryAvatar = ({ room = false, label = "A" }: { room?: boolean; label?: string }): React.ReactElement => (
    <span className={room ? styles.roomAvatar : styles.avatar} aria-hidden="true">
        {room ? "R" : label}
    </span>
);

export const StorySender = ({
    name = "Alex Example",
    id = "@alex:example.org",
}: {
    name?: string;
    id?: string;
}): React.ReactElement => (
    <div className={styles.sender}>
        <span className={styles.senderName}>{name}</span>
        <span className={styles.senderId}>{id}</span>
    </div>
);

export const StoryTimestamp = (): React.ReactElement => <time className={styles.timestamp}>12:34</time>;
export const StoryBody = (): React.ReactElement => (
    <div className={styles.body}>
        <div>Here is a realistic event tile body with enough text to show the available width.</div>
        <div>This second line makes wrapping and vertical rhythm visible in Storybook.</div>
    </div>
);
export const StoryReplyChain = (): React.ReactElement => (
    <div className={styles.replyChain}>
        <span className={styles.replyAuthor}>Taylor Example</span>
        <span>Earlier message quoted in this reply.</span>
    </div>
);
export const StoryActionBar = (): React.ReactElement => (
    <div className={styles.actionBar} role="toolbar" aria-label="Message actions">
        <button type="button">Reply</button>
        <button type="button">React</button>
        <button type="button">More</button>
    </div>
);
export const StoryFooter = (): React.ReactElement => (
    <div className={styles.footer}>
        <span>👍 2</span>
        <span>❤️ 1</span>
    </div>
);
export const StoryThreadInfo = (): React.ReactElement => <div className={styles.threadInfo}>3 replies</div>;
export const StoryReceipt = (): React.ReactElement => <span className={styles.receipt}>Read</span>;
export const StoryPadlock = (): React.ReactElement => <span className={styles.padlock}>🔒</span>;
export const StoryContextMenu = (): React.ReactElement => <span className={styles.contextMenu}>⋯</span>;

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
    actionBar: <Slot name="actionBar" as="div" className={styles.actionBarSlot}><StoryActionBar /></Slot>,
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
    return <ul className={styles.canvas} data-event-density={density} data-event-layout={layout}>
        {shape === "Room" ? <>{renderTile(false, "received")} {renderTile(true, "sent")}</> : renderTile(false, "event")}
    </ul>;
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
