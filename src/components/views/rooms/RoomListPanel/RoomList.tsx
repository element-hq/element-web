/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useRef, type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { type ScrollIntoViewLocation } from "react-virtuoso";

import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { _t } from "../../../../languageHandler";
import { RoomListItemView } from "./RoomListItemView";
import { type ListContext, ListView } from "../../../utils/ListView";
import { type PrimaryFilter } from "../../../viewmodels/roomlist/useFilteredRooms";

interface RoomListProps {
    /**
     * The view model state for the room list.
     */
    vm: RoomListViewState;
}

/**
 * A virtualized list of rooms.
 */
export function RoomList({ vm: { roomsState: rooms, activeIndex, activePrimaryFilter } }: RoomListProps): JSX.Element {
    const lastSpaceId = useRef<string | undefined>(undefined);
    const lastActivePrimaryFilter = useRef<PrimaryFilter | undefined>(undefined);
    const roomCount = rooms.rooms.length;
    const getItemComponent = useCallback(
        (
            index: number,
            item: Room,
            context: ListContext<{
                spaceId: string;
                activePrimaryFilter: PrimaryFilter | undefined;
            }>,
            onFocus: (e: React.FocusEvent) => void,
        ): JSX.Element => {
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
                    roomIndex={index}
                    roomCount={roomCount}
                    onFocus={onFocus}
                />
            );
        },
        [activeIndex, roomCount],
    );

    const getItemKey = useCallback((item: Room): string => {
        return item.roomId;
    }, []);

    const scrollIntoViewOnChange = useCallback(
        (params: {
            context: ListContext<{ spaceId: string; activePrimaryFilter: PrimaryFilter | undefined }>;
        }): ScrollIntoViewLocation | null | undefined | false | void => {
            const { spaceId, activePrimaryFilter } = params.context.context;
            const shouldScrollIndexIntoView =
                lastSpaceId.current !== spaceId || lastActivePrimaryFilter.current !== activePrimaryFilter;
            lastActivePrimaryFilter.current = activePrimaryFilter;
            lastSpaceId.current = spaceId;

            if (shouldScrollIndexIntoView) {
                return {
                    align: `start`,
                    index: activeIndex || 0,
                    behavior: "auto",
                };
            }
            return false;
        },
        [activeIndex],
    );

    return (
        <ListView
            context={{ spaceId: rooms.spaceId, activePrimaryFilter }}
            scrollIntoViewOnChange={scrollIntoViewOnChange}
            initialTopMostItemIndex={activeIndex}
            data-testid="room-list"
            role="listbox"
            aria-label={_t("room_list|list_title")}
            fixedItemHeight={48}
            items={rooms.rooms}
            getItemComponent={getItemComponent}
            getItemKey={getItemKey}
            isItemFocusable={() => true}
        />
    );
}
