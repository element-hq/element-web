/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { memo, type JSX } from "react";
import { useDraggable, useDragOperation, useDroppable } from "@dnd-kit/react";
import { Feedback } from "@dnd-kit/dom";
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useMergeRefs } from "react-merge-refs";

import { RoomListItemView, type RoomListItemViewProps } from "./RoomListItemView";
import { getItemAccessibleProps } from "../../../core/VirtualizedList";
import { useViewModel } from "../../../core/viewmodel";
import {
    canDropForReorder,
    getDropPosition,
    isRoomDragData,
    type RoomDragData,
    type RoomListDragData,
} from "../dragAndDrop";

export interface RoomListItemWrapperProps extends RoomListItemViewProps {
    /** Index of this room in the list */
    roomIndex: number;
    /** Index of this room in its section */
    roomIndexInSection: number;
    /** Total number of rooms in the list */
    roomCount: number;
    /** Whether the room list is displayed as a flat list */
    isInFlatList: boolean;
}

/**
 * Wraps RoomListItemView with the correct accessibility and drag-and-drop props
 * based on whether the list is flat (listbox) or grouped (treegrid).
 */
export const RoomListItemWrapper = memo(function RoomListItemWrapper({
    roomIndex,
    roomCount,
    roomIndexInSection,
    isInFlatList,
    ...rest
}: RoomListItemWrapperProps): JSX.Element {
    if (isInFlatList) {
        return (
            <ReorderableWrapper
                {...rest}
                roomIndex={roomIndex}
                {...getItemAccessibleProps("listbox", roomIndex, roomCount)}
            />
        );
    }

    const isFirstInSection = roomIndexInSection === 0;
    return (
        <div {...getItemAccessibleProps("treegrid", roomIndex, roomIndexInSection)}>
            <div role="gridcell" aria-selected={rest.isSelected}>
                <DraggableWrapper
                    {...rest}
                    roomIndex={roomIndex}
                    onKeyDown={(e) => {
                        if (e.code === "ArrowLeft" && isFirstInSection) {
                            // Move focus to the section header
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.dispatchEvent(
                                new KeyboardEvent("keydown", {
                                    code: "ArrowUp",
                                    key: "ArrowUp",
                                    bubbles: true,
                                }),
                            );
                        }
                    }}
                />
            </div>
        </div>
    );
});

interface DragWrapperProps extends RoomListItemViewProps {
    /** Index of this room in the list */
    roomIndex: number;
}

/**
 * Wraps RoomListItemView with the drag-and-drop functionality of the grouped list (treegrid mode), where a room
 * is dragged onto a section header to move it to that section.
 */
function DraggableWrapper({ roomIndex, ...props }: DragWrapperProps): JSX.Element {
    const item = useViewModel(props.vm);
    const {
        ref: draggableRef,
        handleRef,
        isDragSource,
    } = useDraggable<RoomDragData>({
        id: item.id,
        data: { type: "room", isDm: item.isDm, index: roomIndex, canReorder: false },
        // We clone the item in the dnd overlay to avoid putting a hole in the list
        plugins: [Feedback.configure({ feedback: "clone" })],
        modifiers: [RestrictToVerticalAxis],
        disabled: !item.canChangeSection,
    });
    const dndRef = useMergeRefs([draggableRef, handleRef]);
    // Only wire up the draggable refs when the room can be dragged, otherwise dndkit puts incorrect
    // and misleading a11y attributes on the item (aria-disabled=true and aria-draggable=false)
    return <RoomListItemView {...props} ref={item.canChangeSection ? dndRef : undefined} isDragSource={isDragSource} />;
}

/**
 * Wraps RoomListItemView with the drag-and-drop functionality of the flat list (listbox mode), where a reorderable
 * room is dragged onto another reorderable room to take its position. Rooms that can't be reordered are plain items.
 */
function ReorderableWrapper({ roomIndex, ...props }: DragWrapperProps): JSX.Element {
    const item = useViewModel(props.vm);
    const data: RoomDragData = { type: "room", isDm: item.isDm, index: roomIndex, canReorder: item.canReorder };
    const {
        ref: draggableRef,
        handleRef,
        isDragSource,
    } = useDraggable<RoomDragData>({
        id: item.id,
        data,
        // We clone the item in the dnd overlay to avoid putting a hole in the list
        plugins: [Feedback.configure({ feedback: "clone" })],
        modifiers: [RestrictToVerticalAxis],
        disabled: !item.canReorder,
    });

    const { source } = useDragOperation<RoomListDragData>();
    const draggedData = source?.data;
    const { ref: droppableRef, isDropTarget } = useDroppable<RoomDragData>({
        id: item.id,
        data,
        disabled: !item.canReorder || isDragSource || !canDropForReorder(draggedData),
    });

    const dropIndicator =
        isDropTarget && isRoomDragData(draggedData) ? getDropPosition(draggedData.index, roomIndex) : undefined;
    const dndRef = useMergeRefs([draggableRef, handleRef, droppableRef]);
    // Only wire up the dnd refs when the room can be reordered, see DraggableWrapper
    return (
        <RoomListItemView
            {...props}
            ref={item.canReorder ? dndRef : undefined}
            isDragSource={isDragSource}
            dropIndicator={dropIndicator}
        />
    );
}
