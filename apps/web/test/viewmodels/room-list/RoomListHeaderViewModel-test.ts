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
import { createTestClient, mkSpace } from "../../test-utils";
import { createRoom, hasCreateRoomRights } from "../../../src/viewmodels/room-list/utils";
import PosthogTrackers from "../../../src/PosthogTrackers";
import { ReleaseAnnouncementStore } from "../../../src/stores/ReleaseAnnouncementStore";
import { TestSDKContext } from "../../unit-tests/TestSDKContext.ts";

jest.mock("../../../src/PosthogTrackers", () => ({
    trackInteraction: jest.fn(),
    trackSectionCreation: jest.fn(),
    trackCollapseOrExpandSection: jest.fn(),
}));

jest.mock("../../../src/utils/space", () => ({
    shouldShowSpaceSettings: jest.fn(),
    showCreateNewRoom: jest.fn(),
    showSpaceInvite: jest.fn(),
    showSpacePreferences: jest.fn(),
    showSpaceSettings: jest.fn(),
}));

jest.mock("../../../src/viewmodels/room-list/utils", () => ({
    createRoom: jest.fn(),
    hasCreateRoomRights: jest.fn(),
}));

describe("RoomListHeaderViewModel", () => {
    let matrixClient: MatrixClient;
    let mockSpace: Room;
    let vm: RoomListHeaderViewModel;
    let sdkContext: TestSDKContext;

    beforeEach(() => {
        matrixClient = createTestClient();
        sdkContext = new TestSDKContext();
        sdkContext._client = matrixClient;

        mockSpace = mkSpace(matrixClient, "!space:server");

        mocked(hasCreateRoomRights).mockReturnValue(true);
        mocked(shouldShowSpaceSettings).mockReturnValue(true);

        jest.spyOn(ReleaseAnnouncementStore.instance, "getReleaseAnnouncement").mockReturnValue(null);
        jest.spyOn(ReleaseAnnouncementStore.instance, "nextReleaseAnnouncement").mockResolvedValue(undefined);

        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
            if (settingName === "RoomList.preferredSorting") return SortingAlgorithm.Recency;
            if (settingName === "feature_video_rooms") return true;
            if (settingName === "feature_element_call_video_rooms") return true;
            if (settingName === "RoomList.OrderedCustomSections") return [];
            return false;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        vm.dispose();
    });

    describe("snapshot", () => {
        it("should compute snapshot for Home space", () => {
            jest.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(MetaSpace.Home);
            jest.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(null);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

            const snapshot = vm.getSnapshot();
            expect(snapshot.title).toBe("Home");
            expect(snapshot.displaySpaceMenu).toBe(false);
            expect(snapshot.canCreateRoom).toBe(true);
            expect(snapshot.canCreateVideoRoom).toBe(true);
            expect(snapshot.activeSortOption).toBe("recent");
        });

        it("should compute snapshot for active space", () => {
            jest.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            jest.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(mockSpace);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

            const snapshot = vm.getSnapshot();
            expect(snapshot.title).toBe(mockSpace.roomId);
        });

        it("should hide video room option when feature is disabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "feature_video_rooms") return false;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().canCreateVideoRoom).toBe(false);
        });

        it("should show alphabetical sort option when RoomList.preferredSorting is Alphabetic", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.preferredSorting") return SortingAlgorithm.Alphabetic;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().activeSortOption).toBe("alphabetical");
        });

        it("should show invite option when space is public", () => {
            jest.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            jest.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(mockSpace);
            jest.spyOn(mockSpace, "getJoinRule").mockReturnValue(JoinRule.Public);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().canInviteInSpace).toBe(true);
        });

        it("should hide invite option when user cannot invite", () => {
            mocked(mockSpace.canInvite).mockReturnValue(false);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().canInviteInSpace).toBe(false);
        });

        it("should hide space settings when user cannot access them", () => {
            jest.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            mocked(shouldShowSpaceSettings).mockReturnValue(false);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().canAccessSpaceSettings).toBe(false);
        });

        it("should show message preview when RoomList.showMessagePreview is enabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.showMessagePreview") return true;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().isMessagePreviewEnabled).toBe(true);
        });

        it("should set areSectionsEnabled to true when RoomList.showSections is enabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.showSections") return true;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().areSectionsEnabled).toBe(true);
        });

        it("should update areSectionsEnabled when RoomList.showSections setting changes", () => {
            let watchCallback: () => void = () => {};
            jest.spyOn(SettingsStore, "watchSetting").mockImplementation((settingName, _roomId, callback) => {
                if (settingName === "RoomList.showSections") watchCallback = callback as () => void;
                return "watcher-id";
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().areSectionsEnabled).toBe(false);

            // Enable sections
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.showSections") return true;
                return false;
            });
            watchCallback();

            expect(vm.getSnapshot().areSectionsEnabled).toBe(true);
        });

        it("should set displaySectionReleaseAnnouncement to true when sections feature is enabled and announcement is active", () => {
            jest.spyOn(ReleaseAnnouncementStore.instance, "getReleaseAnnouncement").mockReturnValue(
                "room_list_section",
            );

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().displaySectionReleaseAnnouncement).toBe(true);
        });
    });

    describe("event listeners", () => {
        it.each([UPDATE_SELECTED_SPACE, UPDATE_HOME_BEHAVIOUR])(
            "should update snapshot when %s event is emitted",
            (event) => {
                jest.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(MetaSpace.Home);
                jest.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(null);

                vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

                jest.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
                jest.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(mockSpace);
                sdkContext.spaceStore.emit(event);

                expect(vm.getSnapshot().title).toBe(mockSpace.roomId);
            },
        );

        it("should update snapshot when space name changes", () => {
            jest.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            jest.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(mockSpace);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

            mockSpace.name = "new name";
            mockSpace.emit(RoomEvent.Name, mockSpace);

            expect(vm.getSnapshot().title).toBe("new name");
        });
    });

    describe("actions", () => {
        beforeEach(() => {
            jest.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            jest.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(mockSpace);
        });

        it("should fire CreateChat action when createChatRoom is called", () => {
            const fireSpy = jest.spyOn(defaultDispatcher, "fire");
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

            vm.createChatRoom(new Event("click"));
            expect(fireSpy).toHaveBeenCalledWith(Action.CreateChat);
        });

        it("should call createRoom with active space when in a space", () => {
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.createRoom(new Event("click"));

            expect(createRoom).toHaveBeenCalledWith(mockSpace);
        });

        it("should show create video room dialog for space when createVideoRoom is called", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "feature_element_call_video_rooms") return false;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.createVideoRoom();
            expect(showCreateNewRoom).toHaveBeenCalledWith(mockSpace, RoomType.ElementVideo);
        });

        it("should use UnstableCall type when element_call_video_rooms is enabled", () => {
            jest.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(null);

            const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.createVideoRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.CreateRoom,
                type: RoomType.UnstableCall,
            });
        });

        it("should dispatch ViewRoom action when openSpaceHome is called", () => {
            const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.openSpaceHome();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: "!space:server",
                metricsTrigger: undefined,
            });
        });

        it("should show space invite dialog when inviteInSpace is called", () => {
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.inviteInSpace();

            expect(showSpaceInvite).toHaveBeenCalledWith(mockSpace);
        });

        it("should show space preferences dialog when openSpacePreferences is called", () => {
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.openSpacePreferences();

            expect(showSpacePreferences).toHaveBeenCalledWith(mockSpace);
        });

        it("should show space settings dialog when openSpaceSettings is called", () => {
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.openSpaceSettings();

            expect(showSpaceSettings).toHaveBeenCalledWith(mockSpace);
        });

        it.each([
            ["recent" as const, SortingAlgorithm.Recency],
            ["alphabetical" as const, SortingAlgorithm.Alphabetic],
            ["unread-first" as const, SortingAlgorithm.Unread],
        ])("should resort when sort is called with '%s'", (option, expectedAlgorithm) => {
            const resortSpy = jest.spyOn(RoomListStoreV3.instance, "resort").mockImplementation(jest.fn());
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.sort(option);
            expect(resortSpy).toHaveBeenCalledWith(expectedAlgorithm);
        });

        it("should track analytics on resort", () => {
            jest.spyOn(RoomListStoreV3.instance, "activeSortAlgorithm", "get").mockReturnValue(
                SortingAlgorithm.Alphabetic,
            );
            PosthogTrackers.trackRoomListSortingAlgorithmChange = jest.fn();

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            jest.spyOn(RoomListStoreV3.instance, "resort").mockImplementation(jest.fn());
            vm.sort("unread-first");

            expect(PosthogTrackers.trackRoomListSortingAlgorithmChange).toHaveBeenCalledWith(
                SortingAlgorithm.Alphabetic,
                SortingAlgorithm.Unread,
            );
        });

        it("should call createSection on RoomListStoreV3 when createSection is called", () => {
            const createSectionSpy = jest
                .spyOn(RoomListStoreV3.instance, "createSection")
                .mockResolvedValue("element.io.section.work");
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.createSection();
            expect(createSectionSpy).toHaveBeenCalled();
        });

        describe("collapseOrExpandSections", () => {
            it("should dispatch RoomListCollapseAllSections when collapseSections is not 'expand'", () => {
                const fireSpy = jest.spyOn(defaultDispatcher, "fire");
                vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

                vm.collapseOrExpandSections();

                expect(fireSpy).toHaveBeenCalledWith(Action.RoomListCollapseAllSections);
            });

            it("should dispatch RoomListExpandAllSections when collapseSections is 'expand'", () => {
                const fireSpy = jest.spyOn(defaultDispatcher, "fire");
                vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

                // Drive the VM into the "expand" state by simulating all sections collapsed
                defaultDispatcher.dispatch(
                    {
                        action: Action.RoomListSectionsCollapseStateChanged,
                        collapseSections: "collapse",
                    },
                    true,
                );
                expect(vm.getSnapshot().collapseSections).toBe("expand");
                vm.collapseOrExpandSections();

                expect(fireSpy).toHaveBeenCalledWith(Action.RoomListExpandAllSections);
            });
        });

        describe("RoomListSectionsCollapseStateChanged handling", () => {
            it("should set collapseSections to 'expand' when collapseSections is collapse", () => {
                vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

                defaultDispatcher.dispatch(
                    {
                        action: Action.RoomListSectionsCollapseStateChanged,
                        collapseSections: "collapse",
                    },
                    true,
                );

                expect(vm.getSnapshot().collapseSections).toBe("expand");
            });

            it("should set collapseSections to 'collapse' when collapseSections is expand", () => {
                vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

                defaultDispatcher.dispatch(
                    {
                        action: Action.RoomListSectionsCollapseStateChanged,
                        collapseSections: "expand",
                    },
                    true,
                );

                expect(vm.getSnapshot().collapseSections).toBe("collapse");
            });

            it("should set collapseSections to undefined when collapseSections is undefined", () => {
                vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

                // First drive it into a non-undefined state
                defaultDispatcher.dispatch(
                    {
                        action: Action.RoomListSectionsCollapseStateChanged,
                        collapseSections: "collapse",
                    },
                    true,
                );
                expect(vm.getSnapshot().collapseSections).toBe("expand");

                defaultDispatcher.dispatch(
                    {
                        action: Action.RoomListSectionsCollapseStateChanged,
                        collapseSections: undefined,
                    },
                    true,
                );

                expect(vm.getSnapshot().collapseSections).toBeUndefined();
            });
        });

        it("should toggle message preview from enabled to disabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.showMessagePreview") return true;
                return false;
            });
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockImplementation(jest.fn());

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().isMessagePreviewEnabled).toBe(true);

            vm.toggleMessagePreview();

            expect(setValueSpy).toHaveBeenCalledWith("RoomList.showMessagePreview", null, expect.anything(), false);
            expect(vm.getSnapshot().isMessagePreviewEnabled).toBe(false);
        });

        it("should call nextReleaseAnnouncement and set displaySectionReleaseAnnouncement to false when closeSectionReleaseAnnouncement is called", () => {
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

            vm.closeSectionReleaseAnnouncement();

            expect(ReleaseAnnouncementStore.instance.nextReleaseAnnouncement).toHaveBeenCalled();
            expect(vm.getSnapshot().displaySectionReleaseAnnouncement).toBe(false);
        });
    });
});
