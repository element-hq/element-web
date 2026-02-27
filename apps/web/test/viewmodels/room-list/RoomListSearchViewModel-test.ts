/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { mocked } from "jest-mock";

import { RoomListSearchViewModel } from "../../../src/viewmodels/room-list/RoomListSearchViewModel";
import { MetaSpace } from "../../../src/stores/spaces";
import { shouldShowComponent } from "../../../src/customisations/helpers/UIComponents";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../../src/LegacyCallHandler";

jest.mock("../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

jest.mock("../../../src/PosthogTrackers", () => ({
    trackInteraction: jest.fn(),
}));

describe("RoomListSearchViewModel", () => {
    beforeEach(() => {
        mocked(shouldShowComponent).mockReturnValue(true);
        jest.spyOn(LegacyCallHandler.instance, "getSupportsPstnProtocol").mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("snapshot", () => {
        it("should show explore button in Home space when UIComponent.ExploreRooms is enabled", () => {
            mocked(shouldShowComponent).mockReturnValue(true);
            const vm = new RoomListSearchViewModel({ activeSpace: MetaSpace.Home });

            expect(vm.getSnapshot().displayExploreButton).toBe(true);
        });

        it("should hide explore button when not in Home space", () => {
            mocked(shouldShowComponent).mockReturnValue(true);
            const vm = new RoomListSearchViewModel({ activeSpace: MetaSpace.VideoRooms });

            expect(vm.getSnapshot().displayExploreButton).toBe(false);
        });

        it("should hide explore button when UIComponent.ExploreRooms is disabled", () => {
            mocked(shouldShowComponent).mockReturnValue(false);
            const vm = new RoomListSearchViewModel({ activeSpace: MetaSpace.Home });

            expect(vm.getSnapshot().displayExploreButton).toBe(false);
        });

        it("should show dial button when PSTN protocol is supported", () => {
            jest.spyOn(LegacyCallHandler.instance, "getSupportsPstnProtocol").mockReturnValue(true);
            const vm = new RoomListSearchViewModel({ activeSpace: MetaSpace.Home });

            expect(vm.getSnapshot().displayDialButton).toBe(true);
        });

        it("should hide dial button when PSTN protocol is not supported", () => {
            jest.spyOn(LegacyCallHandler.instance, "getSupportsPstnProtocol").mockReturnValue(false);
            const vm = new RoomListSearchViewModel({ activeSpace: MetaSpace.Home });

            expect(vm.getSnapshot().displayDialButton).toBe(false);
        });
    });

    describe("actions", () => {
        it("should fire OpenSpotlight action when onSearchClick is called", () => {
            const fireSpy = jest.spyOn(defaultDispatcher, "fire");
            const vm = new RoomListSearchViewModel({ activeSpace: MetaSpace.Home });

            vm.onSearchClick();
            expect(fireSpy).toHaveBeenCalledWith(Action.OpenSpotlight);
        });

        it("should fire OpenDialPad action when onDialPadClick is called", () => {
            const fireSpy = jest.spyOn(defaultDispatcher, "fire");
            const vm = new RoomListSearchViewModel({ activeSpace: MetaSpace.Home });

            vm.onDialPadClick();
            expect(fireSpy).toHaveBeenCalledWith(Action.OpenDialPad);
        });

        it("should fire ViewRoomDirectory action and track interaction when onExploreClick is called", () => {
            const fireSpy = jest.spyOn(defaultDispatcher, "fire");
            const vm = new RoomListSearchViewModel({ activeSpace: MetaSpace.Home });

            const mockEvent = {} as React.MouseEvent<HTMLButtonElement>;
            vm.onExploreClick(mockEvent);

            expect(fireSpy).toHaveBeenCalledWith(Action.ViewRoomDirectory);
        });
    });

    it("should update snapshot when PSTN protocol support changes", () => {
        jest.spyOn(LegacyCallHandler.instance, "getSupportsPstnProtocol").mockReturnValue(false);
        const vm = new RoomListSearchViewModel({ activeSpace: MetaSpace.Home });

        expect(vm.getSnapshot().displayDialButton).toBe(false);

        // Simulate PSTN protocol support change
        jest.spyOn(LegacyCallHandler.instance, "getSupportsPstnProtocol").mockReturnValue(true);
        LegacyCallHandler.instance.emit(LegacyCallHandlerEvent.ProtocolSupport);

        expect(vm.getSnapshot().displayDialButton).toBe(true);

        vm.dispose();
    });
});
