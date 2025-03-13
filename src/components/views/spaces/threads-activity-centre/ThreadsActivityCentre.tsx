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
import { useUnreadThreadRooms } from "./useUnreadThreadRooms";
import { StatelessNotificationBadge } from "../../rooms/NotificationBadge/StatelessNotificationBadge";
import { type NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import PosthogTrackers from "../../../../PosthogTrackers";
import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import { ReleaseAnnouncement } from "../../../structures/ReleaseAnnouncement";
import { useIsReleaseAnnouncementOpen } from "../../../../hooks/useIsReleaseAnnouncementOpen";
import { useSettingValue } from "../../../../hooks/useSettings";
import { ReleaseAnnouncementStore } from "../../../../stores/ReleaseAnnouncementStore";

interface ThreadsActivityCentreProps {
    /**
     * Display the `Treads` label next to the icon.
     */
    displayButtonLabel?: boolean;
}

/**
 * Display in a popup the list of rooms with unread threads.
 * The popup is displayed when the user clicks on the `Threads` button.
 */
export function ThreadsActivityCentre({ displayButtonLabel }: ThreadsActivityCentreProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const roomsAndNotifications = useUnreadThreadRooms(open);
    const isReleaseAnnouncementOpen = useIsReleaseAnnouncementOpen("threadsActivityCentre");
    const settingTACOnlyNotifs = useSettingValue("Notifications.tac_only_notifications");

    const emptyCaption = settingTACOnlyNotifs
        ? _t("threads_activity_centre|no_rooms_with_threads_notifs")
        : _t("threads_activity_centre|no_rooms_with_unread_threads");

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
            {isReleaseAnnouncementOpen ? (
                <ReleaseAnnouncement
                    feature="threadsActivityCentre"
                    header={_t("threads_activity_centre|release_announcement_header")}
                    description={_t("threads_activity_centre|release_announcement_description")}
                    closeLabel={_t("action|ok")}
                >
                    <ThreadsActivityCentreButton
                        disableTooltip={true}
                        displayLabel={displayButtonLabel}
                        notificationLevel={roomsAndNotifications.greatestNotificationLevel}
                        onClick={async () => {
                            // Open the TAC after the release announcement closing
                            setOpen(true);
                            await ReleaseAnnouncementStore.instance.nextReleaseAnnouncement();
                        }}
                    />
                </ReleaseAnnouncement>
            ) : (
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
                    {/* Make the content of the pop-up scrollable */}
                    <div className="mx_ThreadsActivityCentre_rows">
                        {roomsAndNotifications.rooms.map(({ room, notificationLevel }) => (
                            <ThreadsActivityCentreRow
                                key={room.roomId}
                                room={room}
                                notificationLevel={notificationLevel}
                                onClick={() => setOpen(false)}
                            />
                        ))}
                        {roomsAndNotifications.rooms.length === 0 && (
                            <div className="mx_ThreadsActivityCentre_emptyCaption">{emptyCaption}</div>
                        )}
                    </div>
                </Menu>
            )}
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
