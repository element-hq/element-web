/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode, type JSX } from "react";
import { Text } from "@vector-im/compound-web";
import { Flex } from "../utils/Flex";
import { PillInput } from "../pill-input/PillInput";
import { Pill } from "../pill-input/Pill";
import { RichList } from "../rich-list/RichList";
import { RichItem } from "../rich-list/RichItem";
import { useViewModel, type ViewModel } from "../viewmodel";

import styles from "./RoomPickerView.module.css";
import classNames from "classnames";

export interface RoomOfRoomPickerView {
    /**  Unique identifier for the room. */
    id: string;
    /** Display name of the room. */
    name: string;
    /** Brief description of the room. */
    description: string;
    /** Timestamp of the last activity in the room (in milliseconds since epoch). */
    timestamp?: number;
    /** Indicates if the room is currently selected. */
    selected: boolean;
}

export interface RoomPickerViewSnapshot {
    /** List of rooms available for selection. */
    rooms: RoomOfRoomPickerView[];
    /** List of rooms that have been selected by the user. */
    selectedRooms: RoomOfRoomPickerView[];
    /** Placeholder text displayed in the search input when empty. */
    placeholder: string;
    /** Title displayed above the list of rooms. */
    listTitle: string;
    /** Text displayed when the list of rooms is empty. */
    emptyListText: string;
}

export interface RoomPickerViewActions {
    /**
     * Called when a room is selected or deselected in the list or in the input.
     * @param roomId
     */
    toggleRoom: (roomId: string) => void;
    /**
     * Called when the user types in the search input to filter rooms.
     * @param query
     */
    search: (query: string) => void;
    /**
     * Called when the last room that was selected needs to be removed.
     * Used by the pill input to remove the last added room on backspace.
     */
    unSelectLastRoom: () => void;
    /**
     * Renders the avatar for a room in the list.
     * @param room
     * @param size - The size of the avatar to render (e.g., "32px", "40px").
     */
    renderRoomAvatar: (room: RoomOfRoomPickerView, size: string) => ReactNode;
}

/** The view model for the room picker component. */
export type RoomPickerViewModel = ViewModel<RoomPickerViewSnapshot, RoomPickerViewActions>;

interface RoomPickerViewProps {
    /** The view model for the room picker component. */
    vm: RoomPickerViewModel;
    /** Optional CSS class name to apply to the root element of the component. */
    className?: string;
}

/**
 * A view component for picking rooms from a searchable, filterable list.
 * Displays selected rooms as pills in an input field and renders available
 * rooms in a rich list below.
 *
 * @example
 * ```tsx
 * <RoomPickerView vm={roomPickerViewModel} className="my-room-picker" />
 * ```
 */
export function RoomPickerView({ vm, className }: Readonly<RoomPickerViewProps>): JSX.Element {
    const { rooms, selectedRooms, placeholder, listTitle, emptyListText } = useViewModel(vm);
    const isListEmpty = rooms.length === 0;
    const inputRef = React.useRef<HTMLInputElement>(null);

    return (
        <Flex gap="var(--cpd-space-4x)" direction="column" align="stretch" className={className}>
            <PillInput
                onRemoveChildren={vm.unSelectLastRoom}
                inputProps={{
                    ref: inputRef,
                    placeholder,
                    onChange: (e) => vm.search(e.currentTarget.value),
                }}
            >
                {selectedRooms.map((room) => (
                    <Pill key={room.id} label={room.name} onClick={() => vm.toggleRoom(room.id)}>
                        {vm.renderRoomAvatar(room, "20px")}
                    </Pill>
                ))}
            </PillInput>
            {isListEmpty ? (
                <Text as="div" size="lg" className={classNames(styles.list, styles.emptyList)}>
                    {emptyListText}
                </Text>
            ) : (
                <RichList title={listTitle} className={styles.list}>
                    {rooms.map((room) => (
                        <RichItem
                            key={room.id}
                            title={room.name}
                            description={room.description}
                            timestamp={room.timestamp}
                            avatar={vm.renderRoomAvatar(room, "32px")}
                            selected={room.selected}
                            onClick={() => {
                                vm.toggleRoom(room.id);

                                if (!inputRef.current) return;
                                inputRef.current.value = "";
                                inputRef.current?.focus();
                            }}
                        />
                    ))}
                </RichList>
            )}
        </Flex>
    );
}
