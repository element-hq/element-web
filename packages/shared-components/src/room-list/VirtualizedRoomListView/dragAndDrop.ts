/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/** Drag payload for a section header. */
export type SectionDragData = { type: "section"; index: number };
/** Drag payload for a room item. */
export type RoomDragData = { type: "room"; isDm: boolean };
/** Discriminated union of all drag payloads in the room list. */
export type RoomListDragData = SectionDragData | RoomDragData;

/**
 * Type guard: true when the drag source is a section header. Narrows to {@link SectionDragData}.
 */
export function isSectionDragData(data: RoomListDragData | undefined): data is SectionDragData {
    return data?.type === "section";
}

/**
 * Type guard: true when the drag source is a room item. Narrows to {@link RoomDragData}.
 */
export function isRoomDragData(data: RoomListDragData | undefined): data is RoomDragData {
    return data?.type === "room";
}

/** The kind of room a section takes when a room is dropped on it. */
export type AcceptedRoomKind = "any" | "dm" | "nonDm" | "none";

/**
 * Whether a section that takes `accepted` refuses the room being dragged, so that it never offers a
 * drop that would do nothing. A section that takes no room refuses every drop, even before a drag
 * starts. The others only refuse the kind of room they don't hold: the People section holds direct
 * messages only, and while it is shown the Chats section holds everything else.
 */
export function rejectsDraggedRoom(accepted: AcceptedRoomKind, dragged: RoomListDragData | undefined): boolean {
    switch (accepted) {
        case "nonDm":
            return !isRoomDragData(dragged) || dragged.isDm;
        case "dm":
            return !isRoomDragData(dragged) || !dragged.isDm;
        case "any":
            return false;
        case "none":
            return true;
    }
}
