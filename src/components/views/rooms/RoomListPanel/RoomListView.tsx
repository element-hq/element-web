/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import { useRoomListViewModel } from "../../../viewmodels/roomlist/RoomListViewModel";
import { RoomList } from "./RoomList";
import { EmptyRoomList } from "./EmptyRoomList";
import { RoomListPrimaryFilters } from "./RoomListPrimaryFilters";
import { _t } from "../../../../languageHandler";
import { ReleaseAnnouncement } from "../../../structures/ReleaseAnnouncement";

/**
 * Host the room list and the (future) room filters
 */
export function RoomListView(): JSX.Element {
    const vm = useRoomListViewModel();
    const isRoomListEmpty = vm.roomsResult.rooms.length === 0;
    let listBody;
    if (vm.isLoadingRooms) {
        listBody = <div className="mx_RoomListSkeleton" />;
    } else if (isRoomListEmpty) {
        listBody = <EmptyRoomList vm={vm} />;
    } else {
        listBody = <RoomList vm={vm} />;
    }
    return (
        <>
            <ReleaseAnnouncement
                feature="newRoomList_filter"
                header={_t("room_list|release_announcement|filter|title")}
                description={_t("room_list|release_announcement|filter|description")}
                closeLabel={_t("room_list|release_announcement|next")}
                placement="right"
            >
                <div>
                    <RoomListPrimaryFilters vm={vm} />
                </div>
            </ReleaseAnnouncement>
            {listBody}
        </>
    );
}
