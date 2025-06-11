/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback, useEffect, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { type Room } from "matrix-js-sdk/src/matrix";

import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { _t } from "../../../../languageHandler";
import { RoomListItemView } from "./RoomListItemView";
import { RovingTabIndexProvider } from "../../../../accessibility/RovingTabIndex";
import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import { Landmark, LandmarkNavigation } from "../../../../accessibility/LandmarkNavigation";

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
    const scrollerRef = useCallback((node: HTMLElement | Window | null) => {
        if (node instanceof HTMLElement) {
            node.firstElementChild?.setAttribute("role", "row");
        }
    }, []);

    // Scroll to the current room when we switch between spaces
    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    useEffect(() => {
        if (!virtuosoRef.current) return;

        // Without setTimeout, the scrollToIndex does nothing when the space change
        setTimeout(() => virtuosoRef.current?.scrollToIndex(currentRoomIndex ?? 0), 0);
    }, [currentRoomIndex]);

    return (
        <RovingTabIndexProvider handleHomeEnd={true} handleUpDown={true}>
            {({ onKeyDownHandler }) => (
                <Virtuoso<Room, { currentRoomIndex?: number }>
                    data-testid="room-list"
                    role="grid"
                    aria-label={_t("room_list|list_title")}
                    aria-rowcount={1}
                    aria-colcount={1}
                    style={{ flex: 1 }}
                    data={rooms}
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
                    computeItemKey={(index, room) => room.roomId}
                    /* 240px = 5 rows */
                    increaseViewportBy={240}
                    initialTopMostItemIndex={currentRoomIndex ?? 0}
                    ref={virtuosoRef}
                    scrollerRef={scrollerRef}
                    onKeyDown={(ev) => {
                        const navAction = getKeyBindingsManager().getNavigationAction(ev);
                        if (
                            navAction === KeyBindingAction.NextLandmark ||
                            navAction === KeyBindingAction.PreviousLandmark
                        ) {
                            LandmarkNavigation.findAndFocusNextLandmark(
                                Landmark.ROOM_LIST,
                                navAction === KeyBindingAction.PreviousLandmark,
                            );
                            ev.stopPropagation();
                            ev.preventDefault();
                            return;
                        }
                        onKeyDownHandler(ev);
                    }}
                />
            )}
        </RovingTabIndexProvider>
    );
}
