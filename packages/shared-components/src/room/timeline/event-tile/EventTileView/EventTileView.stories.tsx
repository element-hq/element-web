/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import classNames from "classnames";
import { fn } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { useEventPresentation } from "../../EventPresentation";
import { EventTileView, type EventTileViewProps } from "./index";
import styles from "./EventTileView.stories.module.css";

const Slot = ({
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

const StoryAvatar = ({ room = false, label = "A" }: { room?: boolean; label?: string }): React.ReactElement => (
    <span className={room ? styles.roomAvatar : styles.avatar} aria-hidden="true">
        {room ? "R" : label}
    </span>
);

const StorySender = ({
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

const StoryTimestamp = (): React.ReactElement => <time className={styles.timestamp}>12:34</time>;

const StoryBody = (): React.ReactElement => (
    <div className={styles.body}>
        <div>Here is a realistic event tile body with enough text to show the available width.</div>
        <div>This second line makes wrapping and vertical rhythm visible in Storybook.</div>
    </div>
);

const StoryReplyChain = (): React.ReactElement => (
    <div className={styles.replyChain}>
        <span className={styles.replyAuthor}>Taylor Example</span>
        <span>Earlier message quoted in this reply.</span>
    </div>
);

const StoryActionBar = (): React.ReactElement => (
    <div className={styles.actionBar} role="toolbar" aria-label="Message actions">
        <button type="button">Reply</button>
        <button type="button">React</button>
        <button type="button">More</button>
    </div>
);

const StoryFooter = (): React.ReactElement => (
    <div className={styles.footer}>
        <span>👍 2</span>
        <span>❤️ 1</span>
    </div>
);

const StoryThreadInfo = (): React.ReactElement => <div className={styles.threadInfo}>3 replies</div>;

const StoryReceipt = (): React.ReactElement => <span className={styles.receipt}>Read</span>;

const StoryPadlock = (): React.ReactElement => <span className={styles.padlock}>🔒</span>;

const StoryContextMenu = (): React.ReactElement => <span className={styles.contextMenu}>⋯</span>;

const baseRoot: EventTileViewProps["root"] = {
    id: "event-tile-story-line",
    ariaLive: "off",
    scrollToken: "event-tile-story",
    permalink: "https://example.org/event-tile-story",
    data: {
        eventId: "$event-tile-story",
        layout: "group",
        shape: "Room",
        isOwnEvent: false,
        hasReply: true,
    },
};

const roomSlots: EventTileViewProps["slots"] = {
    sender: (
        <Slot name="sender" as="div">
            <StorySender />
        </Slot>
    ),
    avatar: (
        <Slot name="avatar">
            <StoryAvatar />
        </Slot>
    ),
    body: (
        <Slot name="body" as="div">
            <StoryBody />
        </Slot>
    ),
    timestamp: (
        <Slot name="timestamp">
            <StoryTimestamp />
        </Slot>
    ),
    padlock: (
        <Slot name="padlock">
            <StoryPadlock />
        </Slot>
    ),
    replyChain: (
        <Slot name="replyChain" as="div">
            <StoryReplyChain />
        </Slot>
    ),
    actionBar: (
        <Slot name="actionBar" as="div" className={styles.actionBarSlot}>
            <StoryActionBar />
        </Slot>
    ),
    footer: (
        <Slot name="footer" as="div">
            <StoryFooter />
        </Slot>
    ),
    threadInfo: (
        <Slot name="threadInfo" as="div">
            <StoryThreadInfo />
        </Slot>
    ),
    receipt: (
        <Slot name="receipt">
            <StoryReceipt />
        </Slot>
    ),
    contextMenu: (
        <Slot name="contextMenu">
            <StoryContextMenu />
        </Slot>
    ),
};

type EventTileStoryProps = Omit<EventTileViewProps, "root"> & {
    shape: EventTileViewProps["root"]["data"]["shape"];
};

function EventTileViewStoryContent({
    shape,
    ...props
}: Omit<EventTileStoryProps, "eventLayout" | "density">): React.ReactElement {
    const { layout, density } = useEventPresentation();

    const renderTile = (isOwnEvent: boolean, suffix: string): React.ReactElement => (
        <EventTileView
            key={suffix}
            {...props}
            slots={
                shape === "Room"
                    ? {
                          ...props.slots,
                          sender: (
                              <Slot name="sender" as="div">
                                  <StorySender
                                      name={isOwnEvent ? "Alice" : "Bob"}
                                      id={isOwnEvent ? "@alice:example.org" : "@bob:example.org"}
                                  />
                              </Slot>
                          ),
                          avatar: (
                              <Slot name="avatar">
                                  <StoryAvatar label={isOwnEvent ? "A" : "B"} />
                              </Slot>
                          ),
                      }
                    : props.slots
            }
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
            }}
        />
    );

    return (
        <ul className={styles.canvas} data-event-density={density} data-event-layout={layout}>
            {shape === "Room" ? (
                <>
                    {renderTile(false, "received")} {renderTile(true, "sent")}
                </>
            ) : (
                renderTile(false, "event")
            )}
        </ul>
    );
}

const EventTileViewStory = (props: EventTileStoryProps): React.ReactElement => <EventTileViewStoryContent {...props} />;

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
    },
    args: {
        shape: "Room",
        classNames: {
            details: styles.detailsContainer,
        },
        slots: roomSlots,
        onClick: fn(),
        onContextMenu: fn(),
        onPermalinkClick: fn(),
        onPermalinkContextMenu: fn(),
    },
} satisfies Meta<typeof EventTileViewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Room: Story = {};

export const Thread: Story = {
    args: {
        shape: "Thread",
    },
};

export const Notification: Story = {
    args: {
        shape: "Notification",
        slots: {
            sender: (
                <Slot name="sender" as="div">
                    <StorySender />
                </Slot>
            ),
            body: (
                <Slot name="body" as="div">
                    <StoryBody />
                </Slot>
            ),
            timestamp: (
                <Slot name="timestamp">
                    <StoryTimestamp />
                </Slot>
            ),
            roomAvatar: (
                <Slot name="roomAvatar">
                    <StoryAvatar room />
                </Slot>
            ),
            notificationRoomLabel: (
                <Slot name="notificationRoomLabel">
                    <span className={styles.roomLabel}>in Example room</span>
                </Slot>
            ),
            notificationBadge: (
                <Slot name="notificationBadge">
                    <span className={styles.badge}>Unread</span>
                </Slot>
            ),
            threadInfo: (
                <Slot name="threadInfo" as="div">
                    <StoryThreadInfo />
                </Slot>
            ),
            receipt: (
                <Slot name="receipt">
                    <StoryReceipt />
                </Slot>
            ),
        },
    },
};

export const ThreadsList: Story = {
    args: {
        shape: "ThreadsList",
        slots: {
            sender: (
                <Slot name="sender" as="div">
                    <StorySender />
                </Slot>
            ),
            avatar: (
                <Slot name="avatar">
                    <StoryAvatar />
                </Slot>
            ),
            body: (
                <Slot name="body" as="div">
                    <StoryBody />
                </Slot>
            ),
            timestamp: (
                <Slot name="timestamp">
                    <StoryTimestamp />
                </Slot>
            ),
            notificationBadge: (
                <Slot name="notificationBadge">
                    <span className={styles.badge}>Unread</span>
                </Slot>
            ),
            threadInfo: (
                <Slot name="threadInfo" as="div">
                    <StoryThreadInfo />
                </Slot>
            ),
            actionBar: (
                <Slot name="actionBar" as="div" className={styles.actionBarSlot}>
                    <StoryActionBar />
                </Slot>
            ),
            receipt: (
                <Slot name="receipt">
                    <StoryReceipt />
                </Slot>
            ),
        },
    },
};

export const File: Story = {
    args: {
        shape: "File",
        slots: {
            sender: (
                <Slot name="sender" as="div">
                    <StorySender />
                </Slot>
            ),
            avatar: (
                <Slot name="avatar">
                    <StoryAvatar />
                </Slot>
            ),
            timestamp: (
                <Slot name="timestamp">
                    <StoryTimestamp />
                </Slot>
            ),
            body: (
                <Slot name="body" as="div">
                    <StoryBody />
                </Slot>
            ),
            contextMenu: (
                <Slot name="contextMenu">
                    <StoryContextMenu />
                </Slot>
            ),
        },
    },
};
