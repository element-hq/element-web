/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { BaseViewModel, type RoomOfRoomPickerView } from "@element-hq/web-shared-components";
import {
    type CreateSectionDialogViewModel as CreateSectionDialogViewModelInterfaces,
    type CreateSectionDialogViewSnapshot,
} from "../../components/views/dialogs/CreateSectionDialog/types";
import { _t } from "../../i18n";
import { type RoomListStoreV3Class } from "../../stores/room-list-v3/RoomListStoreV3";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import throttle from "lodash/throttle";
import RoomAvatar from "../../components/views/avatars/RoomAvatar";
import { logger } from "matrix-js-sdk/src/logger";
import DMRoomMap from "../../utils/DMRoomMap";
import { sortRoomsByRecency } from "../../utils/room/sortRoomsByRecency";

interface CreateSectionDialogViewModelProps {
    /**
     * The store providing the rooms that the user can add to the section.
     */
    roomListStore: RoomListStoreV3Class;
    /**
     * The client used to look up the rooms shown in the picker.
     */
    matrixClient: MatrixClient;
    /**
     * The name of the existing section when editing; undefined when creating a new section.
     */
    sectionToEdit?: {
        name: string;
        tag: string;
    };
    /**
     * The id of a room to preselect in the picker, if any.
     * Set when the section is created from a room, so that room ends up in it.
     */
    preselectedRoomId?: string;
    /**
     * Callback called when the dialog should close.
     * @param sectionName The name of the section to create or edit, or undefined if the user gave up on it.
     * @param roomsToTag The rooms that should be added to the section
     * @param roomsToUntag The rooms that should be removed from the section
     */
    onFinished: (sectionName: string | undefined, roomsToTag: string[] | undefined, roomsToUntag?: string[]) => void;
}

/**
 * View model for {@link SectionCreationView}, backing the section creation/edition dialog.
 */
export class CreateSectionDialogViewModel
    extends BaseViewModel<CreateSectionDialogViewSnapshot, CreateSectionDialogViewModelProps>
    implements CreateSectionDialogViewModelInterfaces
{
    /**
     * The rooms the user has selected, keyed by room id.
     */
    private selectedRoomsMap: Map<string, RoomOfRoomPickerView> = new Map();

    /**
     * The ids of the rooms that were already in the section when the room selection step opened.
     * Used to tell apart the rooms the user added from the ones they removed.
     */
    private roomsAlreadyInSection: Set<string> = new Set();

    /**
     * The rooms the user can pick from, most recent activity first.
     * Sorted once by {@link loadRooms} so that the list doesn't move around while the user searches.
     */
    private roomsByRecency: Room[] = [];

    public constructor(props: CreateSectionDialogViewModelProps) {
        const value = props.sectionToEdit?.name ?? "";
        super(props, {
            value,
            step: Boolean(props.sectionToEdit) ? "edition" : "creation",
            isValid: value.trim().length > 0,
            rooms: [],
            selectedRooms: [],
            placeholder: _t("create_section_dialog|placeholder"),
            emptyListText: _t("create_section_dialog|empty_list_text"),
            listTitle: _t("create_section_dialog|list_title"),
        });
    }

    /**
     * Update the pending section name and whether it can be submitted.
     * @param sectionName - The name typed by the user.
     */
    public setSection = (sectionName: string): void => {
        this.snapshot.merge({ value: sectionName, isValid: sectionName.trim().length > 0 });
    };

    /**
     * Called when the user submits the section name.
     */
    public createOrEditSection = (): void => {
        this.nextStep();
    };

    /**
     * Move the dialog to the room selection step.
     */
    public nextStep = (): void => {
        // Only move to the next step if we're not already there and the section name is valid.
        if (this.getSnapshot().step !== "add_rooms" && this.getSnapshot().isValid) {
            this.loadRooms();
            this.snapshot.merge({ step: "add_rooms" });
            return;
        }

        if (this.getSnapshot().step === "add_rooms") {
            // Only report what changed: the rooms that were already in the section keep their tag,
            // and re-tagging them would toggle it off.
            const roomsToTag = Array.from(this.selectedRoomsMap.keys()).filter(
                (id) => !this.roomsAlreadyInSection.has(id),
            );
            const roomsToUntag = Array.from(this.roomsAlreadyInSection).filter((id) => !this.selectedRoomsMap.has(id));
            this.props.onFinished(this.getSnapshot().value, roomsToTag, roomsToUntag);
        }
    };

    /**
     * Close the dialog.
     * The section is kept if the user already validated its name and reached the room selection step,
     * and dropped otherwise.
     */
    public cancel = (): void => {
        const shouldCreateSection = this.getSnapshot().step === "add_rooms";
        if (shouldCreateSection) {
            this.props.onFinished(this.getSnapshot().value, undefined);
        } else {
            this.props.onFinished(undefined, undefined);
        }
    };

    /**
     * Fill the snapshot with the rooms the user can pick from and the ones already selected.
     */
    private loadRooms(): void {
        // Get the rooms from the store
        const rooms = this.props.roomListStore.getRooms();

        const tag = this.props.sectionToEdit?.tag;
        // If we're editing an existing section, preselect the rooms that are already in it.
        if (tag) {
            const roomsInSection = rooms.filter((r) => r.tags?.[tag] !== undefined);
            for (const room of roomsInSection) {
                const viewRoom = roomToViewRoom(room, true);
                this.selectedRoomsMap.set(room.roomId, viewRoom);
                this.roomsAlreadyInSection.add(room.roomId);
            }
        }

        // When the section is created from a room, that room is selected by default so it lands in
        // the section. The user is free to unselect it before confirming.
        const preselectedRoomId = this.props.preselectedRoomId;
        if (preselectedRoomId) {
            const preselectedRoom = this.props.matrixClient.getRoom(preselectedRoomId);
            if (preselectedRoom) {
                this.selectedRoomsMap.set(preselectedRoomId, roomToViewRoom(preselectedRoom, true));
            } else {
                logger.warn(`Cannot preselect room ${preselectedRoomId} as it is unknown to the client`);
            }
        }

        // The store hands over the rooms unsorted, so put the most recent ones first
        this.roomsByRecency = sortRoomsByRecency(rooms, this.props.matrixClient.getSafeUserId());

        // Generate list of rooms from which the user can select
        const filteredRooms = this.getRoomsWithFilter("");

        // Convert to array of rooms
        const selectedRooms = Array.from(this.selectedRoomsMap.values());

        // State is ready
        this.snapshot.merge({
            rooms: filteredRooms,
            selectedRooms,
            isValid: this.areRoomsSelectedDifferent(selectedRooms),
        });
    }

    /**
     * Get a room from the matrix client by its id and convert it to a RoomOfRoomPickerView object.
     */
    private getRoomFromId(id: string, isSelected: boolean): RoomOfRoomPickerView {
        const room = this.props.matrixClient.getRoom(id);
        if (!room) {
            throw new Error(`Cannot find room with id ${id} from client.`);
        }
        return roomToViewRoom(room, isSelected);
    }

    /**
     * Get a list of rooms filtered by the search query and mark them as selected if they are in the selectedRoomsMap.
     */
    private getRoomsWithFilter(query: string): RoomOfRoomPickerView[] {
        const lowerCasedQuery = query.toLocaleLowerCase();
        const rooms = fromModuleRooms(this.roomsByRecency)
            // Filter by query (all strings include the empty string so no query returns everything)
            .filter((r) => r.name.toLocaleLowerCase().includes(lowerCasedQuery))
            // Mark rooms as selected if they are in the selectedRoomsMap
            .map((room) => {
                room.selected = this.selectedRoomsMap.has(room.id);
                return room;
            });
        // If there's no search query, cap to 8 rooms otherwise we'd show ALL THE ROOMS which would be silly.
        // If there's a search query, however, show everything that matches it.
        if (query === "") {
            return rooms.slice(0, 8);
        }

        return rooms;
    }

    /**
     * Select the room if it isn't selected yet, unselect it otherwise.
     * @param roomId - The id of the room the user clicked on.
     */
    public toggleRoom = (roomId: string): void => {
        let rooms = this.snapshot.current.rooms;

        if (this.selectedRoomsMap.has(roomId)) {
            // Update the rooms list to reflect the unselection
            this.unSelectRoom(roomId);
        } else {
            // Add the room to the map
            const room = this.getRoomFromId(roomId, true);
            this.selectedRoomsMap.set(roomId, room);

            // reset to all rooms as the filter will have been cleared
            rooms = this.getRoomsWithFilter("");
        }

        // Update state
        const selectedRooms = Array.from(this.selectedRoomsMap.values());
        this.snapshot.merge({ rooms, selectedRooms, isValid: this.areRoomsSelectedDifferent(selectedRooms) });
    };

    /**
     * Unselect a room both from the selectedRoomsMap and the rooms list.
     * @param id - The id of the room to unselect.
     */
    private unSelectRoom(id: string): void {
        // Find the selected room
        const selectedRoom = this.selectedRoomsMap.get(id);
        if (!selectedRoom) {
            logger.warn(`Trying to unselect room ${id} but no such room in selectedRoomsMap`);
            return;
        }

        // Remove from the map
        this.selectedRoomsMap.delete(selectedRoom.id);

        // Unselect the room
        const room = this.getSnapshot().rooms.find((r) => r.id === id);
        if (room) {
            room.selected = false;
        }
    }

    /**
     * Unselect the room that was selected last. Does nothing if no room is selected.
     */
    public unSelectLastRoom = (): void => {
        const lastRoomId = Array.from(this.selectedRoomsMap.keys()).pop();
        if (!lastRoomId) return;

        this.unSelectRoom(lastRoomId);

        const selectedRooms = Array.from(this.selectedRoomsMap.values());
        this.snapshot.merge({ selectedRooms, isValid: this.areRoomsSelectedDifferent(selectedRooms) });
    };

    /**
     * Check if the selected rooms are different from the ones that were already in the section when the room selection step opened.
     */
    private areRoomsSelectedDifferent(selectedRooms: RoomOfRoomPickerView[]): boolean {
        return (
            this.roomsAlreadyInSection.size !== selectedRooms.length ||
            !selectedRooms.every((r) => this.roomsAlreadyInSection.has(r.id))
        );
    }

    /**
     * Filter the room list with what the user typed in the search input.
     * @param query - The search query.
     */
    public search = throttle((query: string) => {
        const rooms = this.getRoomsWithFilter(query);
        this.snapshot.merge({ rooms });
    }, 500);

    /**
     * Render the avatar of a room shown in the picker.
     * @param room - The room to render the avatar for.
     * @param size - The size of the avatar, such as "32px".
     */
    public renderRoomAvatar = (room: RoomOfRoomPickerView, size?: string): React.ReactNode => {
        const sdkRoom = this.props.matrixClient.getRoom(room.id);
        if (!sdkRoom) {
            logger.error(`No room such room: ${room.id}`);
            return;
        }
        return <RoomAvatar room={sdkRoom} size={size} />;
    };
}

/**
 * Convert room object into a minimal object for the view.
 * @param room Js-sdk room object`
 * @returns Room object for the view
 */
function roomToViewRoom(room: Room, isSelected = false): RoomOfRoomPickerView {
    const isDM = Boolean(DMRoomMap.shared().getUserIdForRoomId(room.roomId));
    const lastActive = room.getLastActiveTimestamp();

    return {
        id: room.roomId,
        description: room.roomId,
        selected: isSelected,
        name: room.name,
        timestamp: isDM && lastActive > 0 ? lastActive : undefined,
    };
}

/**
 * Convert room objects to minimal objects for the view.
 * @param rooms List of js-sdk Room objects
 * @returns List of rooms for the view
 */
function fromModuleRooms(rooms: Room[]): RoomOfRoomPickerView[] {
    return rooms.map((r) => roomToViewRoom(r));
}
