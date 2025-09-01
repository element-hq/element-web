/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { renderHook, act } from "jest-matrix-react";
import { JoinRule, type MatrixClient, type Room, RoomType } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";
import { range } from "lodash";

import { useRoomListHeaderViewModel } from "../../../../../src/components/viewmodels/roomlist/RoomListHeaderViewModel";
import SpaceStore from "../../../../../src/stores/spaces/SpaceStore";
import { mkStubRoom, stubClient, withClientContextRenderOptions } from "../../../../test-utils";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import {
    shouldShowSpaceSettings,
    showCreateNewRoom,
    showSpaceInvite,
    showSpacePreferences,
    showSpaceSettings,
} from "../../../../../src/utils/space";
import { createRoom, hasCreateRoomRights } from "../../../../../src/components/viewmodels/roomlist/utils";
import RoomListStoreV3 from "../../../../../src/stores/room-list-v3/RoomListStoreV3";
import { SortOption } from "../../../../../src/components/viewmodels/roomlist/useSorter";
import { SortingAlgorithm } from "../../../../../src/stores/room-list-v3/skip-list/sorters";

jest.mock("../../../../../src/components/viewmodels/roomlist/utils", () => ({
    hasCreateRoomRights: jest.fn().mockReturnValue(false),
    createRoom: jest.fn(),
}));

jest.mock("../../../../../src/utils/space", () => ({
    shouldShowSpaceSettings: jest.fn(),
    showCreateNewRoom: jest.fn(),
    showSpaceInvite: jest.fn(),
    showSpacePreferences: jest.fn(),
    showSpaceSettings: jest.fn(),
}));

describe("useRoomListHeaderViewModel", () => {
    let matrixClient: MatrixClient;
    let space: Room;

    beforeEach(() => {
        matrixClient = stubClient();
        space = mkStubRoom("spaceId", "spaceName", matrixClient);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    function render() {
        return renderHook(() => useRoomListHeaderViewModel(), withClientContextRenderOptions(matrixClient));
    }

    describe("title", () => {
        it("should return Home as title", () => {
            const { result } = render();
            expect(result.current.title).toStrictEqual("Home");
        });

        it("should return the current space name as title", () => {
            jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
            const { result } = render();

            expect(result.current.title).toStrictEqual("spaceName");
        });
    });

    it("should be displayComposeMenu=true and canCreateRoom=true if the user can creates room", () => {
        mocked(hasCreateRoomRights).mockReturnValue(false);
        const { result, rerender } = render();
        expect(result.current.displayComposeMenu).toBe(false);
        expect(result.current.canCreateRoom).toBe(false);

        mocked(hasCreateRoomRights).mockReturnValue(true);
        rerender();
        expect(result.current.displayComposeMenu).toBe(true);
        expect(result.current.canCreateRoom).toBe(true);
    });

    it("should be displaySpaceMenu=true if the user is in a space", () => {
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
        const { result } = render();
        expect(result.current.displaySpaceMenu).toBe(true);
    });

    it("should be canInviteInSpace=true if the space join rule is public", () => {
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
        jest.spyOn(space, "getJoinRule").mockReturnValue(JoinRule.Public);

        const { result } = render();
        expect(result.current.displaySpaceMenu).toBe(true);
    });

    it("should be canInviteInSpace=true if the user has the right", () => {
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
        jest.spyOn(space, "canInvite").mockReturnValue(true);

        const { result } = render();
        expect(result.current.displaySpaceMenu).toBe(true);
    });

    it("should be canAccessSpaceSettings=true if the user has the right", () => {
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
        mocked(shouldShowSpaceSettings).mockReturnValue(true);

        const { result } = render();
        expect(result.current.canAccessSpaceSettings).toBe(true);
    });

    it("should be canCreateVideoRoom=true if feature_video_rooms is enabled and can create room", () => {
        mocked(hasCreateRoomRights).mockReturnValue(true);
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);

        const { result } = render();
        expect(result.current.canCreateVideoRoom).toBe(true);
    });

    it("should fire Action.CreateChat when createChatRoom is called", () => {
        const spy = jest.spyOn(defaultDispatcher, "fire");
        const { result } = render();
        result.current.createChatRoom(new Event("click"));

        expect(spy).toHaveBeenCalledWith(Action.CreateChat);
    });

    it("should call createRoom from utils when createRoom is called", () => {
        const { result } = render();
        result.current.createRoom(new Event("click"));

        expect(createRoom).toHaveBeenCalled();
    });

    it("should call createRoom from utils when createRoom is called in a space", () => {
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
        const { result } = render();
        result.current.createRoom(new Event("click"));

        expect(createRoom).toHaveBeenCalledWith(space);
    });

    it("should fire Action.CreateRoom with RoomType.UnstableCall when createVideoRoom is called and feature_element_call_video_rooms is enabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        const spy = jest.spyOn(defaultDispatcher, "dispatch");
        const { result } = render();
        result.current.createVideoRoom();

        expect(spy).toHaveBeenCalledWith({ action: Action.CreateRoom, type: RoomType.UnstableCall });
    });

    it("should fire Action.CreateRoom with RoomType.ElementVideo when createVideoRoom is called and feature_element_call_video_rooms is disabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        const spy = jest.spyOn(defaultDispatcher, "dispatch");
        const { result } = render();
        result.current.createVideoRoom();

        expect(spy).toHaveBeenCalledWith({ action: Action.CreateRoom, type: RoomType.ElementVideo });
    });

    it("should call showCreateNewRoom when createVideoRoom is called in a space", () => {
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
        const { result } = render();
        result.current.createVideoRoom();

        expect(showCreateNewRoom).toHaveBeenCalledWith(space, RoomType.ElementVideo);
    });

    it("should fire Action.ViewRoom when openSpaceHome is called in a space", () => {
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
        const spy = jest.spyOn(defaultDispatcher, "dispatch");
        const { result } = render();
        result.current.openSpaceHome();

        expect(spy).toHaveBeenCalledWith({ action: Action.ViewRoom, room_id: space.roomId, metricsTrigger: undefined });
    });

    it("should call showSpaceInvite when inviteInSpace is called in a space", () => {
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
        const { result } = render();
        result.current.inviteInSpace();

        expect(showSpaceInvite).toHaveBeenCalledWith(space);
    });

    it("should call showSpacePreferences when openSpacePreferences is called in a space", () => {
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
        const { result } = render();
        result.current.openSpacePreferences();

        expect(showSpacePreferences).toHaveBeenCalledWith(space);
    });

    it("should call showSpaceSettings when openSpaceSettings is called in a space", () => {
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(space);
        const { result } = render();
        result.current.openSpaceSettings();

        expect(showSpaceSettings).toHaveBeenCalledWith(space);
    });

    describe("Sorting", () => {
        function mockAndCreateRooms() {
            const rooms = range(10).map((i) => mkStubRoom(`foo${i}:matrix.org`, `Foo ${i}`, undefined));
            const fn = jest
                .spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace")
                .mockImplementation(() => ({ spaceId: "home", rooms: [...rooms] }));
            return { rooms, fn };
        }

        it("should change sort order", () => {
            mockAndCreateRooms();
            const { result: vm } = render();

            const resort = jest.spyOn(RoomListStoreV3.instance, "resort").mockImplementation(() => {});

            // Change the sort option
            act(() => {
                vm.current.sort(SortOption.AToZ);
            });

            // Resort method in RLS must have been called
            expect(resort).toHaveBeenCalledWith(SortingAlgorithm.Alphabetic);
        });

        it("should set activeSortOption based on value from settings", () => {
            // Let's say that the user's preferred sorting is alphabetic
            jest.spyOn(SettingsStore, "getValue").mockImplementation(() => SortingAlgorithm.Alphabetic);

            mockAndCreateRooms();
            const { result: vm } = render();
            expect(vm.current.activeSortOption).toEqual(SortOption.AToZ);
        });
    });
});
