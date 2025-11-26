/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useMemo, type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { RoomList as SharedRoomList, type RoomsResult, type FilterKey } from "@element-hq/web-shared-components";

import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { _t } from "../../../../languageHandler";
import { RoomListItemView } from "./RoomListItemView";
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
 * Room adapter that wraps Matrix Room objects with an id property for the shared component
 */
interface RoomAdapter {
    id: string;
    room: Room;
}

/**
 * A virtualized list of rooms.
 * This component adapts element-web's room list to use the shared RoomList component.
 */
export function RoomList({ vm: { roomsResult, activeIndex } }: RoomListProps): JSX.Element {
    const roomCount = roomsResult.rooms.length;

    /**
     * Adapt the element-web roomsResult to the shared component's format
     */
    const adaptedRoomsResult: RoomsResult<RoomAdapter> = useMemo(
        () => ({
            spaceId: roomsResult.spaceId,
            filterKeys: roomsResult.filterKeys as FilterKey[] | undefined,
            rooms: roomsResult.rooms.map((room) => ({
                id: room.roomId,
                room,
            })),
        }),
        [roomsResult],
    );

    /**
     * Render a room item using the RoomListItemView
     */
    const renderItem = useCallback(
        (
            index: number,
            item: RoomAdapter,
            isSelected: boolean,
            isFocused: boolean,
            tabIndex: number,
            roomCount: number,
            onFocus: (item: RoomAdapter, e: React.FocusEvent) => void,
        ): React.ReactNode => {
            return (
                <RoomListItemView
                    room={item.room}
                    key={item.id}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    tabIndex={tabIndex}
                    roomIndex={index}
                    roomCount={roomCount}
                    onFocus={(room, e) => onFocus(item, e)}
                />
            );
        },
        [],
    );

    /**
     * Handle keyboard events for landmark navigation
     */
    const keyDownCallback = useCallback((ev: React.KeyboardEvent) => {
        const navAction = getKeyBindingsManager().getNavigationAction(ev);
        if (navAction === KeyBindingAction.NextLandmark || navAction === KeyBindingAction.PreviousLandmark) {
            LandmarkNavigation.findAndFocusNextLandmark(
                Landmark.ROOM_LIST,
                navAction === KeyBindingAction.PreviousLandmark,
            );
            ev.stopPropagation();
            ev.preventDefault();
            return;
        }
    }, []);

    return (
        <SharedRoomList
            roomsResult={adaptedRoomsResult}
            activeIndex={activeIndex}
            renderItem={renderItem}
            onKeyDown={keyDownCallback}
            ariaLabel={_t("room_list|list_title")}
        />
    );
}
