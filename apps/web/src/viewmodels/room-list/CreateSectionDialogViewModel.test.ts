/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { createTestClient, mkStubRoom } from "test-utils";

import { CreateSectionDialogViewModel } from "./CreateSectionDialogViewModel";
import type RoomListStoreV3 from "../../stores/room-list-v3/RoomListStoreV3";
import DMRoomMap from "../../utils/DMRoomMap";

const SECTION_TAG = "element.io.section.abc";

describe("CreateSectionDialogViewModel", () => {
    let onFinished: Mock<(sectionName?: string, roomsToTag?: string[], roomsToUntag?: string[]) => void>;
    let matrixClient: MatrixClient;
    let roomListStore: RoomListStoreV3;
    let rooms: Room[];

    beforeEach(() => {
        onFinished = vi.fn();
        matrixClient = createTestClient();
        rooms = [
            mkStubRoom("!first:matrix.org", "First room", matrixClient),
            mkStubRoom("!second:matrix.org", "Second room", matrixClient),
            mkStubRoom("!other:matrix.org", "Something else", matrixClient),
        ];
        // getLastTimestamp uses the bump stamp when it is set, which gives us control over recency.
        rooms.forEach((room, i) => vi.mocked(room.getBumpStamp).mockReturnValue(i + 1));
        vi.mocked(matrixClient.getRoom).mockImplementation(
            (roomId) => rooms.find((room) => room.roomId === roomId) ?? null,
        );
        roomListStore = { getRooms: () => rooms } as unknown as RoomListStoreV3;
        DMRoomMap.makeShared(matrixClient);
    });

    function createViewModel(
        sectionToEdit?: { name: string; tag: string },
        preselectedRoomId?: string,
    ): CreateSectionDialogViewModel {
        return new CreateSectionDialogViewModel({
            onFinished,
            sectionToEdit,
            preselectedRoomId,
            matrixClient,
            roomListStore,
        });
    }

    /**
     * Create a view model that has moved past the section name and reached the room selection step.
     * @param sectionToEdit - The section being edited, when the dialog is not creating a new one.
     * @param preselectedRoomId - The room the section is created from, when there is one.
     */
    function createViewModelOnRoomStep(
        sectionToEdit?: { name: string; tag: string },
        preselectedRoomId?: string,
    ): CreateSectionDialogViewModel {
        const vm = createViewModel(sectionToEdit, preselectedRoomId);
        vm.setSection(sectionToEdit?.name ?? "General");
        vm.nextStep();
        return vm;
    }

    /**
     * Mark a room as belonging to the section being edited.
     * @param room - The room to put in the section.
     */
    function putRoomInSection(room: Room): void {
        room.tags = { ...room.tags, [SECTION_TAG]: {} };
    }

    describe("creation mode (no section to edit)", () => {
        it("should initialize an empty, invalid snapshot", () => {
            const vm = createViewModel();

            expect(vm.getSnapshot()).toMatchObject({ value: "", step: "creation", isValid: false });
        });

        it("should not offer any room before the room selection step", () => {
            const vm = createViewModel();

            expect(vm.getSnapshot().rooms).toEqual([]);
        });
    });

    describe("room selection step", () => {
        it("should offer the rooms of the room list store, most recent first", () => {
            const vm = createViewModelOnRoomStep();

            expect(vm.getSnapshot().rooms.map((room) => room.name)).toEqual([
                "Something else",
                "Second room",
                "First room",
            ]);
            expect(vm.getSnapshot().selectedRooms).toEqual([]);
        });

        it("should report the selected rooms as rooms to tag when submitted", () => {
            const vm = createViewModelOnRoomStep();

            vm.toggleRoom("!second:matrix.org");
            vm.nextStep();

            expect(onFinished).toHaveBeenCalledWith("General", ["!second:matrix.org"], []);
        });
    });

    describe("room preselected by the caller", () => {
        const PRESELECTED = "!second:matrix.org";

        it("should select the room and make the step submittable", () => {
            const vm = createViewModelOnRoomStep(undefined, PRESELECTED);

            expect(vm.getSnapshot().selectedRooms.map((room) => room.id)).toEqual([PRESELECTED]);
            expect(vm.getSnapshot().rooms.find((room) => room.id === PRESELECTED)?.selected).toBe(true);
            expect(vm.getSnapshot().isValid).toBe(true);
        });

        it("should report the room as a room to tag when submitted", () => {
            const vm = createViewModelOnRoomStep(undefined, PRESELECTED);

            vm.nextStep();

            expect(onFinished).toHaveBeenCalledWith("General", [PRESELECTED], []);
        });

        it("should report no room when the user unselects it before submitting", () => {
            const vm = createViewModelOnRoomStep(undefined, PRESELECTED);

            vm.toggleRoom(PRESELECTED);
            vm.nextStep();

            expect(onFinished).toHaveBeenCalledWith("General", [], []);
        });
    });

    describe("edition mode (existing section name)", () => {
        const sectionToEdit = { name: "My section", tag: SECTION_TAG };

        it("should initialize the snapshot from the section name", () => {
            const vm = createViewModel(sectionToEdit);

            expect(vm.getSnapshot()).toMatchObject({ value: "My section", step: "editing", isValid: true });
        });

        it("should preselect the rooms that are already in the section", () => {
            putRoomInSection(rooms[0]);

            const vm = createViewModelOnRoomStep(sectionToEdit);

            expect(vm.getSnapshot().selectedRooms.map((room) => room.id)).toEqual(["!first:matrix.org"]);
        });

        it("should report a deselected room as a room to untag", () => {
            putRoomInSection(rooms[0]);

            const vm = createViewModelOnRoomStep(sectionToEdit);
            vm.toggleRoom("!first:matrix.org");
            vm.nextStep();

            expect(onFinished).toHaveBeenCalledWith("My section", [], ["!first:matrix.org"]);
        });

        it("should leave the rooms that are still selected out of both lists", () => {
            putRoomInSection(rooms[0]);

            const vm = createViewModelOnRoomStep(sectionToEdit);
            vm.toggleRoom("!second:matrix.org");
            vm.nextStep();

            expect(onFinished).toHaveBeenCalledWith("My section", ["!second:matrix.org"], []);
        });

        it("should not be submittable while the selection matches the section", () => {
            putRoomInSection(rooms[0]);

            const vm = createViewModelOnRoomStep(sectionToEdit);

            expect(vm.getSnapshot().isValid).toBe(false);
        });

        it("should become submittable when a room is added to the section", () => {
            putRoomInSection(rooms[0]);

            const vm = createViewModelOnRoomStep(sectionToEdit);
            vm.toggleRoom("!second:matrix.org");

            expect(vm.getSnapshot().isValid).toBe(true);
        });

        it("should become submittable when a room is removed from the section", () => {
            putRoomInSection(rooms[0]);

            const vm = createViewModelOnRoomStep(sectionToEdit);
            vm.toggleRoom("!first:matrix.org");

            expect(vm.getSnapshot().isValid).toBe(true);
        });

        it("should become submittable when a room is swapped for another", () => {
            putRoomInSection(rooms[0]);

            const vm = createViewModelOnRoomStep(sectionToEdit);
            vm.toggleRoom("!first:matrix.org");
            vm.toggleRoom("!second:matrix.org");

            // As many rooms as before, but not the same ones
            expect(vm.getSnapshot().selectedRooms.map((room) => room.id)).toEqual(["!second:matrix.org"]);
            expect(vm.getSnapshot().isValid).toBe(true);
        });

        it("should stop being submittable when the original selection is restored", () => {
            putRoomInSection(rooms[0]);

            const vm = createViewModelOnRoomStep(sectionToEdit);
            vm.toggleRoom("!first:matrix.org");
            expect(vm.getSnapshot().isValid).toBe(true);

            vm.toggleRoom("!first:matrix.org");
            expect(vm.getSnapshot().isValid).toBe(false);
        });

        it("should stop being submittable when unSelectLastRoom restores the original selection", () => {
            putRoomInSection(rooms[0]);

            const vm = createViewModelOnRoomStep(sectionToEdit);
            vm.toggleRoom("!second:matrix.org");
            expect(vm.getSnapshot().isValid).toBe(true);

            vm.unSelectLastRoom();
            expect(vm.getSnapshot().selectedRooms.map((room) => room.id)).toEqual(["!first:matrix.org"]);
            expect(vm.getSnapshot().isValid).toBe(false);
        });
    });

    describe("setSection", () => {
        it("should update the value and mark it valid for a non-empty name", () => {
            const vm = createViewModel();

            vm.setSection("General");
            expect(vm.getSnapshot()).toMatchObject({ value: "General", isValid: true });
        });

        it("should mark a whitespace-only name as invalid", () => {
            const vm = createViewModel();

            vm.setSection("   ");
            expect(vm.getSnapshot()).toMatchObject({ value: "   ", isValid: false });
        });
    });

    describe("createOrEditSection", () => {
        it("should move to the room selection step once the name is valid", () => {
            const vm = createViewModel();

            vm.setSection("General");
            vm.createOrEditSection();

            expect(vm.getSnapshot().step).toBe("add_rooms");
            expect(onFinished).not.toHaveBeenCalled();
        });

        it("should stay on the current step while the name is invalid", () => {
            const vm = createViewModel();

            vm.createOrEditSection();

            expect(vm.getSnapshot().step).toBe("creation");
            expect(onFinished).not.toHaveBeenCalled();
        });
    });

    describe("cancel", () => {
        it("should drop the section when the name was not submitted", () => {
            const vm = createViewModel();

            vm.setSection("General");
            vm.cancel();

            expect(onFinished).toHaveBeenCalledWith(undefined, undefined);
        });

        it("should keep the section but touch no room when the room selection step was reached", () => {
            const vm = createViewModel();

            vm.setSection("General");
            vm.nextStep();
            vm.cancel();

            expect(onFinished).toHaveBeenCalledWith("General", undefined);
        });
    });

    describe("toggleRoom", () => {
        it("should select a room and then unselect it", () => {
            const vm = createViewModelOnRoomStep();
            expect(vm.getSnapshot().isValid).toBe(false);

            vm.toggleRoom("!second:matrix.org");
            expect(vm.getSnapshot().selectedRooms.map((room) => room.id)).toEqual(["!second:matrix.org"]);
            expect(vm.getSnapshot().rooms.find((room) => room.id === "!second:matrix.org")?.selected).toBe(true);
            expect(vm.getSnapshot().isValid).toBe(true);

            vm.toggleRoom("!second:matrix.org");
            expect(vm.getSnapshot().selectedRooms).toEqual([]);
            expect(vm.getSnapshot().rooms.find((room) => room.id === "!second:matrix.org")?.selected).toBe(false);
            expect(vm.getSnapshot().isValid).toBe(false);
        });
    });

    describe("unSelectLastRoom", () => {
        it("should unselect the room that was selected last", () => {
            const vm = createViewModelOnRoomStep();

            vm.toggleRoom("!first:matrix.org");
            vm.toggleRoom("!second:matrix.org");
            vm.unSelectLastRoom();

            expect(vm.getSnapshot().selectedRooms.map((room) => room.id)).toEqual(["!first:matrix.org"]);
            expect(vm.getSnapshot().isValid).toBe(true);
        });

        it("should do nothing when no room is selected", () => {
            const vm = createViewModelOnRoomStep();

            vm.unSelectLastRoom();

            expect(vm.getSnapshot().selectedRooms).toEqual([]);
            expect(vm.getSnapshot().isValid).toBe(false);
        });
    });

    describe("search", () => {
        it("should only keep the rooms matching the query, most recent first", () => {
            const vm = createViewModelOnRoomStep();

            vm.search("room");

            expect(vm.getSnapshot().rooms.map((room) => room.name)).toEqual(["Second room", "First room"]);
        });
    });
});
