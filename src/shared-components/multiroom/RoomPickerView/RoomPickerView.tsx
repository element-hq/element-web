/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button } from "@vector-im/compound-web";

import { Flex } from "../../utils/Flex";
import styles from "./RoomPickerView.module.css";
import { RichList } from "../../rich-list/RichList";
import { type ViewModel } from "../../ViewModel";
import { useViewModel } from "../../useViewModel";
import { RichItem } from "../../rich-list/RichItem";
import { PillInput } from "../../pill-input/PillInput";
import { Pill } from "../../pill-input/Pill";

interface Room {
    /**
     * Unique identifier for the room.
     */
    id: string;
    /**
     * Display name of the room.
     */
    name: string;
    /**
     * Brief description of the room.
     */
    description: string;
    /**
     * Timestamp of the last activity in the room (in milliseconds since epoch).
     */
    timestamp: number;
    /**
     * Indicates if the room is currently selected.
     */
    selected: boolean;
}

export interface RoomPickerViewSnapshot<T extends Room> {
    /**
     * List of rooms available for selection.
     */
    rooms: T[];
    /**
     * List of rooms that have been selected by the user.
     */
    selectedRooms: T[];
}

export interface RoomPickerViewActions {
    /**
     * Called when a room is selected or deselected in the list or in the input.
     * @param roomId
     */
    toggleRoom: (roomId: string) => void;
    /**
     * Called when the user confirms adding the selected rooms.
     */
    addRooms: () => void;
}

export type RoomPickerViewModel<T extends Room> = ViewModel<RoomPickerViewSnapshot<T>> & RoomPickerViewActions;

export interface RoomPickerViewProps<T extends Room> {
    /**
     * The ViewModel instance that provides the data and actions for this view.
     */
    vm: RoomPickerViewModel<T>;
    /**
     * Renders the avatar for a room in the list.
     * @param room
     * @param size - The size of the avatar to render (e.g., "32px", "40px").
     */
    renderRoomAvatar: (room: T, size: string) => React.ReactNode;
}

/**
 * RoomPickerView component allows users to pick rooms to add to the grid view
 *
 * @example
 * ```tsx
 * <RoomPickerView vm={roomPickerViewModel} renderRoomAvatar={(room, size) => <Avatar room={room} size={size} />} />
 * ```
 */
export function RoomPickerView<T extends Room>({ vm, renderRoomAvatar }: RoomPickerViewProps<T>): JSX.Element {
    const { rooms, selectedRooms } = useViewModel(vm);

    return (
        <Flex direction="column" align="stretch">
            <span className={styles.description}>
                Pick rooms or conversations to add. This is just a space for you, no one will be informed. You can add
                more later.
            </span>
            <PillInput inputProps={{ placeholder: "Search for rooms or people" }}>
                {selectedRooms.map((room) => (
                    <Pill key={room.id} label={room.name} onClick={() => vm.toggleRoom(room.id)}>
                        {renderRoomAvatar(room, "20px")}
                    </Pill>
                ))}
            </PillInput>
            <RichList title="Rooms" className={styles.list}>
                {rooms.map((room) => (
                    <RichItem
                        key={room.id}
                        title={room.name}
                        description={room.description}
                        timestamp={room.timestamp}
                        avatar={renderRoomAvatar(room, "32px")}
                        selected={room.selected}
                        onClick={() => vm.toggleRoom(room.id)}
                    />
                ))}
            </RichList>
            <Button onClick={vm.addRooms} className={styles.button}>
                Add chats
            </Button>
        </Flex>
    );
}
