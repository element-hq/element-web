/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useState } from "react";
import { Menu, MenuItem } from "@vector-im/compound-web";
import { type Room } from "matrix-js-sdk/src/matrix";

import { ThreadsActivityCentreButton } from "./ThreadsActivityCentreButton";
import { _t } from "../../../../languageHandler";
import DecoratedRoomAvatar from "../../avatars/DecoratedRoomAvatar";
import { Action } from "../../../../dispatcher/actions";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import RightPanelStore from "../../../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../stores/right-panel/RightPanelStorePhases";
import { type ThreadData, useUnreadThreadRooms } from "./useUnreadThreadRooms";
import { StatelessNotificationBadge } from "../../rooms/NotificationBadge/StatelessNotificationBadge";
import { type NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import PosthogTrackers from "../../../../PosthogTrackers";
import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import { useSettingValue } from "../../../../hooks/useSettings";

interface ThreadsActivityCentreProps {
    /**
     * Display the `Treads` label next to the icon.
     */
    displayButtonLabel?: boolean;
}

/**
 * The three views available in the Threads Activity Centre popup.
 */
enum TACView {
    Rooms = "rooms",
    AllThreads = "all_threads",
    MyThreads = "my_threads",
}

/**
 * Display in a popup the list of rooms with unread threads.
 * The popup is displayed when the user clicks on the `Threads` button.
 */
export function ThreadsActivityCentre({ displayButtonLabel }: ThreadsActivityCentreProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<TACView>(TACView.Rooms);
    const roomsAndNotifications = useUnreadThreadRooms(open);
    const settingTACOnlyNotifs = useSettingValue("Notifications.tac_only_notifications");

    const roomsEmptyCaption = settingTACOnlyNotifs
        ? _t("threads_activity_centre|no_rooms_with_threads_notifs")
        : _t("threads_activity_centre|no_rooms_with_unread_threads");

    const allThreadsEmptyCaption = _t("threads_activity_centre|no_all_unread_threads");
    // My threads always shows all unread participated threads regardless of settingTACOnlyNotifs
    const threadsEmptyCaption = _t("threads_activity_centre|no_participating_threads_unread");

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
                align="start"
                side="top"
                open={open}
                onOpenChange={(newOpen) => {
                    // Track only when the Threads Activity Centre is opened
                    if (newOpen) PosthogTrackers.trackInteraction("WebThreadsActivityCentreButton");

                    setOpen(newOpen);
                }}
                title={_t("threads_activity_centre|header")}
                trigger={
                    <ThreadsActivityCentreButton
                        displayLabel={displayButtonLabel}
                        notificationLevel={roomsAndNotifications.greatestNotificationLevel}
                    />
                }
            >
                {/* Tab toggle: Rooms | All threads | My threads */}
                <div className="mx_ThreadsActivityCentre_tabs" role="tablist">
                    <button
                        role="tab"
                        aria-selected={view === TACView.Rooms}
                        className={`mx_ThreadsActivityCentre_tab ${view === TACView.Rooms ? "mx_ThreadsActivityCentre_tab--active" : ""}`}
                        onClick={() => setView(TACView.Rooms)}
                    >
                        {_t("threads_activity_centre|rooms_tab")}
                    </button>
                    <button
                        role="tab"
                        aria-selected={view === TACView.AllThreads}
                        className={`mx_ThreadsActivityCentre_tab ${view === TACView.AllThreads ? "mx_ThreadsActivityCentre_tab--active" : ""}`}
                        onClick={() => setView(TACView.AllThreads)}
                    >
                        {_t("threads_activity_centre|all_threads_tab")}
                    </button>
                    <button
                        role="tab"
                        aria-selected={view === TACView.MyThreads}
                        className={`mx_ThreadsActivityCentre_tab ${view === TACView.MyThreads ? "mx_ThreadsActivityCentre_tab--active" : ""}`}
                        onClick={() => setView(TACView.MyThreads)}
                    >
                        {_t("threads_activity_centre|my_threads_tab")}
                    </button>
                </div>
                {/* Make the content of the pop-up scrollable */}
                <div className="mx_ThreadsActivityCentre_rows">
                    {view === TACView.Rooms && (
                        <>
                            {roomsAndNotifications.rooms.map(({ room, notificationLevel }) => (
                                <ThreadsActivityCentreRow
                                    key={room.roomId}
                                    room={room}
                                    notificationLevel={notificationLevel}
                                    onClick={() => setOpen(false)}
                                />
                            ))}
                            {roomsAndNotifications.rooms.length === 0 && (
                                <div className="mx_ThreadsActivityCentre_emptyCaption">{roomsEmptyCaption}</div>
                            )}
                        </>
                    )}
                    {view === TACView.AllThreads && (
                        <>
                            {roomsAndNotifications.allUnreadThreads.map((threadData) => (
                                <ThreadsActivityCentreThreadRow
                                    key={`${threadData.room.roomId}:${threadData.thread.id}`}
                                    threadData={threadData}
                                    onClick={() => setOpen(false)}
                                />
                            ))}
                            {roomsAndNotifications.allUnreadThreads.length === 0 && (
                                <div className="mx_ThreadsActivityCentre_emptyCaption">{allThreadsEmptyCaption}</div>
                            )}
                        </>
                    )}
                    {view === TACView.MyThreads && (
                        <>
                            {roomsAndNotifications.participatingThreads.map((threadData) => (
                                <ThreadsActivityCentreThreadRow
                                    key={`${threadData.room.roomId}:${threadData.thread.id}`}
                                    threadData={threadData}
                                    onClick={() => setOpen(false)}
                                />
                            ))}
                            {roomsAndNotifications.participatingThreads.length === 0 && (
                                <div className="mx_ThreadsActivityCentre_emptyCaption">{threadsEmptyCaption}</div>
                            )}
                        </>
                    )}
                </div>
            </Menu>
        </div>
    );
}

interface ThreadsActivityRow {
    /**
     * The room with unread threads.
     */
    room: Room;
    /**
     * The notification level.
     */
    notificationLevel: NotificationLevel;
    /**
     * Callback when the user clicks on the row.
     */
    onClick: () => void;
}

/**
 * Display a room with unread threads.
 */
function ThreadsActivityCentreRow({ room, onClick, notificationLevel }: ThreadsActivityRow): JSX.Element {
    return (
        <MenuItem
            className="mx_ThreadsActivityCentreRow"
            onSelect={(event: Event) => {
                onClick();

                // Set the right panel card for that room so the threads panel is open before we dispatch,
                // so it will open once the room appears.
                RightPanelStore.instance.setCard({ phase: RightPanelPhases.ThreadPanel }, true, room.roomId);

                // Track the click on the room
                PosthogTrackers.trackInteraction("WebThreadsActivityCentreRoomItem", event);

                // Display the selected room in the timeline
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    show_room_tile: true, // make sure the room is visible in the list
                    room_id: room.roomId,
                    metricsTrigger: "WebThreadsActivityCentre",
                    focusNext: "threadsPanel",
                });
            }}
            label={room.name}
            Icon={<DecoratedRoomAvatar room={room} size="32px" />}
        >
            <StatelessNotificationBadge level={notificationLevel} count={0} symbol={null} forceDot={true} />
        </MenuItem>
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
 * Display an unread thread the user has participated in.
 */
function ThreadsActivityCentreThreadRow({ threadData, onClick }: ThreadsActivityThreadRow): JSX.Element {
    const { thread, room, notificationLevel } = threadData;

    const rootEvent = thread.rootEvent;
    const senderId = rootEvent?.getSender() ?? "";
    const senderName = senderId ? (room.getMember(senderId)?.rawDisplayName ?? senderId) : "";
    const previewText = rootEvent?.getContent()?.body ?? "";

    return (
        <MenuItem
            className="mx_ThreadsActivityCentreRow mx_ThreadsActivityCentreThreadRow"
            // label={null} renders no label span; aria-label provides the accessible name.
            // hideChevron prevents compound's nav-hint from hiding our content on hover.
            label={null}
            hideChevron
            aria-label={senderName ? `${room.name}: ${senderName}: ${previewText}` : room.name}
            Icon={<DecoratedRoomAvatar room={room} size="32px" />}
            onSelect={(event: Event) => {
                onClick();

                // Open the specific thread in that room's right panel
                if (thread.rootEvent) {
                    RightPanelStore.instance.setCard(
                        { phase: RightPanelPhases.ThreadView, state: { threadHeadEvent: thread.rootEvent } },
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
                });
            }}
        >
            <div className="mx_ThreadsActivityCentreThreadRow_content">
                <div className="mx_ThreadsActivityCentreThreadRow_header">
                    <span className="mx_ThreadsActivityCentreThreadRow_roomName">{room.name}</span>
                    <StatelessNotificationBadge level={notificationLevel} count={0} symbol={null} forceDot={true} />
                </div>
                {(senderName || previewText) && (
                    <span className="mx_ThreadsActivityCentreThreadRow_preview">
                        {senderName && (
                            <span className="mx_ThreadsActivityCentreThreadRow_sender">{senderName}: </span>
                        )}
                        {previewText}
                    </span>
                )}
            </div>
        </MenuItem>
    );
}
