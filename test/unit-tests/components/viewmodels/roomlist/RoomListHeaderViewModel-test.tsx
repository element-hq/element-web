/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { renderHook } from "jest-matrix-react";
import { type MatrixClient, RoomType } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { useRoomListHeaderViewModel } from "../../../../../src/components/viewmodels/roomlist/RoomListHeaderViewModel";
import SpaceStore from "../../../../../src/stores/spaces/SpaceStore";
import { mkStubRoom, stubClient } from "../../../../test-utils";
import { shouldShowComponent } from "../../../../../src/customisations/helpers/UIComponents";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";

jest.mock("../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("useRoomListHeaderViewModel", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = stubClient();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe("title", () => {
        it("should return Home as title", () => {
            const { result } = renderHook(() => useRoomListHeaderViewModel());
            expect(result.current.title).toStrictEqual("Home");
        });

        it("should return the current space name as title", () => {
            const room = mkStubRoom("spaceId", "spaceName", matrixClient);
            jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(room);
            const { result } = renderHook(() => useRoomListHeaderViewModel());

            expect(result.current.title).toStrictEqual("spaceName");
        });
    });

    it("should be displayComposeMenu=true and canCreateRoom=true if the user can creates room", () => {
        mocked(shouldShowComponent).mockReturnValue(false);
        const { result, rerender } = renderHook(() => useRoomListHeaderViewModel());
        expect(result.current.displayComposeMenu).toBe(false);
        expect(result.current.canCreateRoom).toBe(false);

        mocked(shouldShowComponent).mockReturnValue(true);
        rerender();
        expect(result.current.displayComposeMenu).toBe(true);
        expect(result.current.canCreateRoom).toBe(true);
    });

    it("should be canCreateVideoRoom=true if feature_video_rooms is enabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        const { result } = renderHook(() => useRoomListHeaderViewModel());
        expect(result.current.canCreateVideoRoom).toBe(true);
    });

    it("should fire Action.CreateChat when createChatRoom is called", () => {
        const spy = jest.spyOn(defaultDispatcher, "fire");
        const { result } = renderHook(() => useRoomListHeaderViewModel());
        result.current.createChatRoom(new Event("click"));

        expect(spy).toHaveBeenCalledWith(Action.CreateChat);
    });

    it("should fire Action.CreateRoom when createRoom is called", () => {
        const spy = jest.spyOn(defaultDispatcher, "fire");
        const { result } = renderHook(() => useRoomListHeaderViewModel());
        result.current.createRoom(new Event("click"));

        expect(spy).toHaveBeenCalledWith(Action.CreateRoom);
    });

    it("should fire Action.CreateRoom with RoomType.UnstableCall when createVideoRoom is called and feature_element_call_video_rooms is enabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        const spy = jest.spyOn(defaultDispatcher, "dispatch");
        const { result } = renderHook(() => useRoomListHeaderViewModel());
        result.current.createVideoRoom();

        expect(spy).toHaveBeenCalledWith({ action: Action.CreateRoom, type: RoomType.UnstableCall });
    });

    it("should fire Action.CreateRoom with RoomType.ElementVideo when createVideoRoom is called and feature_element_call_video_rooms is disabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        const spy = jest.spyOn(defaultDispatcher, "dispatch");
        const { result } = renderHook(() => useRoomListHeaderViewModel());
        result.current.createVideoRoom();

        expect(spy).toHaveBeenCalledWith({ action: Action.CreateRoom, type: RoomType.ElementVideo });
    });
});
