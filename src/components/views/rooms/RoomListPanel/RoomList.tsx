/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { type VirtuosoHandle } from "react-virtuoso";
import { type Room } from "matrix-js-sdk/src/matrix";

import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { _t } from "../../../../languageHandler";
import { RoomListItemView } from "./RoomListItemView";
import { type ListContext, ListView } from "../../../utils/ListView";

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
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const lastRoomsCount = useRef<number | undefined>(undefined);
    const lastActiveIndex = useRef<number | undefined>(undefined);
    const [activeIndexInternal, setActiveIndexInternal] = useState<number | undefined>(undefined);
    const getItemComponent = useCallback(
        (index: number, item: Room, context: ListContext<any>, onFocus: (e: React.FocusEvent) => void): JSX.Element => {
            const itemKey = item.roomId;
            const isRovingItem = itemKey === context.tabIndexKey;
            const isFocused = isRovingItem && context.focused;
            const isSelected = activeIndexInternal === index;
            return (
                <RoomListItemView
                    room={item}
                    key={itemKey}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    tabIndex={isRovingItem ? 0 : -1}
                    onFocus={onFocus}
                />
            );
        },
        [activeIndexInternal],
    );

    const getItemKey = useCallback((item: Room): string => {
        return item.roomId;
    }, []);

    useEffect(() => {
        // When the rooms length or active index changes(from changing the space, filter, etc), scroll to the active room,
        // or the top of the list if the active room is no longer in the list.
        if (
            rooms.length != undefined &&
            virtuosoRef.current &&
            (lastRoomsCount.current !== rooms.length || lastActiveIndex.current !== activeIndex)
        ) {
            virtuosoRef.current.scrollIntoView({
                align: `start`,
                index: activeIndex || 0,
                behavior: "auto",
                targetsNextRefresh: true,
            });
        }
        lastRoomsCount.current = rooms.length;
        lastActiveIndex.current = activeIndex;
        // targetsNextRefresh affects the next update so we store activeIndex in state here to force a re-render
        setActiveIndexInternal(activeIndex);
    }, [activeIndex, rooms.length]); // Dependencies that should trigger the scroll

    return (
        <ListView
            ref={virtuosoRef}
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
