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
import { RovingTabIndexProvider } from "../../../../accessibility/RovingTabIndex";
import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import { Landmark, LandmarkNavigation } from "../../../../accessibility/LandmarkNavigation";
import { useEventEmitterState } from "../../../../hooks/useEventEmitter";
import { type SpaceKey, UPDATE_SELECTED_SPACE } from "../../../../stores/spaces";
import SpaceStore from "../../../../stores/spaces/SpaceStore";

interface RoomListProps {
    /**
     * The view model state for the room list.
     */
    vm: RoomListViewState;
}

/**
 * A virtualized list of rooms.
 */
export function RoomList({ vm: { rooms, activeIndex: currentRoomIndex } }: RoomListProps): JSX.Element {
    // To follow the grid pattern (https://www.w3.org/WAI/ARIA/apg/patterns/grid/), we need to set the first element of the list as a row.
    // The virtuoso component is set to role="grid" and the items are set to role="gridcell".
    // TODO REPLACE WITH A CUSToM LIST COMPONENT
    const scrollerRef = useCallback((node: HTMLElement | Window | null) => {
        if (node instanceof HTMLElement) {
            node.firstElementChild?.setAttribute("role", "row");
        }
    }, []);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    // UNCOMMENT IF YOU WANT SCROLLING TO THE CURRENT ROOM INDEX
    // USE THIS OR THE KEY ON VIRTUOSO, NOT BOTH
    // useEffect(() => {
    //     console.log("virtuoso useEffect: currentRoomIndex changed to", currentRoomIndex, "rooms", rooms.length);
    //     if (!virtuosoRef.current) return;
    //
    //     console.log("virtuoso scrolling to current room index:", currentRoomIndex);
    //
    //     virtuosoRef.current?.scrollIntoView({
    //         index: currentRoomIndex || 0,
    //         behavior: "auto",
    //     });
    //
    //     // DATA AND INDEX CHANGES AT THE SAME TIME, WE NEED TO WAIT TO SET THE DATA FIRST
    //     // setTimeout(() => {
    //     //     virtuosoRef.current?.scrollIntoView({
    //     //         index: currentRoomIndex || 0,
    //     //         behavior: "auto",
    //     //     });
    //     // }, 0);
    // }, [rooms, currentRoomIndex]);

    // Mound and unmount the virtuoso component when the space changes.
    // We listen the rooms array to detect changes in the space because we want the rooms to be updated when the space changes.
    // If only the room changes, the space key will not change, so we can keep the same virtuoso component.
    // MOUNT AND UNMOUNT CREATE A VISUAL GLITCH
    const currentSpaceRef = useRef(SpaceStore.instance.activeSpace);
    const [currentSpaceKey, setCurrentSpaceKey] = useState(SpaceStore.instance.activeSpace);
    useEffect(() => {
        const newSpace = SpaceStore.instance.activeSpace;
        if (currentSpaceRef.current !== newSpace) {
            setCurrentSpaceKey(newSpace);
            currentSpaceRef.current = newSpace;
        }
    }, [rooms]);

    console.log("virtuoso key:", currentSpaceKey, "currentRoomIndex:", currentRoomIndex, "rooms:", rooms.length);

    useEffect(() => {
        console.log("mounted virtuoso with spaceKey:", currentSpaceKey);
        return () => {
            console.log("unmounted virtuoso with spaceKey:", currentSpaceKey);
        };
    }, [currentSpaceKey]);

    return (
        //   <RovingTabIndexProvider handleHomeEnd={true} handleUpDown={true}>
        //  {({ onKeyDownHandler }) => (
        <Virtuoso
            key={currentSpaceKey}
            data-testid="room-list"
            role="grid"
            aria-label={_t("room_list|list_title")}
            aria-rowcount={1}
            aria-colcount={1}
            style={{ flex: 1 }}
            totalCount={rooms.length}
            fixedItemHeight={48}
            context={{ currentRoomIndex }}
            itemContent={(index, _room, { currentRoomIndex }) => (
                <RoomListItemView
                    room={rooms[index]}
                    isSelected={currentRoomIndex === index}
                    aria-colindex={index}
                    role="gridcell"
                />
            )}
            computeItemKey={(index) => rooms[index].roomId}
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
