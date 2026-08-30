/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type Room } from "matrix-js-sdk/src/matrix";
import { ImagePacksButton } from "../../../../../src/components/views/rooms/ImagePacksButton";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext";

describe("ImagePacksButton", () => {
    let mockRoom: Room;

    beforeEach(() => {
        mockRoom = {
            roomId: "!room:example.org",
        } as unknown as Room;
    });

    const getWrapper = (room: Room | null = mockRoom) => {
        const roomContextValue = {
            room: room ?? undefined,
            roomId: room?.roomId,
        } as any;

        return (
            <ScopedRoomContextProvider {...roomContextValue}>
                <ImagePacksButton menuPosition={undefined} />
            </ScopedRoomContextProvider>
        );
    };

    it("renders the button if there is a room", () => {
        render(getWrapper());
        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("does not render if there is no room", () => {
        const { container } = render(getWrapper(null));
        expect(container.firstChild).toBeNull();
    });

    it("opens the context menu when clicked", async () => {
        render(getWrapper());
        const button = screen.getByRole("button");
        await userEvent.click(button);

        // Wait for the context menu to appear
        await waitFor(() => {
            expect(screen.getByText("Manage Image Packs")).toBeInTheDocument();
        });
    });
});
