/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { memo, type JSX, type FocusEvent, useEffect, useRef } from "react";
import classNames from "classnames";
import { useDraggable, useDragOperation, useDroppable } from "@dnd-kit/react";
import { useMergeRefs } from "react-merge-refs";
import { Feedback } from "@dnd-kit/dom";
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";

import { useViewModel, type ViewModel } from "../../../core/viewmodel";
import styles from "./RoomListSectionHeaderView.module.css";
import { useI18n } from "../../../core/i18n/i18nContext";
import { getGroupHeaderAccessibleProps } from "../../../core/VirtualizedList";
import { RoomListSectionHeaderContent } from "./RoomListSectionHeaderContent";
import { isSectionDragData, type RoomListDragData, type SectionDragData } from "../dragAndDrop";
import { type NotificationDecorationData } from "../RoomListItemWrapper/RoomListItemView/NotificationDecoration";

/**
 * The observable state snapshot for a room list section header.
 */
export interface RoomListSectionHeaderViewSnapshot {
    /** Unique identifier for the section header (used for list keying) */
    id: string;
    /** The display title of the section header. */
    title: string;
    /** Whether the section is currently expanded. */
    isExpanded: boolean;
    /** Whether the section is unread (has any unread rooms) */
    isUnread: boolean;
    /** The merged notification decoration aggregating the notifications of the rooms in the section */
    notification?: NotificationDecorationData;
    /** Wether to display the section menu  */
    displaySectionMenu: boolean;
    /** Whether the section can be reordered via drag-and-drop  */
    canBeReordered: boolean;
}

/**
 * Actions that can be performed on a room list section header.
 */
export interface RoomListSectionHeaderActions {
    /** Handler invoked when the section header is clicked or keyboard-toggled (toggles expand/collapse). */
    onClick: () => void;
    /** Handler invoked when the edit section button is clicked  */
    editSection: () => void;
    /** Handler invoked when the remove section button is clicked  */
    removeSection: () => void;
}

/**
 * The view model type for the room list section header, combining its snapshot and actions.
 */
export type RoomListSectionHeaderViewModel = ViewModel<RoomListSectionHeaderViewSnapshot, RoomListSectionHeaderActions>;

/**
 * Props for {@link RoomListSectionHeaderView}.
 */
export interface RoomListSectionHeaderViewProps {
    /** The view model driving the section header's state and actions. */
    vm: RoomListSectionHeaderViewModel;
    /** Whether this header currently has focus within the roving tab index. */
    isFocused: boolean;
    /** Callback invoked when the header receives focus. */
    onFocus: (headerId: string, e: FocusEvent) => void;
    /** Index of this section in the list, sections and rooms included */
    indexInList: number;
    /** Index of this section in the list related to the others sections */
    sectionIndex: number;
    /** Total number of sections in the list */
    sectionCount: number;
    /** Number of rooms in this section */
    roomCountInSection: number;
}

/**
 * A collapsible section header in the room list.
 *
 * Renders a button that displays the section title alongside a chevron icon
 * indicating the current expand/collapse state. Clicking the header toggles
 * the section's expanded state via the view model.
 *
 * @example
 * ```tsx
 * <RoomListSectionHeaderView
 *   vm={sectionHeaderViewModel}
 *   isFocused={isHeaderFocused}
 *   onFocus={() => setFocusedHeader(sectionId)}
 *   sectionIndex={index}
 *   sectionCount={totalSections}
 *   roomCountInSection={roomCount}
 * />
 * ```
 */
export const RoomListSectionHeaderView = memo(function RoomListSectionHeaderView({
    vm,
    isFocused,
    onFocus,
    indexInList,
    sectionIndex,
    sectionCount,
    roomCountInSection,
}: Readonly<RoomListSectionHeaderViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { id, title, isExpanded, isUnread, canBeReordered } = useViewModel(vm);
    const isLastSection = sectionIndex === sectionCount - 1;

    const {
        ref: draggableRef,
        handleRef,
        isDragSource,
    } = useDraggable<SectionDragData>({
        id,
        data: { type: "section", index: sectionIndex },
        plugins: [Feedback.configure({ feedback: "clone" })],
        modifiers: [RestrictToVerticalAxis],
        disabled: !canBeReordered,
    });

    const { source } = useDragOperation<RoomListDragData>();
    const draggedData = source?.data;
    const isDraggingSectionSource = isSectionDragData(draggedData);

    // Keep the droppable enabled so rooms can still be dropped on default sections
    // (Favourite / Low Priority). Only disable it for section drags on non-reorderable
    // headers so they can't be used as reorder targets.
    const { ref: droppableRef, isDropTarget } = useDroppable<SectionDragData>({
        id,
        data: { type: "section", index: sectionIndex },
        disabled: isDragSource || (isDraggingSectionSource && !canBeReordered),
    });

    const isDraggingRoom = isDropTarget && draggedData?.type === "room";
    const isDraggingSection = isDropTarget && isDraggingSectionSource;

    const sourceSectionIndex = isSectionDragData(draggedData) ? draggedData.index : -1;
    const isSourceAbove = isDraggingSection && sourceSectionIndex > sectionIndex;
    const hasBottomBorder = isDraggingSection && !isSourceAbove;
    const hasTopBorder = isDraggingSection && isSourceAbove;

    // Keep the last expanded state we rendered while NOT dragging.
    const lastExpandedRef = useRef(isExpanded);
    if (!isDragSource) {
        lastExpandedRef.current = isExpanded;
    }
    // While this header is the drag source, freeze aria-expanded at its pre-drag value. Section
    // drag start collapses every section, flipping this focused header's aria-expanded true→false;
    // announcing that state change is a second, redundant screen-reader announcement on top of the
    // dnd "Dragging X" live-region announcement. The collapse is still reflected visually.
    const ariaExpanded = isDragSource ? lastExpandedRef.current : isExpanded;

    const internalRef = useRef<HTMLButtonElement>(null);
    // Only wire up draggable refs when the section can be dragged. Otherwise dndkit will put incorrect and misleading a11y attributes
    // on the default section (aka aria-disabled=true and aria-draggable=false)
    const buttonRef = useMergeRefs([
        ...(canBeReordered ? [draggableRef, handleRef] : []),
        droppableRef,
        internalRef,
    ]) as React.Ref<HTMLButtonElement>;

    useEffect(() => {
        if (isFocused) {
            internalRef.current?.focus({ preventScroll: true });
        }
    }, [isFocused]);

    return (
        <div
            aria-expanded={ariaExpanded}
            {...getGroupHeaderAccessibleProps(indexInList, sectionIndex, roomCountInSection)}
        >
            <div role="gridcell" aria-expanded={ariaExpanded}>
                <button
                    ref={buttonRef}
                    type="button"
                    className={classNames(styles.header, {
                        [styles.firstHeader]: sectionIndex === 0,
                        // If the section is collapsed and it's the last one
                        [styles.lastHeader]: !isExpanded && isLastSection,
                        [styles.unread]: isUnread,
                        [styles.dragSource]: isDragSource,
                        [styles.dropTarget]: isDraggingRoom,
                        [styles.dropTargetBottom]: hasBottomBorder,
                        [styles.dropTargetTop]: hasTopBorder,
                    })}
                    onClick={() => !isDragSource && vm.onClick()}
                    onKeyDown={(e) => {
                        if ((e.code === "ArrowRight" && !isExpanded) || (e.code === "ArrowLeft" && isExpanded)) {
                            e.preventDefault();
                            e.stopPropagation();
                            vm.onClick();
                        } else if (e.code === "ArrowRight" && isExpanded && roomCountInSection > 0) {
                            // Move focus to the first room in the section
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.dispatchEvent(
                                new KeyboardEvent("keydown", {
                                    code: "ArrowDown",
                                    key: "ArrowDown",
                                    bubbles: true,
                                }),
                            );
                        }
                    }}
                    aria-expanded={ariaExpanded}
                    onFocus={(e) => onFocus(id, e)}
                    tabIndex={isFocused ? 0 : -1}
                    aria-label={
                        isUnread
                            ? _t("room_list|section_header|toggle_unread", { section: title })
                            : _t("room_list|section_header|toggle", { section: title })
                    }
                >
                    <RoomListSectionHeaderContent vm={vm} />
                </button>
            </div>
        </div>
    );
});
