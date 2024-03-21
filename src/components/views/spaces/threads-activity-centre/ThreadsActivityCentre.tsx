/*
 *
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

import React, { JSX, useState } from "react";
import { Menu, MenuItem } from "@vector-im/compound-web";
import { Room } from "matrix-js-sdk/src/matrix";

import { ThreadsActivityCentreButton } from "./ThreadsActivityCentreButton";
import { _t } from "../../../../languageHandler";
import DecoratedRoomAvatar from "../../avatars/DecoratedRoomAvatar";
import { Action } from "../../../../dispatcher/actions";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import RightPanelStore from "../../../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../stores/right-panel/RightPanelStorePhases";
import { useUnreadThreadRooms } from "./useUnreadThreadRooms";
import { StatelessNotificationBadge } from "../../rooms/NotificationBadge/StatelessNotificationBadge";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
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
 * Display in a popup the list of rooms with unread threads.
 * The popup is displayed when the user clicks on the `Threads` button.
 */
export function ThreadsActivityCentre({ displayButtonLabel }: ThreadsActivityCentreProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const roomsAndNotifications = useUnreadThreadRooms(open);

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
                align="end"
                open={open}
                onOpenChange={(newOpen) => {
                    // Track only when the Threads Activity Centre is opened
                    if (newOpen) PosthogTrackers.trackInteraction("WebThreadsActivityCentreButton");

                    setOpen(newOpen);
                }}
                side="right"
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
                        <div className="mx_ThreadsActivityCentre_emptyCaption">
                            {_t("threads_activity_centre|no_rooms_with_unreads_threads")}
                        </div>
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
                });
            }}
            label={room.name}
            Icon={<DecoratedRoomAvatar room={room} size="32px" />}
        >
            <StatelessNotificationBadge level={notificationLevel} count={0} symbol={null} forceDot={true} />
        </MenuItem>
    );
}
