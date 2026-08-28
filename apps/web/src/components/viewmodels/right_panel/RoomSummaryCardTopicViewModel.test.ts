/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook } from "test-utils-rtl";
import { act, type SyntheticEvent } from "react";
import { createTestClient, mkStubRoom } from "test-utils";

import { useRoomTopicViewModel } from "./RoomSummaryCardTopicViewModel";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { onRoomTopicLinkClick } from "../../views/elements/RoomTopic";

vi.mock("../../views/elements/RoomTopic");

describe("RoomSummaryCardTopicViewModel", () => {
    const client = createTestClient();
    const mockRoom = mkStubRoom("!room:example.com", "Test Room", client);
    const mockUserId = "@user:example.com";
    const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as SyntheticEvent;

    beforeEach(() => {
        // Mock room client's getSafeUserId
        mockRoom.client.getSafeUserId = vi.fn().mockReturnValue(mockUserId);
        vi.spyOn(defaultDispatcher, "dispatch");

        (onRoomTopicLinkClick as Mock).mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function render() {
        return renderHook(() => useRoomTopicViewModel(mockRoom));
    }

    it("should initialize with expanded state", () => {
        const { result } = render();
        expect(result.current.expanded).toBe(true);
    });

    it("should toggle expanded state on click", async () => {
        const { result } = render();

        await act(() => {
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
        const mockAnchorEvent = { target: document.createElement("a") } as unknown as React.MouseEvent<HTMLElement>;

        result.current.onTopicLinkClick(mockAnchorEvent);
        expect(onRoomTopicLinkClick).toHaveBeenCalledWith(mockAnchorEvent);
    });

    it("should handle topic link clicks when the target is not an anchor element", () => {
        const { result } = render();
        const mockNonAnchorEvent = {
            target: document.createElement("div"),
        } as unknown as React.MouseEvent<HTMLElement>;

        result.current.onTopicLinkClick(mockNonAnchorEvent);
        expect(onRoomTopicLinkClick).not.toHaveBeenCalled();
    });

    describe("Topic editing permissions", () => {
        it("should allow editing when user has permission", () => {
            mockRoom.currentState.maySendStateEvent = vi.fn().mockReturnValue(true);
            const { result } = render();
            expect(result.current.canEditTopic).toBe(true);
        });

        it("should not allow editing when user lacks permission", () => {
            mockRoom.currentState.maySendStateEvent = vi.fn().mockReturnValue(false);
            const { result } = render();
            expect(result.current.canEditTopic).toBe(false);
        });
    });
});
