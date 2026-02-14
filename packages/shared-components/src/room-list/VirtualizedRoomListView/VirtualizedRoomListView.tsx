/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useMemo, useRef, type JSX, type ReactNode } from "react";
import { type ScrollIntoViewLocation } from "react-virtuoso";
import { isEqual } from "lodash";

import { RoomListItemView, type Room } from "../RoomListItemView";
import { useViewModel } from "../../viewmodel";
import { _t } from "../../utils/i18n";
import { VirtualizedList, type VirtualizedListContext } from "../../utils/VirtualizedList";
import type { RoomListViewModel } from "../RoomListView";

/**
 * Filter key type - opaque string type for filter identifiers
 */
export type FilterKey = string;

/**
 * State for the room list data (nested within RoomListSnapshot)
 */
export interface RoomListViewState {
    /** Optional active room index for keyboard navigation */
    activeRoomIndex?: number;
    /** Space ID for context tracking */
    spaceId?: string;
    /** Active filter keys for context tracking */
    filterKeys?: FilterKey[];
}

/**
 * Props for the VirtualizedRoomListView component
 */
export interface VirtualizedRoomListViewProps {
    /**
     * The view model containing all room list data and callbacks
     */
    vm: RoomListViewModel;

    /**
     * Render function for room avatar
     * @param room - The opaque Room object from the client
     */
    renderAvatar: (room: Room) => ReactNode;

    /**
     * Optional callback for keyboard key down events
     */
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

/** Height of a single room list item in pixels (44px item + 8px gap) */
const ROOM_LIST_ITEM_HEIGHT = 52;

/**
 * Type for context used in ListView
 */
type Context = { spaceId: string; filterKeys: FilterKey[] | undefined };

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
 * and renders RoomListItemView components for each room.
 *
 * @example
 * ```tsx
 * <VirtualizedRoomListView vm={roomListViewModel} renderAvatar={(room) => <Avatar room={room} />} />
 * ```
 */
export function VirtualizedRoomListView({ vm, renderAvatar, onKeyDown }: VirtualizedRoomListViewProps): JSX.Element {
    const snapshot = useViewModel(vm);
    const { roomListState, roomIds } = snapshot;
    const activeRoomIndex = roomListState.activeRoomIndex;
    const lastSpaceId = useRef<string | undefined>(undefined);
    const lastFilterKeys = useRef<FilterKey[] | undefined>(undefined);
    const roomCount = roomIds.length;

    /**
     * Callback when the visible range changes
     * Notifies the view model which rooms are visible
     */
    const rangeChanged = useCallback(
        (range: { startIndex: number; endIndex: number }) => {
            vm.updateVisibleRooms(range.startIndex, range.endIndex);
        },
        [vm],
    );

    /**
     * Get the item component for a specific index
     * Gets the room's view model and passes it to RoomListItemView
     */
    const getItemComponent = useCallback(
        (
            index: number,
            roomId: string,
            context: VirtualizedListContext<Context>,
            onFocus: (item: string, e: React.FocusEvent) => void,
        ): JSX.Element => {
            const isSelected = activeRoomIndex === index;
            const roomItemVM = vm.getRoomItemViewModel(roomId);

            // Item is focused when the list has focus AND this item's key matches tabIndexKey
            // This matches the old RoomList implementation's roving tabindex pattern
            const isFocused = context.focused && context.tabIndexKey === roomId;

            return (
                <RoomListItemView
                    key={roomId}
                    vm={roomItemVM}
                    renderAvatar={renderAvatar}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    onFocus={onFocus}
                    roomIndex={index}
                    roomCount={roomCount}
                />
            );
        },
        [activeRoomIndex, roomCount, renderAvatar, vm],
    );

    /**
     * Get the key for a room item
     * Since we're using virtualization, items are always room ID strings
     */
    const getItemKey = useCallback((item: string): string => {
        return item;
    }, []);

    const context = useMemo(
        () => ({ spaceId: roomListState.spaceId || "", filterKeys: roomListState.filterKeys }),
        [roomListState.spaceId, roomListState.filterKeys],
    );

    /**
     * Determine if we should scroll the active index into view
     * This happens when the space or filters change
     */
    const scrollIntoViewOnChange = useCallback(
        (params: {
            context: VirtualizedListContext<{ spaceId: string; filterKeys: FilterKey[] | undefined }>;
        }): ScrollIntoViewLocation | null | undefined | false => {
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

    return (
        <VirtualizedList
            context={context}
            scrollIntoViewOnChange={scrollIntoViewOnChange}
            initialTopMostItemIndex={activeRoomIndex}
            data-testid="room-list"
            role="listbox"
            aria-label={_t("room_list|list_title")}
            fixedItemHeight={ROOM_LIST_ITEM_HEIGHT}
            items={roomIds}
            getItemComponent={getItemComponent}
            getItemKey={getItemKey}
            isItemFocusable={() => true}
            rangeChanged={rangeChanged}
            onKeyDown={onKeyDown}
            increaseViewportBy={{
                bottom: EXTENDED_VIEWPORT_HEIGHT,
                top: EXTENDED_VIEWPORT_HEIGHT,
            }}
        />
    );
}
