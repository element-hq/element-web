/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useMemo, useRef, type JSX, type ReactNode } from "react";
import { type ScrollIntoViewLocation } from "react-virtuoso";
import { isEqual } from "lodash";

import { type Room } from "../RoomListItemView";
import { useViewModel } from "../../viewmodel";
import { _t } from "../../utils/i18n";
import {
    FlatVirtualizedList,
    getContainerAccessibleProps,
    type VirtualizedListContext,
} from "../../utils/VirtualizedList";
import type { RoomListViewSnapshot, RoomListViewModel } from "../RoomListView";
import { GroupedVirtualizedList } from "../../utils/VirtualizedList";
import { RoomListSectionHeaderView } from "../RoomListSectionHeaderView";
import { RoomListItemAccessibilityWrapper } from "../RoomListItemAccessibilityWrapper";

/**
 * Filter key type - opaque string type for filter identifiers
 */
export type FilterKey = string;

/**
 * State for the room list data (nested within RoomListViewSnapshot)
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

/** Height of a single room list item in pixels (44px item + 8px padding bottom) */
const ROOM_LIST_ITEM_HEIGHT = 52;

/**
 * Type for context used in ListView
 */
type Context = {
    /** Space ID for context tracking */
    spaceId: string;
    /** Active filter keys for context tracking */
    filterKeys: FilterKey[] | undefined;
    /** Active room index for keyboard navigation */
    activeRoomIndex: number | undefined;
    /** Sections of the room list */
    sections: RoomListViewSnapshot["sections"];
    /** Total number of rooms in the list */
    roomCount: number;
    /** Number of sections in the list */
    sectionCount: number;
    /** Room list view model */
    vm: RoomListViewModel;
    /** List is in flat or section mode */
    isFlatList: boolean;
};

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
    const { roomListState, sections, isFlatList } = snapshot;
    const activeRoomIndex = roomListState.activeRoomIndex;
    const lastSpaceId = useRef<string | undefined>(undefined);
    const lastFilterKeys = useRef<FilterKey[] | undefined>(undefined);
    const roomIds = useMemo(() => sections.flatMap((section) => section.roomIds), [sections]);
    const roomCount = roomIds.length;
    const sectionCount = sections.length;
    const totalCount = roomCount + sectionCount;

    const groups = useMemo(
        () =>
            sections.map((section) => ({
                header: section.id,
                items: section.roomIds,
            })),
        [sections],
    );

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
     *
     * @param index - The index of the item in the list
     * @param roomId - The ID of the room for this item
     * @param context - The virtualization context containing list state
     * @param onFocus - Callback to call when the item is focused
     * @param isInLastSection - Whether this item is in the last section
     * @param roomIndexInSection - The index of this room within its section
     */
    const getItemComponent = useCallback(
        (
            index: number,
            roomId: string,
            context: VirtualizedListContext<Context>,
            onFocus: (item: string, e: React.FocusEvent) => void,
            isInLastSection?: boolean,
            roomIndexInSection?: number,
        ): JSX.Element => {
            const { activeRoomIndex, roomCount, vm, isFlatList } = context.context;
            const isSelected = activeRoomIndex === index;
            const roomItemVM = vm.getRoomItemViewModel(roomId);

            // If we don't have a view model for this room, it means the room has been removed since the list was rendered - return an empty placeholder
            if (!roomItemVM) {
                return <React.Fragment key={`stale-${index}`} />;
            }

            // Item is focused when the list has focus AND this item's key matches tabIndexKey
            // This matches the old RoomList implementation's roving tabindex pattern
            const isFocused = context.focused && context.tabIndexKey === roomId;

            const isFirstItem = isFlatList && index === 0;
            const isLastItem = Boolean((isFlatList || isInLastSection) && index === roomCount - 1);

            return (
                <RoomListItemAccessibilityWrapper
                    key={roomId}
                    vm={roomItemVM}
                    renderAvatar={renderAvatar}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    onFocus={onFocus}
                    roomIndex={index}
                    roomIndexInSection={roomIndexInSection || 0}
                    roomCount={roomCount}
                    isFirstItem={isFirstItem}
                    isLastItem={isLastItem}
                    isInFlatList={isFlatList}
                />
            );
        },
        [renderAvatar],
    );

    /**
     * Get the item component for a specific index in a grouped list
     * Gets the room's view model and passes it to RoomListItemView
     */
    const getItemComponentForGroupedList = useCallback(
        (
            index: number,
            roomId: string,
            context: VirtualizedListContext<Context>,
            onFocus: (item: string, e: React.FocusEvent) => void,
            groupIndex: number,
        ): JSX.Element => {
            const { sections } = context.context;
            const roomIndexInSection = sections[groupIndex].roomIds.findIndex((id) => id === roomId);
            const isInLastSection = groupIndex === sections.length - 1;
            return getItemComponent(index, roomId, context, onFocus, isInLastSection, roomIndexInSection);
        },
        [getItemComponent],
    );

    /**
     * Get the item component for a specific index in a flat list
     * Gets the room's view model and passes it to RoomListItemView
     */
    const getItemComponentForFlatList = useCallback(
        (
            index: number,
            roomId: string,
            context: VirtualizedListContext<Context>,
            onFocus: (item: string, e: React.FocusEvent) => void,
        ): JSX.Element => {
            return getItemComponent(index, roomId, context, onFocus);
        },
        [getItemComponent],
    );

    /**
     * Get the group header component for a specific group
     */
    const getGroupHeaderComponent = useCallback(
        (
            groupIndex: number,
            headerId: string,
            context: VirtualizedListContext<Context>,
            onFocus: (header: string, e: React.FocusEvent) => void,
        ): JSX.Element => {
            const { vm, sectionCount, sections } = context.context;
            const sectionHeaderVM = vm.getSectionHeaderViewModel(headerId);
            const indexInList = sections
                .slice(0, groupIndex)
                // +1 for each section header
                .reduce((acc, section) => acc + section.roomIds.length + 1, 0);
            const roomCountInSection = sections[groupIndex].roomIds.length;

            // Item is focused when the list has focus AND this item's key matches tabIndexKey
            // This matches the old RoomList implementation's roving tabindex pattern
            const isFocused = context.focused && context.tabIndexKey === headerId;

            return (
                <RoomListSectionHeaderView
                    vm={sectionHeaderVM}
                    isFocused={isFocused}
                    onFocus={onFocus}
                    indexInList={indexInList}
                    sectionIndex={groupIndex}
                    sectionCount={sectionCount}
                    roomCountInSection={roomCountInSection}
                />
            );
        },
        [],
    );

    /**
     * Get the key for a room item
     * Since we're using virtualization, items are always room ID strings
     */
    const getItemKey = useCallback((item: string): string => item, []);

    /**
     * Get the key for a group header
     * We are passing the section ID as the header key, which is a string, so we can return it directly
     */
    const getHeaderKey = useCallback((header: string): string => header, []);

    const context = useMemo(
        () => ({
            spaceId: roomListState.spaceId || "",
            filterKeys: roomListState.filterKeys,
            sections,
            activeRoomIndex,
            roomCount,
            sectionCount,
            vm,
            isFlatList,
        }),
        [
            roomListState.spaceId,
            roomListState.filterKeys,
            sections,
            activeRoomIndex,
            roomCount,
            sectionCount,
            vm,
            isFlatList,
        ],
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

    const isItemFocusable = useCallback(() => true, []);
    const isGroupHeaderFocusable = useCallback(() => true, []);
    const increaseViewportBy = useMemo(
        () => ({
            top: EXTENDED_VIEWPORT_HEIGHT,
            bottom: EXTENDED_VIEWPORT_HEIGHT,
        }),
        [],
    );

    const commonProps = {
        context,
        scrollIntoViewOnChange,
        // If fixedItemHeight is not set and initialTopMostItemIndex=undefined, virtuoso crashes
        // If we don't set it, it works
        ...(activeRoomIndex !== undefined ? { initialTopMostItemIndex: activeRoomIndex } : {}),
        ["data-testid"]: "room-list",
        ["aria-label"]: _t("room_list|list_title"),
        getItemKey,
        isItemFocusable,
        rangeChanged,
        onKeyDown,
        increaseViewportBy,
    };

    if (isFlatList) {
        return (
            <FlatVirtualizedList
                {...commonProps}
                {...getContainerAccessibleProps("listbox")}
                items={roomIds}
                getItemComponent={getItemComponentForFlatList}
            />
        );
    }

    return (
        <GroupedVirtualizedList<string, string, Context>
            {...commonProps}
            {...getContainerAccessibleProps("treegrid", totalCount)}
            groups={groups}
            getHeaderKey={getHeaderKey}
            getGroupHeaderComponent={getGroupHeaderComponent}
            getItemComponent={getItemComponentForGroupedList}
            isGroupHeaderFocusable={isGroupHeaderFocusable}
        />
    );
}
