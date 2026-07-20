/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { waitFor } from "jest-matrix-react";
import fetchMock from "@fetch-mock/jest";

import {
    handleClipboardEvent,
    isEventToHandleAsClipboardEvent,
} from "../../../../../../../src/components/views/rooms/wysiwyg_composer/hooks/utils";
import type { RoomUploadViewModel } from "../../../../../../../src/viewmodels/room/RoomUploadViewModel";
import type { MockedObject } from "jest-mock";

const mockUploadVM = {
    initiateViaDataTransfer: jest.fn().mockResolvedValue(undefined),
    initiateViaInputFiles: jest.fn().mockResolvedValue(undefined),
} as Partial<RoomUploadViewModel> as MockedObject<RoomUploadViewModel>;

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
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockUploadVM);
        expect(output).toBe(false);
        expect(mockUploadVM.initiateViaDataTransfer).not.toHaveBeenCalled();
    });

    it("returns false if clipboard data is null", () => {
        const originalEvent = createMockClipboardEvent({ type: "paste", clipboardData: null });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockUploadVM);
        expect(output).toBe(false);
        expect(mockUploadVM.initiateViaDataTransfer).not.toHaveBeenCalled();
    });

    it("returns false if room clipboardData files and types are empty", () => {
        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: { files: [], types: [] },
        });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockUploadVM);
        expect(output).toBe(false);
        expect(mockUploadVM.initiateViaDataTransfer).not.toHaveBeenCalled();
    });

    it("handles event and calls sendContentListToRoom when data files are present", () => {
        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: { files: ["something here"], types: [] },
        });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockUploadVM);
        expect(mockUploadVM.initiateViaDataTransfer).toHaveBeenCalledTimes(1);
        expect(mockUploadVM.initiateViaDataTransfer).toHaveBeenCalledWith(originalEvent.clipboardData);
        expect(output).toBe(true);
    });

    it("calls the error handler when sentContentListToRoom errors", async () => {
        const mockErrorMessage = "something went wrong";
        mockUploadVM.initiateViaDataTransfer.mockRejectedValueOnce(new Error(mockErrorMessage));

        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: { files: ["something here"], types: [] },
        });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockUploadVM);

        expect(mockUploadVM.initiateViaDataTransfer).toHaveBeenCalledTimes(1);
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
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockUploadVM);
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
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockUploadVM);

        expect(fetchMock).toHaveFetchedTimes(1, "blob:");
        expect(output).toBe(true);
    });

    it("calls error handler when fetch fails", async () => {
        const mockErrorMessage = "fetch failed";
        fetchMock.getOnce("blob:", { throws: new Error(mockErrorMessage) });
        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: {
                files: [],
                types: ["text/html"],
                getData: jest.fn().mockReturnValue(`<img src="blob:" />`),
            },
        });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockUploadVM);

        await waitFor(() => {
            expect(logSpy).toHaveBeenCalledWith(mockErrorMessage);
        });
        expect(output).toBe(true);
    });

    it("calls initiateViaInputFiles when parsing is successful", async () => {
        fetchMock.get("test/file", {
            blob: () => {
                return Promise.resolve({ type: "image/jpeg" } as Blob);
            },
        });

        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: {
                files: [],
                types: ["text/html"],
                getData: jest.fn().mockReturnValue(`<img src="blob:" />`),
            },
        });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockUploadVM);

        await waitFor(() => {
            expect(mockUploadVM.initiateViaInputFiles).toHaveBeenCalledTimes(1);
            expect(mockUploadVM.initiateViaInputFiles).toHaveBeenCalledWith([expect.any(File)]);
        });
        expect(output).toBe(true);
    });

    it("calls error handler when parsing is not successful", async () => {
        fetchMock.get("test/file", {
            blob: () => {
                return Promise.resolve({ type: "image/jpeg" } as Blob);
            },
        });
        const mockErrorMessage = "initiateViaInputFiles failed";
        mockUploadVM.initiateViaInputFiles.mockRejectedValueOnce(mockErrorMessage);

        const originalEvent = createMockClipboardEvent({
            type: "paste",
            clipboardData: {
                files: [],
                types: ["text/html"],
                getData: jest.fn().mockReturnValue(`<img src="blob:" />`),
            },
        });
        const output = handleClipboardEvent(originalEvent, originalEvent.clipboardData, mockUploadVM);

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
