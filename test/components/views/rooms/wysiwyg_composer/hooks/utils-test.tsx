/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { IEventRelation, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { waitFor } from "@testing-library/react";

import { TimelineRenderingType } from "../../../../../../src/contexts/RoomContext";
import { mkStubRoom, stubClient } from "../../../../../test-utils";
import ContentMessages from "../../../../../../src/ContentMessages";
import { IRoomState } from "../../../../../../src/components/structures/RoomView";
import {
    handleClipboardEvent,
    isEventToHandleAsClipboardEvent,
} from "../../../../../../src/components/views/rooms/wysiwyg_composer/hooks/utils";

const mockClient = stubClient();
const mockRoom = mkStubRoom("mock room", "mock room", mockClient);
const mockRoomState = {
    room: mockRoom,
    timelineRenderingType: TimelineRenderingType.Room,
    replyToEvent: {} as unknown as MatrixEvent,
} as unknown as IRoomState;

const sendContentListToRoomSpy = jest.spyOn(ContentMessages.sharedInstance(), "sendContentListToRoom");
const sendContentToRoomSpy = jest.spyOn(ContentMessages.sharedInstance(), "sendContentToRoom");
const fetchSpy = jest.spyOn(window, "fetch");
const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

describe("handleClipboardEvent", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    function createMockClipboardEvent(props: any): ClipboardEvent {
        return { clipboardData: { files: [], types: [] }, ...props } as ClipboardEvent;
    }

    it("returns false if it is not a paste event", () => {
        const originalEvent = createMockClipboardEvent({ type: "copy" });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockRoomState, mockClient);

        expect(output).toBe(false);
    });

    it("returns false if clipboard data is null", () => {
        const originalEvent = createMockClipboardEvent({ type: "paste", clipboardData: null });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockRoomState, mockClient);

        expect(output).toBe(false);
    });

    it("returns false if room is undefined", () => {
        const originalEvent = createMockClipboardEvent({ type: "paste" });
        const { room, ...roomStateWithoutRoom } = mockRoomState;
        const output = handleClipboardEvent(
            originalEvent,
            originalEvent.clipboardData,
            roomStateWithoutRoom,
            mockClient,
        );

        expect(output).toBe(false);
    });

    it("returns false if room clipboardData files and types are empty", () => {
        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: { files: [], types: [] },
        });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockRoomState, mockClient);
        expect(output).toBe(false);
    });

    it("handles event and calls sendContentListToRoom when data files are present", () => {
        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: { files: ["something here"], types: [] },
        });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockRoomState, mockClient);

        expect(sendContentListToRoomSpy).toHaveBeenCalledTimes(1);
        expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
            originalEvent.clipboardData?.files,
            mockRoom.roomId,
            undefined, // this is the event relation, an optional arg
            mockClient,
            mockRoomState.timelineRenderingType,
        );
        expect(output).toBe(true);
    });

    it("calls sendContentListToRoom with eventRelation when present", () => {
        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: { files: ["something here"], types: [] },
        });
        const mockEventRelation = {} as unknown as IEventRelation;
        const output = handleClipboardEvent(
            originalEvent,
            originalEvent.clipboardData,
            mockRoomState,
            mockClient,
            mockEventRelation,
        );

        expect(sendContentListToRoomSpy).toHaveBeenCalledTimes(1);
        expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
            originalEvent.clipboardData?.files,
            mockRoom.roomId,
            mockEventRelation, // this is the event relation, an optional arg
            mockClient,
            mockRoomState.timelineRenderingType,
        );
        expect(output).toBe(true);
    });

    it("calls the error handler when sentContentListToRoom errors", async () => {
        const mockErrorMessage = "something went wrong";
        sendContentListToRoomSpy.mockRejectedValueOnce(new Error(mockErrorMessage));

        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: { files: ["something here"], types: [] },
        });
        const mockEventRelation = {} as unknown as IEventRelation;
        const output = handleClipboardEvent(
            originalEvent,
            originalEvent.clipboardData,
            mockRoomState,
            mockClient,
            mockEventRelation,
        );

        expect(sendContentListToRoomSpy).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(logSpy).toHaveBeenCalledWith(mockErrorMessage);
        });
        expect(output).toBe(true);
    });

    it("calls the error handler when data types has text/html but data can not be parsed", () => {
        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: {
                files: [],
                types: ["text/html"],
                getData: jest.fn().mockReturnValue("<div>invalid html"),
            },
        });
        const mockEventRelation = {} as unknown as IEventRelation;
        const output = handleClipboardEvent(
            originalEvent,
            originalEvent.clipboardData,
            mockRoomState,
            mockClient,
            mockEventRelation,
        );

        expect(logSpy).toHaveBeenCalledWith("Failed to handle pasted content as Safari inserted content");
        expect(output).toBe(false);
    });

    it("calls fetch when data types has text/html and data can parsed", () => {
        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: {
                files: [],
                types: ["text/html"],
                getData: jest.fn().mockReturnValue(`<img src="blob:" />`),
            },
        });
        const mockEventRelation = {} as unknown as IEventRelation;
        handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockRoomState, mockClient, mockEventRelation);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledWith("blob:");
    });

    it("calls error handler when fetch fails", async () => {
        const mockErrorMessage = "fetch failed";
        fetchSpy.mockRejectedValueOnce(mockErrorMessage);
        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: {
                files: [],
                types: ["text/html"],
                getData: jest.fn().mockReturnValue(`<img src="blob:" />`),
            },
        });
        const mockEventRelation = {} as unknown as IEventRelation;
        const output = handleClipboardEvent(
            originalEvent,
            originalEvent.clipboardData,
            mockRoomState,
            mockClient,
            mockEventRelation,
        );

        await waitFor(() => {
            expect(logSpy).toHaveBeenCalledWith(mockErrorMessage);
        });
        expect(output).toBe(true);
    });

    it("calls sendContentToRoom when parsing is successful", async () => {
        fetchSpy.mockResolvedValueOnce({
            url: "test/file",
            blob: () => {
                return Promise.resolve({ type: "image/jpeg" } as Blob);
            },
        } as Response);

        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: {
                files: [],
                types: ["text/html"],
                getData: jest.fn().mockReturnValue(`<img src="blob:" />`),
            },
        });
        const mockEventRelation = {} as unknown as IEventRelation;
        const output = handleClipboardEvent(
            originalEvent,
            originalEvent.clipboardData,
            mockRoomState,
            mockClient,
            mockEventRelation,
        );

        await waitFor(() => {
            expect(sendContentToRoomSpy).toHaveBeenCalledWith(
                expect.any(File),
                mockRoom.roomId,
                mockEventRelation,
                mockClient,
                mockRoomState.replyToEvent,
            );
        });
        expect(output).toBe(true);
    });

    it("calls error handler when parsing is not successful", async () => {
        fetchSpy.mockResolvedValueOnce({
            url: "test/file",
            blob: () => {
                return Promise.resolve({ type: "image/jpeg" } as Blob);
            },
        } as Response);
        const mockErrorMessage = "sendContentToRoom failed";
        sendContentToRoomSpy.mockRejectedValueOnce(mockErrorMessage);

        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: {
                files: [],
                types: ["text/html"],
                getData: jest.fn().mockReturnValue(`<img src="blob:" />`),
            },
        });
        const mockEventRelation = {} as unknown as IEventRelation;
        const output = handleClipboardEvent(
            originalEvent,
            originalEvent.clipboardData,
            mockRoomState,
            mockClient,
            mockEventRelation,
        );

        await waitFor(() => {
            expect(logSpy).toHaveBeenCalledWith(mockErrorMessage);
        });
        expect(output).toBe(true);
    });
});

describe("isEventToHandleAsClipboardEvent", () => {
    it("returns true for ClipboardEvent", () => {
        const input = new ClipboardEvent("clipboard");
        expect(isEventToHandleAsClipboardEvent(input)).toBe(true);
    });

    it("returns true for special case input", () => {
        const input = new InputEvent("insertFromPaste", { inputType: "insertFromPaste" });
        Object.assign(input, { dataTransfer: "not null" });
        expect(isEventToHandleAsClipboardEvent(input)).toBe(true);
    });

    it("returns false for regular InputEvent", () => {
        const input = new InputEvent("input");
        expect(isEventToHandleAsClipboardEvent(input)).toBe(false);
    });

    it("returns false for other input", () => {
        const input = new KeyboardEvent("keyboard");
        expect(isEventToHandleAsClipboardEvent(input)).toBe(false);
    });
});
