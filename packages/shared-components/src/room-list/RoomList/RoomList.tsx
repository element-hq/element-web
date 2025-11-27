/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useRef, type JSX, type ReactNode } from "react";
import { type ScrollIntoViewLocation } from "react-virtuoso";
import { isEqual } from "lodash";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import { _t } from "../../utils/i18n";
import { ListView, type ListContext } from "../../utils/ListView";
import { RoomListItem, type RoomListItemViewModel } from "../RoomListItem";

/**
 * Filter key type - opaque string type for filter identifiers
 */
export type FilterKey = string;

/**
 * Represents the result of a room query
 */
export interface RoomsResult {
    /** The ID of the current space */
    spaceId: string;
    /** Active filter keys */
    filterKeys: FilterKey[] | undefined;
    /** Array of room item view models */
    rooms: RoomListItemViewModel[];
}

/**
 * Snapshot for RoomList
 */
export type RoomListSnapshot = {
    /** The rooms result containing the list of rooms */
    roomsResult: RoomsResult;
    /** Optional active room index */
    activeRoomIndex?: number;
    /** Optional keyboard event handler */
    onKeyDown?: (ev: React.KeyboardEvent) => void;
};

/**
 * Props for the RoomList component
 */
export interface RoomListProps {
    /**
     * The view model containing room list data
     */
    vm: ViewModel<RoomListSnapshot>;

    /**
     * Render function for room avatar
     * @param roomViewModel - The room item view model
     */
    renderAvatar: (roomViewModel: RoomListItemViewModel) => ReactNode;
}

/** Height of a single room list item in pixels */
const ROOM_LIST_ITEM_HEIGHT = 48;

/**
 * Amount to extend the top and bottom of the viewport by.
 * From manual testing and user feedback 25 items is reported to be enough to avoid blank space
 * when using the mouse wheel, and the trackpad scrolling at a slow to moderate speed where you
 * can still see/read the content. Using the trackpad to sling through a large percentage of the
 * list quickly will still show blank space. We would likely need to simplify the item content to
 * improve this case.
 */
const EXTENDED_VIEWPORT_HEIGHT = 25 * ROOM_LIST_ITEM_HEIGHT;

/**
 * A virtualized list of rooms.
 * This component provides efficient rendering of large room lists using virtualization,
 * and renders RoomListItem components for each room.
 */
export function RoomList({ vm, renderAvatar }: RoomListProps): JSX.Element {
    const snapshot = useViewModel(vm);
    const { roomsResult, activeRoomIndex, onKeyDown } = snapshot;
    const lastSpaceId = useRef<string | undefined>(undefined);
    const lastFilterKeys = useRef<FilterKey[] | undefined>(undefined);
    const roomCount = roomsResult.rooms.length;

    /**
     * Get the item component for a specific index
     */
    const getItemComponent = useCallback(
        (
            index: number,
            item: RoomListItemViewModel,
            context: ListContext<{
                spaceId: string;
                filterKeys: FilterKey[] | undefined;
            }>,
            onFocus: (item: RoomListItemViewModel, e: React.FocusEvent) => void,
        ): JSX.Element => {
            const itemKey = item.id;
            const isRovingItem = itemKey === context.tabIndexKey;
            const isFocused = isRovingItem && context.focused;
            const isSelected = activeRoomIndex === index;

            return (
                <div key={itemKey}>
                    <RoomListItem
                        viewModel={item}
                        isSelected={isSelected}
                        isFocused={isFocused}
                        onFocus={(e) => onFocus(item, e)}
                        roomIndex={index}
                        roomCount={roomCount}
                        avatar={renderAvatar(item)}
                    />
                </div>
            );
        },
        [activeRoomIndex, roomCount, renderAvatar],
    );

    /**
     * Get the key for a room item
     */
    const getItemKey = useCallback((item: RoomListItemViewModel): string => {
        return item.id;
    }, []);

    /**
     * Determine if we should scroll the active index into view
     * This happens when the space or filters change
     */
    const scrollIntoViewOnChange = useCallback(
        (params: {
            context: ListContext<{ spaceId: string; filterKeys: FilterKey[] | undefined }>;
        }): ScrollIntoViewLocation | null | undefined | false | void => {
            const { spaceId, filterKeys } = params.context.context;
            const shouldScrollIndexIntoView =
                lastSpaceId.current !== spaceId || !isEqual(lastFilterKeys.current, filterKeys);
            lastFilterKeys.current = filterKeys;
            lastSpaceId.current = spaceId;

            if (shouldScrollIndexIntoView) {
                return {
                    align: "start",
                    index: activeRoomIndex || 0,
                    behavior: "auto",
                };
            }
            return false;
        },
        [activeRoomIndex],
    );

    /**
     * Handle keyboard events
     */
    const keyDownCallback = useCallback(
        (ev: React.KeyboardEvent): void => {
            onKeyDown?.(ev);
        },
        [onKeyDown],
    );

    return (
        <ListView
            context={{ spaceId: roomsResult.spaceId, filterKeys: roomsResult.filterKeys }}
            scrollIntoViewOnChange={scrollIntoViewOnChange}
            initialTopMostItemIndex={activeRoomIndex}
            data-testid="room-list"
            role="listbox"
            aria-label={_t("room_list|list_title")}
            fixedItemHeight={ROOM_LIST_ITEM_HEIGHT}
            items={roomsResult.rooms}
            getItemComponent={getItemComponent}
            getItemKey={getItemKey}
            isItemFocusable={() => true}
            onKeyDown={keyDownCallback}
            increaseViewportBy={{
                bottom: EXTENDED_VIEWPORT_HEIGHT,
                top: EXTENDED_VIEWPORT_HEIGHT,
            }}
        />
    );
}
