/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { TestSDKContext } from "test-utils";

import { RoomListSearchViewModel } from "./RoomListSearchViewModel";
import { MetaSpace } from "../../stores/spaces";
import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";

vi.mock("../../customisations/helpers/UIComponents", () => ({
    shouldShowComponent: vi.fn(),
}));

vi.mock("../../PosthogTrackers", () => ({
    default: {
        trackInteraction: vi.fn(),
    },
}));

describe("RoomListSearchViewModel", () => {
    const context = new TestSDKContext();

    beforeEach(() => {
        vi.mocked(shouldShowComponent).mockReturnValue(true);
        context._LegacyCallHandler = new LegacyCallHandler(context);
        vi.spyOn(context._LegacyCallHandler, "getSupportsPstnProtocol").mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("snapshot", () => {
        it("should show explore button in Home space when UIComponent.ExploreRooms is enabled", () => {
            vi.mocked(shouldShowComponent).mockReturnValue(true);
            const vm = new RoomListSearchViewModel({
                activeSpace: MetaSpace.Home,
                legacyCallHandler: context.legacyCallHandler,
            });

            expect(vm.getSnapshot().displayExploreButton).toBe(true);
        });

        it("should hide explore button when not in Home space", () => {
            vi.mocked(shouldShowComponent).mockReturnValue(true);
            const vm = new RoomListSearchViewModel({
                activeSpace: MetaSpace.VideoRooms,
                legacyCallHandler: context.legacyCallHandler,
            });

            expect(vm.getSnapshot().displayExploreButton).toBe(false);
        });

        it("should hide explore button when UIComponent.ExploreRooms is disabled", () => {
            vi.mocked(shouldShowComponent).mockReturnValue(false);
            const vm = new RoomListSearchViewModel({
                activeSpace: MetaSpace.Home,
                legacyCallHandler: context.legacyCallHandler,
            });

            expect(vm.getSnapshot().displayExploreButton).toBe(false);
        });

        it("should show dial button when PSTN protocol is supported", () => {
            vi.spyOn(context.legacyCallHandler, "getSupportsPstnProtocol").mockReturnValue(true);
            const vm = new RoomListSearchViewModel({
                activeSpace: MetaSpace.Home,
                legacyCallHandler: context.legacyCallHandler,
            });

            expect(vm.getSnapshot().displayDialButton).toBe(true);
        });

        it("should hide dial button when PSTN protocol is not supported", () => {
            vi.spyOn(context.legacyCallHandler, "getSupportsPstnProtocol").mockReturnValue(false);
            const vm = new RoomListSearchViewModel({
                activeSpace: MetaSpace.Home,
                legacyCallHandler: context.legacyCallHandler,
            });

            expect(vm.getSnapshot().displayDialButton).toBe(false);
        });
    });

    describe("actions", () => {
        it("should fire OpenSpotlight action when onSearchClick is called", () => {
            const fireSpy = vi.spyOn(defaultDispatcher, "fire");
            const vm = new RoomListSearchViewModel({
                activeSpace: MetaSpace.Home,
                legacyCallHandler: context.legacyCallHandler,
            });

            vm.onSearchClick();
            expect(fireSpy).toHaveBeenCalledWith(Action.OpenSpotlight);
        });

        it("should fire OpenDialPad action when onDialPadClick is called", () => {
            const fireSpy = vi.spyOn(defaultDispatcher, "fire");
            const vm = new RoomListSearchViewModel({
                activeSpace: MetaSpace.Home,
                legacyCallHandler: context.legacyCallHandler,
            });

            vm.onDialPadClick();
            expect(fireSpy).toHaveBeenCalledWith(Action.OpenDialPad);
        });

        it("should fire ViewRoomDirectory action and track interaction when onExploreClick is called", () => {
            const fireSpy = vi.spyOn(defaultDispatcher, "fire");
            const vm = new RoomListSearchViewModel({
                activeSpace: MetaSpace.Home,
                legacyCallHandler: context.legacyCallHandler,
            });

            const mockEvent = {} as React.MouseEvent<HTMLButtonElement>;
            vm.onExploreClick(mockEvent);

            expect(fireSpy).toHaveBeenCalledWith(Action.ViewRoomDirectory);
        });
    });

    it("should update snapshot when PSTN protocol support changes", () => {
        vi.spyOn(context.legacyCallHandler, "getSupportsPstnProtocol").mockReturnValue(false);
        const vm = new RoomListSearchViewModel({
            activeSpace: MetaSpace.Home,
            legacyCallHandler: context.legacyCallHandler,
        });

        expect(vm.getSnapshot().displayDialButton).toBe(false);

        // Simulate PSTN protocol support change
        vi.spyOn(context.legacyCallHandler, "getSupportsPstnProtocol").mockReturnValue(true);
        context.legacyCallHandler.emit(LegacyCallHandlerEvent.ProtocolSupport);

        expect(vm.getSnapshot().displayDialButton).toBe(true);

        vm.dispose();
    });
});
