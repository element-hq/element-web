/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useState } from "react";
import { Menu, MenuItem, NavBar, NavItem, Text } from "@vector-im/compound-web";
import { NotificationDecoration, type NotificationDecorationData } from "@element-hq/web-shared-components";

import { ThreadsActivityCentreButton } from "./ThreadsActivityCentreButton";
import { _t } from "../../../../languageHandler";
import DecoratedRoomAvatar from "../../avatars/DecoratedRoomAvatar";
import { Action } from "../../../../dispatcher/actions";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import RightPanelStore from "../../../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../stores/right-panel/RightPanelStorePhases";
import { type ThreadData, type UnreadThreadRooms, useUnreadThreadRooms } from "./useUnreadThreadRooms";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { MessagePreviewStore } from "../../../../stores/message-preview/MessagePreviewStore";
import { getSenderName } from "../../../../stores/message-preview/previews/utils";
import PosthogTrackers from "../../../../PosthogTrackers";
import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";

interface ThreadsActivityCentreProps {
    /**
     * Display the `Treads` label next to the icon.
     */
    displayButtonLabel?: boolean;
}

/**
 * The two views available in the Threads Activity Centre popup.
 */
type TACView = "my_threads" | "other_threads";

/**
 * Get the threads to display for the active tab, and the caption shown when that tab is empty.
 * @param view - the active tab
 * @param unreadThreadRooms - the unread threads, as returned by {@link useUnreadThreadRooms}
 */
function getActiveTabContent(
    view: TACView,
    unreadThreadRooms: UnreadThreadRooms,
): { threads: ThreadData[]; emptyCaption: string } {
    if (view === "my_threads") {
        return {
            threads: unreadThreadRooms.participatingThreads,
            emptyCaption: _t("threads_activity_centre|no_participating_threads_unread"),
        };
    }

    return {
        threads: unreadThreadRooms.otherThreads,
        emptyCaption: _t("threads_activity_centre|no_other_unread_threads"),
    };
}

/**
 * Display in a popup the list of rooms with unread threads.
 * The popup is displayed when the user clicks on the `Threads` button.
 */
export function ThreadsActivityCentre({ displayButtonLabel }: ThreadsActivityCentreProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<TACView>("my_threads");
    const roomsAndNotifications = useUnreadThreadRooms(open);

    const { threads: activeThreads, emptyCaption: activeEmptyCaption } = getActiveTabContent(
        view,
        roomsAndNotifications,
    );

    return (
        <div
            className="mx_ThreadsActivityCentre_container"
            onKeyDown={(evt) => {
                // Do nothing if the TAC is closed
                if (!open) return;

                const action = getKeyBindingsManager().getNavigationAction(evt);

                // Block spotlight opening
                if (action === KeyBindingAction.FilterRooms) {
                    evt.stopPropagation();
                }
            }}
        >
            <Menu
                className="mx_ThreadsActivityCentre_menu"
                align="start"
                side="top"
                open={open}
                onOpenChange={(newOpen) => {
                    // Track only when the Threads Activity Centre is opened
                    if (newOpen) PosthogTrackers.trackInteraction("WebThreadsActivityCentreButton");

                    setOpen(newOpen);
                }}
                title={_t("threads_activity_centre|header")}
                showTitle={false}
                trigger={
                    <ThreadsActivityCentreButton
                        displayLabel={displayButtonLabel}
                        notificationLevel={roomsAndNotifications.greatestNotificationLevel}
                    />
                }
            >
                {/* Tab toggle: My threads | Other threads */}
                <NavBar
                    className="mx_ThreadsActivityCentre_tabs"
                    role="tablist"
                    aria-label={_t("threads_activity_centre|header")}
                >
                    <NavItem
                        aria-controls="mx_ThreadsActivityCentre_panel"
                        active={view === "my_threads"}
                        onClick={() => setView("my_threads")}
                    >
                        {_t("threads_activity_centre|my_threads_tab")}
                    </NavItem>
                    <NavItem
                        aria-controls="mx_ThreadsActivityCentre_panel"
                        active={view === "other_threads"}
                        onClick={() => setView("other_threads")}
                    >
                        {_t("threads_activity_centre|other_threads_tab")}
                    </NavItem>
                </NavBar>
                {/* Make the content of the pop-up scrollable */}
                <div id="mx_ThreadsActivityCentre_panel" role="tabpanel" className="mx_ThreadsActivityCentre_rows">
                    {activeThreads.map((threadData) => (
                        <ThreadsActivityCentreThreadRow
                            key={`${threadData.room.roomId}:${threadData.thread.id}`}
                            threadData={threadData}
                            onClick={() => setOpen(false)}
                        />
                    ))}
                    {activeThreads.length === 0 && (
                        <Text as="div" size="sm" weight="regular" className="mx_ThreadsActivityCentre_emptyCaption">
                            {activeEmptyCaption}
                        </Text>
                    )}
                </div>
            </Menu>
        </div>
    );
}

interface ThreadsActivityThreadRow {
    /**
     * The thread data including the thread, room, and notification level.
     */
    threadData: ThreadData;
    /**
     * Callback when the user clicks on the row.
     */
    onClick: () => void;
}

/**
 * Map a thread's unread state onto the notification decoration shared with the room list, so a
 * mention, a counted notification and bare activity are told apart by shape and not only by colour.
 *
 * The levels are mutually exclusive, mirroring {@link RoomNotificationState}'s `isMention` /
 * `isNotification` / `isActivityNotification` getters.
 *
 * @param level - the thread's notification level
 * @param count - the server-reported notification count, 0 for a local-only unread
 * @param muted - whether the thread's room is muted
 */
export function threadDecorationProps(
    level: NotificationLevel,
    count: number,
    muted: boolean,
): NotificationDecorationData {
    return {
        // Rows only exist for threads we have already decided are unread.
        hasAnyNotificationOrActivity: true,
        isMention: level === NotificationLevel.Highlight,
        isNotification: level === NotificationLevel.Notification,
        isActivityNotification: level === NotificationLevel.Activity,
        hasUnreadCount: count > 0,
        count,
        muted,
        // evaluateThreadUnread never yields NotificationLevel.Unsent, and threads can't be invites.
        isUnsentMessage: false,
        invited: false,
    };
}

/**
 * The `data-notification-level` marker for a thread row, used by tests as the decoration itself
 * exposes no per-level attribute. Mirrors `NotificationBadgeView`'s values.
 */
function notificationLevelMarker(level: NotificationLevel): "highlight" | "notification" | undefined {
    if (level === NotificationLevel.Highlight) return "highlight";
    if (level === NotificationLevel.Notification) return "notification";
    return undefined;
}

/**
 * Describe a thread's unread state for screen readers. The row sets its own `aria-label`, which
 * overrides its content, so the visible counter would otherwise go unannounced.
 * Mirrors `roomAriaUnreadLabel` in `SpotlightDialog`.
 */
function threadAriaUnreadLabel(level: NotificationLevel, count: number): string {
    if (level === NotificationLevel.Highlight) return _t("a11y|n_unread_messages_mentions", { count });
    if (count > 0) return _t("a11y|n_unread_messages", { count });
    return _t("a11y|unread_messages");
}

/**
 * Display an unread thread the user has participated in.
 */
function ThreadsActivityCentreThreadRow({ threadData, onClick }: ThreadsActivityThreadRow): JSX.Element {
    const { thread, room, notificationLevel, notificationCount, muted } = threadData;

    const rootEvent = thread.rootEvent;
    // getSenderName resolves the disambiguated member name, falling back to the raw user ID.
    const senderName = rootEvent ? getSenderName(rootEvent) : "";
    // Let the shared preview store render the message text — it handles edits, replies,
    // emotes, HTML and non-message event types consistently with the room list.
    const previewText = rootEvent ? MessagePreviewStore.instance.generatePreviewForEvent(rootEvent) : "";

    const description = senderName ? `${room.name}: ${senderName}: ${previewText}` : room.name;

    return (
        <MenuItem
            className="mx_ThreadsActivityCentreThreadRow"
            // label={null} renders no label span; aria-label provides the accessible name.
            label={null}
            // The design uses the notification decoration as the only trailing affordance.
            hideChevron
            aria-label={`${description} ${threadAriaUnreadLabel(notificationLevel, notificationCount)}`}
            Icon={<DecoratedRoomAvatar room={room} size="40px" />}
            onSelect={(event: Event) => {
                onClick();

                // Open the specific thread in that room's right panel. Set a two-card
                // stack (thread list beneath the thread view) so the thread view gets a
                // working back button, mirroring the canonical Action.ShowThread path.
                if (thread.rootEvent) {
                    RightPanelStore.instance.setCards(
                        [
                            { phase: RightPanelPhases.ThreadPanel },
                            {
                                phase: RightPanelPhases.ThreadView,
                                state: { threadHeadEvent: thread.rootEvent },
                            },
                        ],
                        true,
                        room.roomId,
                    );
                }

                // Track the click
                PosthogTrackers.trackInteraction("WebThreadsActivityCentreRoomItem", event);

                // Navigate to the room
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    show_room_tile: true,
                    room_id: room.roomId,
                    metricsTrigger: "WebThreadsActivityCentre",
                    focusNext: "threadsPanel",
                });
            }}
        >
            <div className="mx_ThreadsActivityCentreThreadRow_content">
                <div className="mx_ThreadsActivityCentreThreadRow_header">
                    <Text as="span" size="md" weight="semibold" className="mx_ThreadsActivityCentreThreadRow_roomName">
                        {room.name}
                    </Text>
                </div>
                {(senderName || previewText) && (
                    <Text as="span" size="sm" weight="regular" className="mx_ThreadsActivityCentreThreadRow_preview">
                        {senderName && (
                            <Text
                                as="span"
                                size="sm"
                                weight="medium"
                                className="mx_ThreadsActivityCentreThreadRow_sender"
                            >
                                {`${senderName}: `}
                            </Text>
                        )}
                        {previewText}
                    </Text>
                )}
            </div>
            {/* The decoration takes no extra props, so the marker for tests lives on a wrapper. */}
            <span
                className="mx_ThreadsActivityCentreThreadRow_decoration"
                data-notification-level={notificationLevelMarker(notificationLevel)}
            >
                <NotificationDecoration {...threadDecorationProps(notificationLevel, notificationCount, muted)} />
            </span>
        </MenuItem>
    );
}
