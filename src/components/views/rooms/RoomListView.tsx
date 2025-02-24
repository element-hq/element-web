/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useState } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import RoomListStoreV3 from "../../../stores/room-list-v3/RoomListStoreV3";
import { LISTS_UPDATE_EVENT } from "../../../stores/room-list/SlidingRoomListStore";

type IProps = unknown;

export const RoomListView: React.FC<IProps> = (props: IProps) => {
    const [rooms, setRooms] = useState<Room[]>(RoomListStoreV3.instance.getSortedRooms());
    useEffect(() => {
        RoomListStoreV3.instance.on(LISTS_UPDATE_EVENT, () => {
            const newRooms = RoomListStoreV3.instance.getSortedRooms();
            setRooms(() => newRooms);
        });
    }, []);
    return (
        <div>
            {rooms.map((r) => (
                <div>{r.name}</div>
            ))}
        </div>
    );
};
