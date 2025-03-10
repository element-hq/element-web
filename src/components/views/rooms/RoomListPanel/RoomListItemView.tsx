/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import { Flex } from "../../../utils/Flex";
import DecoratedRoomAvatar from "../../avatars/DecoratedRoomAvatar";

interface RoomListItemViewPropsProps extends React.HTMLAttributes<HTMLButtonElement> {
    /**
     * The room to display
     */
    room: Room;
}

/**
 * An item in the room list
 */
export function RoomListItemView({ room, ...props }: RoomListItemViewPropsProps): JSX.Element {
    return (
        <button
            className="mx_RoomListItemView"
            type="button"
            aria-label={_t("room_list|room|open_room", { roomName: room.name })}
            {...props}
        >
            {/* We need this extra div between the button and the content in order to add a padding which is not messing with the virtualized list */}
            <Flex className="mx_RoomListItemView_container" gap="var(--cpd-space-3x)" align="center">
                <DecoratedRoomAvatar room={room} size="32px" />
                <Flex className="mx_RoomListItemView_content" align="center">
                    {/* We truncate the room name when too long. Title here is to show the full name on hover */}
                    <span title={room.name}>{room.name}</span>
                    {/* Future hover menu et notification badges */}
                </Flex>
            </Flex>
        </button>
    );
}
