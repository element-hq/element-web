/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";
import { act, type SyntheticEvent } from "react";

import { useRoomTopicViewModel } from "../../../../../src/components/viewmodels/right_panel/RoomSummaryCardTopicViewModel";
import { mkStubRoom, stubClient } from "../../../../test-utils";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { onRoomTopicLinkClick } from "../../../../../src/components/views/elements/RoomTopic";

jest.mock("../../../../../src/components/views/elements/RoomTopic");

describe("RoomSummaryCardTopicViewModel", () => {
    const client = stubClient();
    const mockRoom = mkStubRoom("!room:example.com", "Test Room", client);
    const mockUserId = "@user:example.com";
    const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as SyntheticEvent;

    beforeEach(() => {
        // Mock room client's getSafeUserId
        mockRoom.client.getSafeUserId = jest.fn().mockReturnValue(mockUserId);
        jest.spyOn(defaultDispatcher, "dispatch");

        (onRoomTopicLinkClick as jest.Mock).mockReset();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function render() {
        return renderHook(() => useRoomTopicViewModel(mockRoom));
    }

    it("should initialize with expanded state", () => {
        const { result } = render();
        expect(result.current.expanded).toBe(true);
    });

    it("should toggle expanded state on click", () => {
        const { result } = render();

        act(() => {
            result.current.onExpandedClick(mockEvent);
        });

        expect(result.current.expanded).toBe(false);
    });

    it("should handle edit click", () => {
        const { result } = render();
        result.current.onEditClick(mockEvent);
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "open_room_settings" });
    });

    it("should handle topic link clicks when the target is an anchor element", () => {
        const { result } = render();
        const mockAnchorEvent = { target: document.createElement("a") };

        result.current.onTopicLinkClick(mockAnchorEvent as any);
        expect(onRoomTopicLinkClick).toHaveBeenCalledWith(mockAnchorEvent as any);
    });

    it("should handle topic link clicks when the target is not an anchor element", () => {
        const { result } = render();
        const mockNonAnchorEvent = { target: document.createElement("div") };

        result.current.onTopicLinkClick(mockNonAnchorEvent as any);
        expect(onRoomTopicLinkClick).not.toHaveBeenCalled();
    });

    describe("Topic editing permissions", () => {
        it("should allow editing when user has permission", () => {
            mockRoom.currentState.maySendStateEvent = jest.fn().mockReturnValue(true);
            const { result } = render();
            expect(result.current.canEditTopic).toBe(true);
        });

        it("should not allow editing when user lacks permission", () => {
            mockRoom.currentState.maySendStateEvent = jest.fn().mockReturnValue(false);
            const { result } = render();
            expect(result.current.canEditTopic).toBe(false);
        });
    });
});
