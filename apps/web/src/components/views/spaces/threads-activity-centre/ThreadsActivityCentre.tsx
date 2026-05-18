/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useState } from "react";
import { Menu, MenuItem, NavBar, NavItem } from "@vector-im/compound-web";
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
enum TACView {
    MyThreads = "my_threads",
    OtherThreads = "other_threads",
}

/**
 * Display in a popup the list of rooms with unread threads.
 * The popup is displayed when the user clicks on the `Threads` button.
 */
export function ThreadsActivityCentre({ displayButtonLabel }: ThreadsActivityCentreProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<TACView>(TACView.MyThreads);
    const roomsAndNotifications = useUnreadThreadRooms(open);

    const myThreadsEmptyCaption = _t("threads_activity_centre|no_participating_threads_unread");
    const otherThreadsEmptyCaption = _t("threads_activity_centre|no_other_unread_threads");

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
                <NavBar className="mx_ThreadsActivityCentre_tabs" role="tablist" aria-label={_t("threads_activity_centre|header")}>
                    <NavItem aria-controls="mx_ThreadsActivityCentre_panel" active={view === TACView.MyThreads} onClick={() => setView(TACView.MyThreads)}>
                        {_t("threads_activity_centre|my_threads_tab")}
                    </NavItem>
                    <NavItem aria-controls="mx_ThreadsActivityCentre_panel" active={view === TACView.OtherThreads} onClick={() => setView(TACView.OtherThreads)}>
                        {_t("threads_activity_centre|other_threads_tab")}
                    </NavItem>
                </NavBar>
                {/* Make the content of the pop-up scrollable */}
                <div id="mx_ThreadsActivityCentre_panel" role="tabpanel" className="mx_ThreadsActivityCentre_rows">
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
                                <div className="mx_ThreadsActivityCentre_emptyCaption">{myThreadsEmptyCaption}</div>
                            )}
                        </>
                    )}
                    {view === TACView.OtherThreads && (
                        <>
                            {roomsAndNotifications.otherThreads.map((threadData) => (
                                <ThreadsActivityCentreThreadRow
                                    key={`${threadData.room.roomId}:${threadData.thread.id}`}
                                    threadData={threadData}
                                    onClick={() => setOpen(false)}
                                />
                            ))}
                            {roomsAndNotifications.otherThreads.length === 0 && (
                                <div className="mx_ThreadsActivityCentre_emptyCaption">{otherThreadsEmptyCaption}</div>
                            )}
                        </>
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
            label={null}
            aria-label={senderName ? `${room.name}: ${senderName}: ${previewText}` : room.name}
            Icon={<DecoratedRoomAvatar room={room} size="40px" />}
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
            <StatelessNotificationBadge level={notificationLevel} count={0} symbol={null} forceDot={true} />
        </MenuItem>
    );
}
