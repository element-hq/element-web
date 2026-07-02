/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type JSX, type ReactNode } from "react";
import { type ScrollIntoViewLocation, type VirtuosoHandle } from "react-virtuoso";
import { isEqual } from "lodash";
import { DragDropProvider, DragOverlay, useDragOperation } from "@dnd-kit/react";
import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";

import { type Room } from "./RoomListItemWrapper/RoomListItemView";
import { useViewModel } from "../../core/viewmodel";
import {
    FlatVirtualizedList,
    getContainerAccessibleProps,
    type VirtualizedListContext,
} from "../../core/VirtualizedList";
import type { RoomListViewSnapshot, RoomListViewModel } from "../RoomListView";
import { GroupedVirtualizedList, type GroupedVirtualizedListProps } from "../../core/VirtualizedList";
import { RoomListSectionHeaderView, RoomListStickySectionHeaderView } from "./RoomListSectionHeaderView";
import { RoomListSectionHeaderDragOverlayView } from "./RoomListSectionHeaderDragOverlayView";
import { RoomListItemWrapper } from "./RoomListItemWrapper";
import { RoomListItemDragOverlayView } from "./RoomListItemDragOverlayView";
import { isSectionDragData, type RoomListDragData } from "./dragAndDrop";
import { useRoomListAccessibilityPlugin } from "./RoomListAccessibilityPlugin";
import styles from "./VirtualizedRoomListView.module.css";
import { useI18n } from "../../core/i18n/i18nContext";

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
    /** Tag of a newly created section header to scroll into view */
    scrollToSectionTag?: string;
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
 * Number of pixels the keyboard sensor moves the dragged element per arrow keypress.
 */
export const KEYBOARD_DRAG_OFFSET = 17;

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
    const { translate: _t } = useI18n();
    const snapshot = useViewModel(vm);
    const { roomListState, sections, isFlatList } = snapshot;
    const activeRoomIndex = roomListState.activeRoomIndex;
    const scrollToSectionTag = roomListState.scrollToSectionTag;
    const lastSpaceId = useRef<string | undefined>(undefined);
    const lastFilterKeys = useRef<FilterKey[] | undefined>(undefined);
    const virtuosoHandleRef = useRef<VirtuosoHandle | null>(null);
    const setVirtuosoHandle = useCallback((handle: VirtuosoHandle | null) => {
        virtuosoHandleRef.current = handle;
    }, []);

    // --- "Unread activity" toast fold tracking ---
    // Virtuoso renders a large overscan buffer (EXTENDED_VIEWPORT_HEIGHT) below the
    // visible area, so its reported range extends well past the actual fold. To show
    // the toast as soon as an unread room scrolls just below the fold (rather than only
    // once it leaves the overscan buffer), we measure the genuinely-visible last item
    // from the scroller geometry and report it separately to the view model.
    const foldScrollerRef = useRef<HTMLElement | null>(null);
    const foldObserverRef = useRef<IntersectionObserver | null>(null);
    // Observed item elements → whether each is currently on screen (intersecting). The keys
    // are what we've asked the observer to watch; the values are their latest visibility.
    const itemVisibilityRef = useRef<Map<Element, boolean>>(new Map());
    const foldSyncRafRef = useRef<number | null>(null);
    const lastReportedFoldIndex = useRef<number>(-1);

    // Report the highest-index currently-visible item as the fold. Indices are read from
    // each element's live data-item-index attribute (rather than a captured value) because
    // Virtuoso recycles/reorders item DOM nodes as the list scrolls.
    const reportFold = useCallback(() => {
        let fold = -1;
        for (const [el, isVisible] of itemVisibilityRef.current) {
            if (!isVisible) continue;
            const index = Number((el as HTMLElement).dataset.itemIndex);
            if (Number.isFinite(index) && index > fold) fold = index;
        }
        if (fold !== lastReportedFoldIndex.current) {
            lastReportedFoldIndex.current = fold;
            vm.updateVisibleFold(fold);
        }
    }, [vm]);

    // IntersectionObserver callback: track which item elements are genuinely on screen
    // (excluding the overscan buffer). Fires as the user scrolls or the viewport resizes,
    // with no per-frame layout reads.
    const onItemIntersection = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            for (const entry of entries) {
                itemVisibilityRef.current.set(entry.target, entry.isIntersecting);
            }
            reportFold();
        },
        [reportFold],
    );

    // Observe newly-rendered item elements and release ones Virtuoso has recycled out of the
    // DOM. The observer itself handles visibility as the user scrolls/resizes, so this only
    // needs running when the rendered set changes (rangeChanged) or on first attach.
    const syncObservedItems = useCallback(() => {
        const scroller = foldScrollerRef.current;
        const observer = foldObserverRef.current;
        if (!scroller || !observer) return;
        const current = new Set<Element>(scroller.querySelectorAll("[data-item-index]"));
        for (const el of current) {
            if (!itemVisibilityRef.current.has(el)) {
                observer.observe(el);
                itemVisibilityRef.current.set(el, false); // observed, not yet known visible
            }
        }
        for (const el of itemVisibilityRef.current.keys()) {
            if (!current.has(el)) {
                observer.unobserve(el);
                itemVisibilityRef.current.delete(el);
            }
        }
        reportFold();
    }, [reportFold]);

    const scheduleSyncObservedItems = useCallback(() => {
        if (foldSyncRafRef.current !== null) return;
        foldSyncRafRef.current = requestAnimationFrame(() => {
            foldSyncRafRef.current = null;
            syncObservedItems();
        });
    }, [syncObservedItems]);

    // Callback ref for Virtuoso's scroller element: (re)create an IntersectionObserver rooted
    // at it. The initial sync is covered by the rangeChanged Virtuoso fires on mount.
    const setScroller = useCallback(
        (element: HTMLElement | Window | null) => {
            foldObserverRef.current?.disconnect();
            foldObserverRef.current = null;
            itemVisibilityRef.current.clear();
            lastReportedFoldIndex.current = -1;
            if (foldSyncRafRef.current !== null) {
                cancelAnimationFrame(foldSyncRafRef.current);
                foldSyncRafRef.current = null;
            }
            const scroller = element instanceof HTMLElement ? element : null;
            foldScrollerRef.current = scroller;
            if (scroller) {
                foldObserverRef.current = new IntersectionObserver(onItemIntersection, { root: scroller });
                scheduleSyncObservedItems();
            }
        },
        [onItemIntersection, scheduleSyncObservedItems],
    );
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
            // The rendered set changed; (un)observe items so the fold stays accurate.
            scheduleSyncObservedItems();
        },
        [vm, scheduleSyncObservedItems],
    );

    // Builds the accessibility plugin (live-region announcements) for keyboard/pointer drags,
    // replacing dnd-kit's built-in Accessibility plugin.
    const a11yPlugins = useRoomListAccessibilityPlugin(vm);

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
                <RoomListItemWrapper
                    key={roomId}
                    vm={roomItemVM}
                    renderAvatar={renderAvatar}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    onFocus={onFocus}
                    roomIndex={index}
                    // For a flat list, we don't have sections, so roomIndexInSection is unused and can be set to 0
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
                    // Stable key per section avoids a @dnd-kit registration race when a new section is inserted.
                    key={headerId}
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
     * Render the pinned "current section" overlay header for the grouped list.
     * Presentational only — the real header rows in the list stay the accessible, focusable
     * controls. See {@link RoomListStickySectionHeaderView}.
     */
    const renderStickyHeader = useCallback(
        (groupIndex: number, headerId: string, context: VirtualizedListContext<Context>): ReactNode => {
            const sectionHeaderVM = context.context.vm.getSectionHeaderViewModel(headerId);
            return <RoomListStickySectionHeaderView key={headerId} vm={sectionHeaderVM} isFirst={groupIndex === 0} />;
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
            context: VirtualizedListContext<{
                spaceId: string;
                filterKeys: FilterKey[] | undefined;
            }>;
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

    // Imperatively scroll to a newly created section header.
    // scrollIntoView on virtuoso handle is more reliable in this case vs scrollIntoViewOnChange
    useLayoutEffect(() => {
        if (scrollToSectionTag === undefined) return;
        const sectionIndex = sections.findIndex((s) => s.id === scrollToSectionTag);
        if (sectionIndex === -1) return;
        const flatIndex = sections.slice(0, sectionIndex).reduce((acc, s) => acc + s.roomIds.length + 1, 0);
        virtuosoHandleRef.current?.scrollIntoView({
            index: flatIndex,
            align: "start",
            behavior: "auto",
        });
    }, [scrollToSectionTag, sections]);

    // Give the view model an imperative handle to scroll an item index into view (e.g. when the
    // user clicks the "unread activity" toast, which is rendered by a sibling component). The view
    // owns the scroll handle, so it registers the function here rather than the model pushing
    // scroll requests through its snapshot.
    useEffect(() => {
        vm.setScrollToIndex((index) =>
            virtuosoHandleRef.current?.scrollIntoView({ index, align: "center", behavior: "auto" }),
        );
        return () => vm.setScrollToIndex(undefined);
    }, [vm]);

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
        "scrollerRef": setScroller,
        onKeyDown,
        increaseViewportBy,
        "className": styles.roomList,
    };

    if (isFlatList) {
        return (
            <FlatVirtualizedList
                {...commonProps}
                {...getContainerAccessibleProps("listbox")}
                scrollHandleRef={setVirtuosoHandle}
                items={roomIds}
                getItemComponent={getItemComponentForFlatList}
            />
        );
    }

    return (
        <DragDropProvider<RoomListDragData>
            onDragStart={(event) => {
                const { source } = event.operation;
                // Changing the state of sections (collapsed/expanded) while dragging a section header causes a double readback for the a11y announcement.
                if (isSectionDragData(source?.data)) {
                    vm.onSectionDragStart();
                }
            }}
            onDragEnd={(event) => {
                const { source, target } = event.operation;
                if (isSectionDragData(source?.data)) {
                    vm.onSectionDragEnd();
                }
                if (event.canceled || !source || !target) return;
                if (isSectionDragData(source.data)) {
                    vm.changeSectionOrder(String(source.id), String(target.id));
                } else {
                    vm.changeRoomSection(String(source.id), String(target.id));
                }
            }}
            sensors={[
                // By default, the PointerSensor activates dragging immediately on pointer down, which interferes with keyboard navigation.
                // So we start dragging after the pointer has moved by 5 pixels, to allow for click without dragging
                PointerSensor.configure({
                    activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })],
                }),
                // By default, the KeyboardSensor uses both space and enter to start dragging, which interferes with the keyboard enter shortcut to open a room.
                KeyboardSensor.configure({
                    // The default 10px-per-keypress offset makes keyboard dragging feel sluggish.
                    offset: KEYBOARD_DRAG_OFFSET,
                    keyboardCodes: {
                        start: ["Space"],
                        cancel: ["Escape"],
                        end: ["Space"],
                        up: ["ArrowUp"],
                        down: ["ArrowDown"],
                        left: ["ArrowLeft"],
                        right: ["ArrowRight"],
                    },
                }),
            ]}
            plugins={a11yPlugins}
        >
            <DragOverlay dropAnimation={null}>
                <DragOverlayContent vm={vm} renderAvatar={renderAvatar} />
            </DragOverlay>
            <GroupedRoomList
                {...commonProps}
                {...getContainerAccessibleProps("treegrid", totalCount)}
                scrollHandleRef={setVirtuosoHandle}
                groups={groups}
                getHeaderKey={getHeaderKey}
                getGroupHeaderComponent={getGroupHeaderComponent}
                getItemComponent={getItemComponentForGroupedList}
                isGroupHeaderFocusable={isGroupHeaderFocusable}
                renderStickyHeader={renderStickyHeader}
            />
        </DragDropProvider>
    );
}

/**
 * Inner component rendered inside DragDropProvider that renders the grouped virtualized list.
 * Uses useDragOperation to detect active keyboard drags and disable the list's own keyboard
 * navigation shortcuts while a drag is in progress, preventing unwanted list scrolling.
 */
function GroupedRoomList(props: GroupedVirtualizedListProps<string, string, Context>): JSX.Element {
    const { source } = useDragOperation<RoomListDragData>();

    return <GroupedVirtualizedList<string, string, Context> {...props} disableKeyboardNavigation={source !== null} />;
}

interface DragOverlayContentProps {
    /**  The room list view model */
    vm: RoomListViewModel;
    /** Function to render the room avatar */
    renderAvatar: (room: Room) => ReactNode;
}

/**
 * Component rendered in the drag overlay when dragging a room item. Renders a copy of the dragged item to avoid dragging the actual element out of virtualization.
 */
function DragOverlayContent({ vm, renderAvatar }: DragOverlayContentProps): JSX.Element | null {
    const { source } = useDragOperation<RoomListDragData>();
    if (!source) return null;

    if (isSectionDragData(source.data)) {
        const sectionHeaderVM = vm.getSectionHeaderViewModel(String(source.id));
        return <RoomListSectionHeaderDragOverlayView vm={sectionHeaderVM} />;
    }

    const itemVm = vm.getRoomItemViewModel(String(source.id));
    if (!itemVm) return null;

    return <RoomListItemDragOverlayView vm={itemVm} renderAvatar={renderAvatar} />;
}
