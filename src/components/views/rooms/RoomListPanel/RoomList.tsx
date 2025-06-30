/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { type Room } from "matrix-js-sdk/src/matrix";

import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { _t } from "../../../../languageHandler";
import { RoomListItemView } from "./RoomListItemView";

interface RoomListProps {
    /**
     * The view model state for the room list.
     */
    vm: RoomListViewState;
}


type RoomListState = {
    currentRoomIndex: number | undefined;
    rooms: Room[];
    spaceId: string;
};

/**
 * A virtualized list of rooms.
 */
export function RoomList({ vm: { rooms, activeIndex: currentRoomIndex, spaceId } }: RoomListProps): JSX.Element {
    // To follow the grid pattern (https://www.w3.org/WAI/ARIA/apg/patterns/grid/), we need to set the first element of the list as a row.
    // The virtuoso component is set to role="grid" and the items are set to role="gridcell".
    // TODO REPLACE WITH A CUSToM LIST COMPONENT
    const scrollerRef = useCallback((node: HTMLElement | Window | null) => {
        if (node instanceof HTMLElement) {
            node.firstElementChild?.setAttribute("role", "row");
        }
    }, []);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    const [roomListState, setRoomListState] = useState<RoomListState>({ currentRoomIndex, rooms, spaceId});

    useEffect(() => {
        // TODO: this logic is not correct, but was introduced so that we change the spaceId and the rooms at the same time.
        // Ideally the props should be updated in a valid way(we don't have a mismatched spaceId/rooms being passed in).
        if(roomListState.spaceId !== spaceId && roomListState.rooms.length !== rooms.length) {
            virtuosoRef.current?.scrollIntoView({
                align: `start`,
                index: currentRoomIndex || 0,
                behavior: "auto",
                targetsNextRefresh: true,
            });
            setRoomListState({ ...roomListState, rooms, spaceId, currentRoomIndex});
        }
    
    }, [spaceId, rooms, currentRoomIndex, roomListState]);
   
    return (
        //   <RovingTabIndexProvider handleHomeEnd={true} handleUpDown={true}>
        //  {({ onKeyDownHandler }) => (
        <Virtuoso
            // key={spaceId}
            data-testid="room-list"
            role="grid"
            aria-label={_t("room_list|list_title")}
            aria-rowcount={1}
            aria-colcount={1}
            totalCount={roomListState.rooms.length}
            data={roomListState.rooms}
            fixedItemHeight={48}
            context={{ currentRoomIndex: roomListState.currentRoomIndex }}
            itemContent={(index, room, { currentRoomIndex }) => (
                <RoomListItemView
                    room={room}
                    isSelected={currentRoomIndex === index}
                    aria-colindex={index}
                    role="gridcell"
                />
            )}
            computeItemKey={(index, item ) => item.roomId}
            /* 240px = 5 rows */
            increaseViewportBy={240}
            initialTopMostItemIndex={currentRoomIndex ?? 0}
            ref={virtuosoRef}
            scrollerRef={scrollerRef}
            // onKeyDown={(ev) => {
            //     const navAction = getKeyBindingsManager().getNavigationAction(ev);
            //     if (
            //         navAction === KeyBindingAction.NextLandmark ||
            //         navAction === KeyBindingAction.PreviousLandmark
            //     ) {
            //         LandmarkNavigation.findAndFocusNextLandmark(
            //             Landmark.ROOM_LIST,
            //             navAction === KeyBindingAction.PreviousLandmark,
            //         );
            //         ev.stopPropagation();
            //         ev.preventDefault();
            //         return;
            //     }
            //     onKeyDownHandler(ev);
            // }}
        />
        //   )}
        //    </RovingTabIndexProvider>
    );
}
