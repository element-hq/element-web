/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, fireEvent, waitFor } from "jest-matrix-react";
import fetchMock from "@fetch-mock/jest";
import { EventType } from "matrix-js-sdk/src/matrix";

import { GifButton } from "../../../../../src/components/views/rooms/GifButton";
import { createTestClient, getRoomContext, mkStubRoom } from "../../../../test-utils";
import * as ContentMessages from "../../../../../src/ContentMessages";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";
import type { RoomContextType } from "../../../../../src/contexts/RoomContext.ts";

jest.mock("../../../../../src/ContentMessages", () => ({
    ...jest.requireActual("../../../../../src/ContentMessages"),
    uploadFile: jest.fn(),
}));

describe("GifButton", () => {
    const mockClient = createTestClient();
    const roomId = "!testroom:example.org";

    const mockGifResult = {
        id: "gif-1",
        title: "Test GIF",
        content_description: "A funny cat",
        media_formats: {
            gif: { url: "https://klipy.com/full.gif", dims: [480, 360], duration: 2, size: 500_000 },
            tinygif: { url: "https://klipy.com/tiny.gif", dims: [220, 165], duration: 2, size: 50_000 },
            mediumgif: { url: "https://klipy.com/medium.gif", dims: [320, 240], duration: 2, size: 200_000 },
            nanogif: { url: "https://klipy.com/nano.gif", dims: [90, 68], duration: 2, size: 15_000 },
        },
        created: 1234567890,
        url: "https://klipy.com/view/gif-1",
    };

    beforeEach(() => {
        // Mock IntersectionObserver which is used by GifGrid for infinite scroll
        const mockIntersectionObserver = jest.fn().mockReturnValue({
            observe: jest.fn(),
            unobserve: jest.fn(),
            disconnect: jest.fn(),
        });
        window.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

        // Mock the Klipy featured endpoint to return a selectable GIF
        fetchMock.getOnce(
            "begin:https://api.klipy.com/v2/featured",
            { results: [mockGifResult], next: "" },
            { name: "klipy-featured" },
        );

        jest.mocked(ContentMessages.uploadFile).mockResolvedValue({ url: "mxc://example.org/uploaded-gif" });
        jest.mocked(mockClient.sendEvent).mockResolvedValue({ event_id: "$sent-event" });
    });

    function renderGifButton(): void {
        const mockRoom = mkStubRoom(roomId, "Test Room", mockClient) as any;
        const defaultRoomContext: RoomContextType = getRoomContext(mockRoom, { narrow: false });

        render(
            <MatrixClientContext.Provider value={mockClient}>
                <ScopedRoomContextProvider {...defaultRoomContext}>
                    <GifButton className="mx_MessageComposer_button" />
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
        );
    }

    it("should render the GIF button with correct label", () => {
        renderGifButton();
        expect(screen.getByRole("button", { name: "GIF" })).toBeInTheDocument();
    });

    it("should open the GIF picker when clicked", () => {
        renderGifButton();
        const button = screen.getByRole("button", { name: "GIF" });
        fireEvent.click(button);

        // The GifPicker renders a search input inside a ContextMenu
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render the 'Powered by Klipy' footer when picker is open", () => {
        renderGifButton();
        const button = screen.getByRole("button", { name: "GIF" });
        fireEvent.click(button);

        expect(screen.getByText("Powered by Klipy")).toBeInTheDocument();
    });

    it("should send a GIF as m.sticker when selected", async () => {
        // Mock the fetch of the GIF binary from Klipy CDN
        const gifBlob = new Blob(["gif-data"], { type: "image/gif" });
        fetchMock.getOnce("https://klipy.com/full.gif", { status: 200, body: gifBlob }, { name: "gif-download" });

        renderGifButton();

        // Open the picker
        const button = screen.getByRole("button", { name: "GIF" });
        fireEvent.click(button);

        // Wait for the trending GIFs to load, then click the first one
        const gifButton = await screen.findByTitle("A funny cat");
        fireEvent.click(gifButton);

        // Verify uploadFile was called with the Matrix client, room ID, and a blob
        await waitFor(() => {
            expect(ContentMessages.uploadFile).toHaveBeenCalledWith(mockClient, roomId, expect.any(Blob));
        });

        // Verify sendEvent was called with m.sticker and the correct content
        await waitFor(() => {
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                roomId,
                null, // no thread
                EventType.Sticker,
                expect.objectContaining({
                    "body": "A funny cat",
                    "url": "mxc://example.org/uploaded-gif",
                    "io.element.gif": true,
                    "info": expect.objectContaining({
                        "w": 480,
                        "h": 360,
                        "mimetype": "image/gif",
                        "io.element.animated": true,
                    }),
                }),
            );
        });
    });
});
