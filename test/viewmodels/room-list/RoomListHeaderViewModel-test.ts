/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { mocked } from "jest-mock";
import { JoinRule, type MatrixClient, type Room, RoomEvent, RoomType } from "matrix-js-sdk/src/matrix";

import { RoomListHeaderViewModel } from "../../../src/viewmodels/room-list/RoomListHeaderViewModel";
import { MetaSpace, UPDATE_HOME_BEHAVIOUR, UPDATE_SELECTED_SPACE } from "../../../src/stores/spaces";
import SpaceStore from "../../../src/stores/spaces/SpaceStore";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SortingAlgorithm } from "../../../src/stores/room-list-v3/skip-list/sorters";
import RoomListStoreV3 from "../../../src/stores/room-list-v3/RoomListStoreV3";
import {
    shouldShowSpaceSettings,
    showCreateNewRoom,
    showSpaceInvite,
    showSpacePreferences,
    showSpaceSettings,
} from "../../../src/utils/space";
import { createRoom, hasCreateRoomRights } from "../../../src/components/viewmodels/roomlist/utils";
import { createTestClient, mkSpace } from "../../test-utils";

jest.mock("../../../src/PosthogTrackers", () => ({
    trackInteraction: jest.fn(),
}));

jest.mock("../../../src/utils/space", () => ({
    shouldShowSpaceSettings: jest.fn(),
    showCreateNewRoom: jest.fn(),
    showSpaceInvite: jest.fn(),
    showSpacePreferences: jest.fn(),
    showSpaceSettings: jest.fn(),
}));

jest.mock("../../../src/components/viewmodels/roomlist/utils", () => ({
    createRoom: jest.fn(),
    hasCreateRoomRights: jest.fn(),
}));

describe("RoomListHeaderViewModel", () => {
    let matrixClient: MatrixClient;
    let mockSpace: Room;
    let vm: RoomListHeaderViewModel;

    beforeEach(() => {
        matrixClient = createTestClient();

        mockSpace = mkSpace(matrixClient, "!space:server");

        mocked(hasCreateRoomRights).mockReturnValue(true);
        mocked(shouldShowSpaceSettings).mockReturnValue(true);

        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
            if (settingName === "RoomList.preferredSorting") return SortingAlgorithm.Recency;
            if (settingName === "feature_video_rooms") return true;
            if (settingName === "feature_element_call_video_rooms") return true;
            return false;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        vm.dispose();
    });

    describe("snapshot", () => {
        it("should compute snapshot for Home space", () => {
            jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockReturnValue(MetaSpace.Home);
            jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(null);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });

            const snapshot = vm.getSnapshot();
            expect(snapshot.title).toBe("Home");
            expect(snapshot.displayComposeMenu).toBe(true);
            expect(snapshot.displaySpaceMenu).toBe(false);
            expect(snapshot.canCreateRoom).toBe(true);
            expect(snapshot.canCreateVideoRoom).toBe(true);
            expect(snapshot.activeSortOption).toBe("recent");
        });

        it("should compute snapshot for active space", () => {
            jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(mockSpace);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });

            const snapshot = vm.getSnapshot();
            expect(snapshot.title).toBe(mockSpace.roomId);
        });

        it("should hide video room option when feature is disabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "feature_video_rooms") return false;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            expect(vm.getSnapshot().canCreateVideoRoom).toBe(false);
        });

        it("should show alphabetical sort option when RoomList.preferredSorting is Alphabetic", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.preferredSorting") return SortingAlgorithm.Alphabetic;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            expect(vm.getSnapshot().activeSortOption).toBe("alphabetical");
        });

        it("should hide compose menu when user cannot create rooms", () => {
            mocked(hasCreateRoomRights).mockReturnValue(false);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });

            const snapshot = vm.getSnapshot();
            expect(snapshot.displayComposeMenu).toBe(false);
            expect(snapshot.canCreateRoom).toBe(false);
        });

        it("should show invite option when space is public", () => {
            jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(mockSpace);
            jest.spyOn(mockSpace, "getJoinRule").mockReturnValue(JoinRule.Public);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            expect(vm.getSnapshot().canInviteInSpace).toBe(true);
        });

        it("should hide invite option when user cannot invite", () => {
            mocked(mockSpace.canInvite).mockReturnValue(false);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            expect(vm.getSnapshot().canInviteInSpace).toBe(false);
        });

        it("should hide space settings when user cannot access them", () => {
            jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            mocked(shouldShowSpaceSettings).mockReturnValue(false);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            expect(vm.getSnapshot().canAccessSpaceSettings).toBe(false);
        });

        it("should show message preview when RoomList.showMessagePreview is enabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.showMessagePreview") return true;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            expect(vm.getSnapshot().isMessagePreviewEnabled).toBe(true);
        });
    });

    describe("event listeners", () => {
        it.each([UPDATE_SELECTED_SPACE, UPDATE_HOME_BEHAVIOUR])(
            "should update snapshot when %s event is emitted",
            (event) => {
                jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockReturnValue(MetaSpace.Home);
                jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(null);

                vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });

                jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
                jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(mockSpace);
                SpaceStore.instance.emit(event);

                expect(vm.getSnapshot().title).toBe(mockSpace.roomId);
            },
        );

        it("should update snapshot when space name changes", () => {
            jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(mockSpace);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });

            mockSpace.name = "new name";
            mockSpace.emit(RoomEvent.Name, mockSpace);

            expect(vm.getSnapshot().title).toBe("new name");
        });
    });

    describe("actions", () => {
        beforeEach(() => {
            jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(mockSpace);
        });

        it("should fire CreateChat action when createChatRoom is called", () => {
            const fireSpy = jest.spyOn(defaultDispatcher, "fire");
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });

            vm.createChatRoom(new Event("click"));
            expect(fireSpy).toHaveBeenCalledWith(Action.CreateChat);
        });

        it("should call createRoom with active space when in a space", () => {
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            vm.createRoom(new Event("click"));

            expect(createRoom).toHaveBeenCalledWith(mockSpace);
        });

        it("should show create video room dialog for space when createVideoRoom is called", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "feature_element_call_video_rooms") return false;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            vm.createVideoRoom();
            expect(showCreateNewRoom).toHaveBeenCalledWith(mockSpace, RoomType.ElementVideo);
        });

        it("should use UnstableCall type when element_call_video_rooms is enabled", () => {
            jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(null);

            const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            vm.createVideoRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.CreateRoom,
                type: RoomType.UnstableCall,
            });
        });

        it("should dispatch ViewRoom action when openSpaceHome is called", () => {
            const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            vm.openSpaceHome();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: "!space:server",
                metricsTrigger: undefined,
            });
        });

        it("should show space invite dialog when inviteInSpace is called", () => {
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            vm.inviteInSpace();

            expect(showSpaceInvite).toHaveBeenCalledWith(mockSpace);
        });

        it("should show space preferences dialog when openSpacePreferences is called", () => {
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            vm.openSpacePreferences();

            expect(showSpacePreferences).toHaveBeenCalledWith(mockSpace);
        });

        it("should show space settings dialog when openSpaceSettings is called", () => {
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            vm.openSpaceSettings();

            expect(showSpaceSettings).toHaveBeenCalledWith(mockSpace);
        });

        it.each([
            ["recent" as const, SortingAlgorithm.Recency],
            ["alphabetical" as const, SortingAlgorithm.Alphabetic],
            ["unread-first" as const, SortingAlgorithm.Unread],
        ])("should resort when sort is called with '%s'", (option, expectedAlgorithm) => {
            const resortSpy = jest.spyOn(RoomListStoreV3.instance, "resort").mockImplementation(jest.fn());
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            vm.sort(option);

            expect(resortSpy).toHaveBeenCalledWith(expectedAlgorithm);
        });

        it("should toggle message preview from enabled to disabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.showMessagePreview") return true;
                return false;
            });
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockImplementation(jest.fn());

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: SpaceStore.instance });
            expect(vm.getSnapshot().isMessagePreviewEnabled).toBe(true);

            vm.toggleMessagePreview();

            expect(setValueSpy).toHaveBeenCalledWith("RoomList.showMessagePreview", null, expect.anything(), false);
            expect(vm.getSnapshot().isMessagePreviewEnabled).toBe(false);
        });
    });
});
