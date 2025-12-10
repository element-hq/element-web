/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useRef, type JSX, type ReactNode } from "react";
import { type ScrollIntoViewLocation } from "react-virtuoso";
import { isEqual } from "lodash";

import { useViewModel } from "../../useViewModel";
import { _t } from "../../utils/i18n";
import { ListView, type ListContext } from "../../utils/ListView";
import { RoomListItemView, type RoomListItem } from "../RoomListItem";
import { type RoomNotifState } from "../../notifications/RoomNotifs";
import type { RoomListViewModel } from "../RoomListView";

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
    /** Array of room items */
    rooms: RoomListItem[];
}

/**
 * State for the room list data (nested within RoomListSnapshot)
 */
export interface RoomListViewState {
    /** Array of room items */
    rooms: RoomListItem[];
    /** Optional active room index for keyboard navigation */
    activeRoomIndex?: number;
    /** Space ID for context tracking */
    spaceId?: string;
    /** Active filter keys for context tracking */
    filterKeys?: FilterKey[];
}

/**
 * Props for the RoomList component
 */
export interface RoomListProps {
    /**
     * The view model containing all room list data and callbacks
     */
    vm: RoomListViewModel;

    /**
     * Render function for room avatar
     * @param roomItem - The room item data
     */
    renderAvatar: (roomItem: RoomListItem) => ReactNode;
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
 * and renders RoomListItemView components for each room.
 *
 * @example
 * ```tsx
 * <RoomList vm={roomListViewModel} renderAvatar={(room) => <Avatar room={room} />} />
 * ```
 */
export function RoomList({ vm, renderAvatar }: RoomListProps): JSX.Element {
    const snapshot = useViewModel(vm);
    const { roomListState } = snapshot;
    const rooms = roomListState.rooms;
    const activeRoomIndex = roomListState.activeRoomIndex;
    const lastSpaceId = useRef<string | undefined>(undefined);
    const lastFilterKeys = useRef<FilterKey[] | undefined>(undefined);
    const roomCount = rooms.length;

    /**
     * Get the item component for a specific index
     */
    const getItemComponent = useCallback(
        (
            index: number,
            item: RoomListItem,
            context: ListContext<{
                spaceId: string;
                filterKeys: FilterKey[] | undefined;
            }>,
            onFocus: (item: RoomListItem, e: React.FocusEvent) => void,
        ): JSX.Element => {
            const itemKey = item.id;
            const isRovingItem = itemKey === context.tabIndexKey;
            const isFocused = isRovingItem && context.focused;
            const isSelected = activeRoomIndex === index;

            const callbacks = {
                onOpenRoom: () => vm.onOpenRoom(item.id),
                moreOptionsCallbacks: {
                    onMarkAsRead: () => vm.onMarkAsRead(item.id),
                    onMarkAsUnread: () => vm.onMarkAsUnread(item.id),
                    onToggleFavorite: () => vm.onToggleFavorite(item.id),
                    onToggleLowPriority: () => vm.onToggleLowPriority(item.id),
                    onInvite: () => vm.onInvite(item.id),
                    onCopyRoomLink: () => vm.onCopyRoomLink(item.id),
                    onLeaveRoom: () => vm.onLeaveRoom(item.id),
                },
                onSetRoomNotifState: (state: RoomNotifState) => vm.onSetRoomNotifState(item.id, state),
            };

            return (
                <div key={itemKey}>
                    <RoomListItemView
                        item={item}
                        callbacks={callbacks}
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
        [activeRoomIndex, roomCount, renderAvatar, vm],
    );

    /**
     * Get the key for a room item
     */
    const getItemKey = useCallback((item: RoomListItem): string => {
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

    return (
        <ListView
            context={{ spaceId: roomListState.spaceId || "", filterKeys: roomListState.filterKeys }}
            scrollIntoViewOnChange={scrollIntoViewOnChange}
            initialTopMostItemIndex={activeRoomIndex}
            data-testid="room-list"
            role="listbox"
            aria-label={_t("room_list|list_title")}
            fixedItemHeight={ROOM_LIST_ITEM_HEIGHT}
            items={rooms}
            getItemComponent={getItemComponent}
            getItemKey={getItemKey}
            isItemFocusable={() => true}
            increaseViewportBy={{
                bottom: EXTENDED_VIEWPORT_HEIGHT,
                top: EXTENDED_VIEWPORT_HEIGHT,
            }}
        />
    );
}
