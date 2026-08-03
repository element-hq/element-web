/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook, waitFor } from "jest-matrix-react";
import { Room } from "matrix-js-sdk/src/matrix";

import { useContainsCommand } from "../../../../../../../src/components/views/rooms/wysiwyg_composer/hooks/useContainsCommand";
import { stubClient } from "../../../../../../test-utils";

// Mock CommandProvider
const mockGetCompletions = jest.fn();
jest.mock("../../../../../../../src/autocomplete/CommandProvider", () => {
    return jest.fn().mockImplementation(() => ({
        getCompletions: mockGetCompletions,
    }));
});

describe("useContainsCommand", () => {
    let room: Room;

    beforeEach(() => {
        const client = stubClient();
        room = new Room("!room:example.com", client, "@user:example.com");
        mockGetCompletions.mockClear();
        // Default mock to return empty promise
        mockGetCompletions.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should return false when content is null", async () => {
        mockGetCompletions.mockResolvedValue([]);

        const { result } = renderHook(() => useContainsCommand(null, room));

        await waitFor(() => {
            expect(result.current).toBe(false);
        });
        expect(mockGetCompletions).not.toHaveBeenCalled();
    });

    it("should return false when content is empty string", async () => {
        mockGetCompletions.mockResolvedValue([]);

        const { result } = renderHook(() => useContainsCommand("", room));

        await waitFor(() => {
            expect(result.current).toBe(false);
        });
        expect(mockGetCompletions).not.toHaveBeenCalled();
    });

    it("should return true when content contains a valid command", async () => {
        mockGetCompletions.mockResolvedValue([{ type: "command", completion: "/spoiler" }]);

        const { result } = renderHook(() => useContainsCommand("/spoiler test message", room));

        await waitFor(() => {
            expect(result.current).toBe(true);
        });
        expect(mockGetCompletions).toHaveBeenCalledWith("/spoiler test message", { start: 0, end: 0 });
    });

    it("should return false when content contains no valid commands", async () => {
        mockGetCompletions.mockResolvedValue([]);

        const { result } = renderHook(() => useContainsCommand("/invalidcommand", room));

        await waitFor(() => {
            expect(result.current).toBe(false);
        });
        expect(mockGetCompletions).toHaveBeenCalledWith("/invalidcommand", { start: 0, end: 0 });
    });

    it("should return true for partial command matches", async () => {
        mockGetCompletions.mockResolvedValue([
            { type: "command", completion: "/spoiler" },
            { type: "command", completion: "/shrug" },
        ]);

        const { result } = renderHook(() => useContainsCommand("/sp", room));

        await waitFor(() => {
            expect(result.current).toBe(true);
        });
        expect(mockGetCompletions).toHaveBeenCalledWith("/sp", { start: 0, end: 0 });
    });

    it("should update when content changes", async () => {
        mockGetCompletions.mockResolvedValue([]);

        const { result, rerender } = renderHook(({ content, room }) => useContainsCommand(content, room), {
            initialProps: { content: "/invalid", room },
        });

        await waitFor(() => {
            expect(result.current).toBe(false);
        });

        // Change to valid command
        mockGetCompletions.mockResolvedValue([{ type: "command", completion: "/spoiler" }]);

        rerender({ content: "/spoiler", room });

        await waitFor(() => {
            expect(result.current).toBe(true);
        });
        expect(mockGetCompletions).toHaveBeenCalledWith("/spoiler", { start: 0, end: 0 });
    });

    it("should handle CommandProvider errors gracefully", async () => {
        mockGetCompletions.mockRejectedValueOnce(new Error("Provider error"));

        const { result } = renderHook(() => useContainsCommand("/test", room));

        // Should remain false even if promise rejects
        await waitFor(() => {
            expect(result.current).toBe(false);
        });
    });

    it("should return false for non-command content", async () => {
        mockGetCompletions.mockResolvedValue([]); // CommandProvider returns empty for non-commands

        const { result } = renderHook(() => useContainsCommand("regular message", room));

        await waitFor(() => {
            expect(result.current).toBe(false);
        });
        expect(mockGetCompletions).toHaveBeenCalledWith("regular message", { start: 0, end: 0 });
    });

    it("should reset to false when switching to null content", async () => {
        mockGetCompletions.mockResolvedValue([{ type: "command", completion: "/spoiler" }]);

        const { result, rerender } = renderHook(
            ({ content, room }: { content: string | null; room: Room | undefined }) =>
                useContainsCommand(content, room),
            {
                initialProps: { content: "/spoiler" as string | null, room: room as Room | undefined },
            },
        );

        await waitFor(() => {
            expect(result.current).toBe(true);
        });

        // Switch to null content
        rerender({ content: null, room });

        await waitFor(() => {
            expect(result.current).toBe(false);
        });
    });
});
