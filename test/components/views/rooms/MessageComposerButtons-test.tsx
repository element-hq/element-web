/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { render, screen } from "@testing-library/react";

import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../../src/contexts/RoomContext";
import { createTestClient, getRoomContext, mkStubRoom } from "../../../test-utils";
import { IRoomState } from "../../../../src/components/structures/RoomView";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import MessageComposerButtons from "../../../../src/components/views/rooms/MessageComposerButtons";

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
                <RoomContext.Provider value={defaultRoomContext}>{component}</RoomContext.Provider>
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

    it("Renders other buttons in menu in wide mode", () => {
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

        expect(getButtonLabels()).toEqual([
            "Emoji",
            "Attachment",
            "More options",
            ["Sticker", "Voice Message", "Poll", "Location"],
        ]);
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

    describe("with showVoiceBroadcastButton = true", () => {
        it("should render the »Voice broadcast« button", () => {
            wrapAndRender(
                <MessageComposerButtons
                    {...mockProps}
                    isMenuOpen={true}
                    showLocationButton={true}
                    showPollsButton={true}
                    showStickersButton={true}
                    showVoiceBroadcastButton={true}
                />,
                false,
            );

            expect(getButtonLabels()).toEqual([
                "Emoji",
                "Attachment",
                "More options",
                ["Sticker", "Voice Message", "Voice broadcast", "Poll", "Location"],
            ]);
        });
    });
});
