/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { JoinRule, type MatrixClient, type Room, RoomEvent, RoomType } from "matrix-js-sdk/src/matrix";
import { createTestClient, mkSpace, TestSDKContext } from "test-utils";

import { RoomListHeaderViewModel } from "./RoomListHeaderViewModel";
import { MetaSpace, UPDATE_HOME_BEHAVIOUR, UPDATE_SELECTED_SPACE } from "../../stores/spaces";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import SettingsStore from "../../settings/SettingsStore";
import { SortingAlgorithm } from "../../stores/room-list-v3/skip-list/sorters";
import RoomListStoreV3 from "../../stores/room-list-v3/RoomListStoreV3";
import {
    shouldShowSpaceSettings,
    showCreateNewRoom,
    showSpaceInvite,
    showSpacePreferences,
    showSpaceSettings,
} from "../../utils/space";
import { createRoom, hasCreateRoomRights } from "./utils";
import PosthogTrackers from "../../PosthogTrackers";
import { ReleaseAnnouncementStore } from "../../stores/ReleaseAnnouncementStore";

vi.mock("../../PosthogTrackers", () => ({
    default: {
        trackInteraction: vi.fn(),
        trackSectionCreation: vi.fn(),
        trackCollapseOrExpandSection: vi.fn(),
    },
}));

vi.mock("../../utils/space", () => ({
    shouldShowSpaceSettings: vi.fn(),
    showCreateNewRoom: vi.fn(),
    showSpaceInvite: vi.fn(),
    showSpacePreferences: vi.fn(),
    showSpaceSettings: vi.fn(),
}));

vi.mock("./utils", () => ({
    createRoom: vi.fn(),
    hasCreateRoomRights: vi.fn(),
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

        vi.mocked(hasCreateRoomRights).mockReturnValue(true);
        vi.mocked(shouldShowSpaceSettings).mockReturnValue(true);

        vi.spyOn(ReleaseAnnouncementStore.instance, "getReleaseAnnouncement").mockReturnValue(null);
        vi.spyOn(ReleaseAnnouncementStore.instance, "nextReleaseAnnouncement").mockResolvedValue(undefined);

        vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
            if (settingName === "RoomList.preferredSorting") return SortingAlgorithm.Recency;
            if (settingName === "feature_video_rooms") return true;
            if (settingName === "feature_element_call_video_rooms") return true;
            if (settingName === "RoomList.OrderedCustomSections") return [];
            return false;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vm.dispose();
    });

    describe("snapshot", () => {
        it("should compute snapshot for Home space", () => {
            vi.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(MetaSpace.Home);
            vi.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(null);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

            const snapshot = vm.getSnapshot();
            expect(snapshot.title).toBe("Home");
            expect(snapshot.displaySpaceMenu).toBe(false);
            expect(snapshot.canCreateRoom).toBe(true);
            expect(snapshot.canCreateVideoRoom).toBe(true);
            expect(snapshot.activeSortOption).toBe("recent");
        });

        it("should compute snapshot for active space", () => {
            vi.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            vi.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(mockSpace);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

            const snapshot = vm.getSnapshot();
            expect(snapshot.title).toBe(mockSpace.roomId);
        });

        it("should hide video room option when feature is disabled", () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "feature_video_rooms") return false;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().canCreateVideoRoom).toBe(false);
        });

        it("should show alphabetical sort option when RoomList.preferredSorting is Alphabetic", () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.preferredSorting") return SortingAlgorithm.Alphabetic;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().activeSortOption).toBe("alphabetical");
        });

        it("should show invite option when space is public", () => {
            vi.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            vi.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(mockSpace);
            vi.spyOn(mockSpace, "getJoinRule").mockReturnValue(JoinRule.Public);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().canInviteInSpace).toBe(true);
        });

        it("should hide invite option when user cannot invite", () => {
            vi.mocked(mockSpace.canInvite).mockReturnValue(false);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().canInviteInSpace).toBe(false);
        });

        it("should hide space settings when user cannot access them", () => {
            vi.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            vi.mocked(shouldShowSpaceSettings).mockReturnValue(false);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().canAccessSpaceSettings).toBe(false);
        });

        it("should show message preview when RoomList.showMessagePreview is enabled", () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.showMessagePreview") return true;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().isMessagePreviewEnabled).toBe(true);
        });

        it("should set areSectionsEnabled to true when RoomList.showSections is enabled", () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.showSections") return true;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().areSectionsEnabled).toBe(true);
        });

        it("should update areSectionsEnabled when RoomList.showSections setting changes", () => {
            let watchCallback: () => void = () => {};
            vi.spyOn(SettingsStore, "watchSetting").mockImplementation((settingName, _roomId, callback) => {
                if (settingName === "RoomList.showSections") watchCallback = callback as () => void;
                return "watcher-id";
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().areSectionsEnabled).toBe(false);

            // Enable sections
            vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.showSections") return true;
                return false;
            });
            watchCallback();

            expect(vm.getSnapshot().areSectionsEnabled).toBe(true);
        });

        it("should set displaySectionReleaseAnnouncement to true when sections feature is enabled and announcement is active", () => {
            vi.spyOn(ReleaseAnnouncementStore.instance, "getReleaseAnnouncement").mockReturnValue("room_list_section");

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            expect(vm.getSnapshot().displaySectionReleaseAnnouncement).toBe(true);
        });
    });

    describe("event listeners", () => {
        it.each([UPDATE_SELECTED_SPACE, UPDATE_HOME_BEHAVIOUR])(
            "should update snapshot when %s event is emitted",
            (event) => {
                vi.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(MetaSpace.Home);
                vi.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(null);

                vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

                vi.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
                vi.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(mockSpace);
                sdkContext.spaceStore.emit(event);

                expect(vm.getSnapshot().title).toBe(mockSpace.roomId);
            },
        );

        it("should update snapshot when space name changes", () => {
            vi.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            vi.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(mockSpace);

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

            mockSpace.name = "new name";
            mockSpace.emit(RoomEvent.Name, mockSpace);

            expect(vm.getSnapshot().title).toBe("new name");
        });
    });

    describe("actions", () => {
        beforeEach(() => {
            vi.spyOn(sdkContext.spaceStore, "activeSpace", "get").mockReturnValue(mockSpace.roomId);
            vi.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(mockSpace);
        });

        it("should fire CreateChat action when createChatRoom is called", () => {
            const fireSpy = vi.spyOn(defaultDispatcher, "fire");
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
            vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "feature_element_call_video_rooms") return false;
                return false;
            });

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.createVideoRoom();
            expect(showCreateNewRoom).toHaveBeenCalledWith(mockSpace, RoomType.ElementVideo);
        });

        it("should use UnstableCall type when element_call_video_rooms is enabled", () => {
            vi.spyOn(sdkContext.spaceStore, "activeSpaceRoom", "get").mockReturnValue(null);

            const dispatchSpy = vi.spyOn(defaultDispatcher, "dispatch");
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.createVideoRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.CreateRoom,
                type: RoomType.UnstableCall,
            });
        });

        it("should dispatch ViewRoom action when openSpaceHome is called", () => {
            const dispatchSpy = vi.spyOn(defaultDispatcher, "dispatch");
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
            const resortSpy = vi.spyOn(RoomListStoreV3.instance, "resort").mockImplementation(vi.fn());
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.sort(option);
            expect(resortSpy).toHaveBeenCalledWith(expectedAlgorithm);
        });

        it("should track analytics on resort", () => {
            vi.spyOn(RoomListStoreV3.instance, "activeSortAlgorithm", "get").mockReturnValue(
                SortingAlgorithm.Alphabetic,
            );
            PosthogTrackers.trackRoomListSortingAlgorithmChange = vi.fn();

            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vi.spyOn(RoomListStoreV3.instance, "resort").mockImplementation(vi.fn());
            vm.sort("unread-first");

            expect(PosthogTrackers.trackRoomListSortingAlgorithmChange).toHaveBeenCalledWith(
                SortingAlgorithm.Alphabetic,
                SortingAlgorithm.Unread,
            );
        });

        it("should call createSection on RoomListStoreV3 when createSection is called", () => {
            const createSectionSpy = vi
                .spyOn(RoomListStoreV3.instance, "createSection")
                .mockResolvedValue("element.io.section.work");
            vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });
            vm.createSection();
            expect(createSectionSpy).toHaveBeenCalled();
        });

        describe("collapseOrExpandSections", () => {
            it("should dispatch RoomListCollapseAllSections when collapseSections is not 'expand'", () => {
                const fireSpy = vi.spyOn(defaultDispatcher, "fire");
                vm = new RoomListHeaderViewModel({ matrixClient, spaceStore: sdkContext.spaceStore });

                vm.collapseOrExpandSections();

                expect(fireSpy).toHaveBeenCalledWith(Action.RoomListCollapseAllSections);
            });

            it("should dispatch RoomListExpandAllSections when collapseSections is 'expand'", () => {
                const fireSpy = vi.spyOn(defaultDispatcher, "fire");
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
            vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                if (settingName === "RoomList.showMessagePreview") return true;
                return false;
            });
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockImplementation(vi.fn());

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
