/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, type JSX } from "react";

import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { _t } from "../../../../languageHandler";
import { RoomListItemView } from "./RoomListItemView";
import { ListContext, ListView } from "../../../utils/ListView";
import { Room } from "matrix-js-sdk/src/matrix";

interface RoomListProps {
    /**
     * The view model state for the room list.
     */
    vm: RoomListViewState;
}

/**
 * A virtualized list of rooms.
 */
export function RoomList({ vm: { rooms, activeIndex } }: RoomListProps): JSX.Element {
    const getItemComponent = useCallback(
        (index: number, item: Room, context: ListContext<any>): JSX.Element => {
            const itemKey = item.roomId;
            const isRovingItem = itemKey === context.tabIndexKey;
            const isFocused = isRovingItem && context.focused;
            const isSelected = activeIndex === index;
            return (
                <RoomListItemView
                    room={item}
                    key={itemKey}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    tabIndex={isRovingItem ? 0 : -1}
                />
            );
        },
        [rooms, activeIndex],
    );

    const getItemKey = useCallback((item: Room): string => {
        return item.roomId;
    }, []);

    // The first div is needed to make the virtualized list take all the remaining space and scroll correctly
    return (
        <ListView
            data-testid="room-list"
            role="grid"
            aria-label={_t("room_list|list_title")}
            fixedItemHeight={48}
            items={rooms}
            getItemComponent={getItemComponent}
            getItemKey={getItemKey}
            isItemFocusable={() => true}
        />
    );
}
