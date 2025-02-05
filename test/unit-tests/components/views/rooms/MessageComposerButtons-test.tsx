/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { createTestClient, getRoomContext, mkStubRoom } from "../../../../test-utils";
import { type IRoomState } from "../../../../../src/components/structures/RoomView";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import MessageComposerButtons from "../../../../../src/components/views/rooms/MessageComposerButtons";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

describe("MessageComposerButtons", () => {
    // @ts-ignore - we're deliberately not implementing the whole interface here, but
    // can't use Partial<> for types because it'll annoy TS more than it helps.
    const mockProps: React.ComponentProps<typeof MessageComposerButtons> = {
        addEmoji: () => false,
        haveRecording: false,
        isStickerPickerOpen: false,
        menuPosition: undefined,
        onRecordStartEndClick: () => {},
        setStickerPickerOpen: () => {},
        toggleButtonMenu: () => {},
    };

    const mockClient = createTestClient();
    jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);

    function getButtonLabels() {
        const getLabels = (elements: HTMLElement[]): string[] =>
            elements
                .map((element) => element.getAttribute("aria-label"))
                .filter((label): label is string => label !== null);

        const mainLabels: Array<string | string[]> = getLabels(screen.queryAllByRole("button"));
        const menuLabels = getLabels(screen.queryAllByRole("menuitem"));

        if (menuLabels.length) {
            mainLabels.push(getLabels(screen.queryAllByRole("menuitem")));
        }

        return mainLabels;
    }

    function wrapAndRender(component: React.ReactElement, narrow: boolean) {
        const mockRoom = mkStubRoom("myfakeroom", "myfakeroom", mockClient) as any;
        const defaultRoomContext: IRoomState = getRoomContext(mockRoom, { narrow });

        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <ScopedRoomContextProvider {...defaultRoomContext}>{component}</ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
        );
    }

    it("Renders emoji and upload buttons in wide mode", () => {
        wrapAndRender(
            <MessageComposerButtons
                {...mockProps}
                isMenuOpen={false}
                showLocationButton={true}
                showPollsButton={true}
                showStickersButton={true}
            />,
            false,
        );

        expect(getButtonLabels()).toEqual(["Emoji", "Attachment", "More options"]);
    });

    it("Renders other buttons in menu in wide mode", async () => {
        wrapAndRender(
            <MessageComposerButtons
                {...mockProps}
                isMenuOpen={true}
                showLocationButton={true}
                showPollsButton={true}
                showStickersButton={true}
            />,
            false,
        );

        // The location code is lazy loaded, so the button will take a little while
        // to appear, so we need to wait.
        await waitFor(() => {
            expect(getButtonLabels()).toEqual([
                "Emoji",
                "Attachment",
                "More options",
                ["Sticker", "Voice Message", "Poll", "Location"],
            ]);
        });
    });

    it("Renders only some buttons in narrow mode", () => {
        wrapAndRender(
            <MessageComposerButtons
                {...mockProps}
                isMenuOpen={false}
                showLocationButton={true}
                showPollsButton={true}
                showStickersButton={true}
            />,
            true,
        );

        expect(getButtonLabels()).toEqual(["Emoji", "More options"]);
    });

    it("Renders other buttons in menu (except voice messages) in narrow mode", () => {
        wrapAndRender(
            <MessageComposerButtons
                {...mockProps}
                isMenuOpen={true}
                showLocationButton={true}
                showPollsButton={true}
                showStickersButton={true}
            />,
            true,
        );

        expect(getButtonLabels()).toEqual(["Emoji", "More options", ["Attachment", "Sticker", "Poll", "Location"]]);
    });

    describe("polls button", () => {
        it("should render when asked to", () => {
            wrapAndRender(
                <MessageComposerButtons
                    {...mockProps}
                    isMenuOpen={true}
                    showLocationButton={true}
                    showPollsButton={true}
                    showStickersButton={true}
                />,
                true,
            );

            expect(getButtonLabels()).toEqual(["Emoji", "More options", ["Attachment", "Sticker", "Poll", "Location"]]);
        });

        it("should not render when asked not to", () => {
            wrapAndRender(
                <MessageComposerButtons
                    {...mockProps}
                    isMenuOpen={true}
                    showLocationButton={true}
                    showPollsButton={false} // !! the change from the alternate test
                    showStickersButton={true}
                />,
                true,
            );

            expect(getButtonLabels()).toEqual([
                "Emoji",
                "More options",
                [
                    "Attachment",
                    "Sticker",
                    // "Poll", // should be hidden
                    "Location",
                ],
            ]);
        });
    });
});
