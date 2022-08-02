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
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { Layout } from "../../../../src/settings/enums/Layout";
import RoomContext, { TimelineRenderingType } from "../../../../src/contexts/RoomContext";
import { createTestClient } from "../../../test-utils";
import { IRoomState } from "../../../../src/components/structures/RoomView";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import MessageComposerButtons from "../../../../src/components/views/rooms/MessageComposerButtons";

// @ts-ignore - we're deliberately not implementing the whole interface here, but
// can't use Partial<> for types because it'll annoy TS more than it helps.
const mockProps: React.ComponentProps<typeof MessageComposerButtons> = {
    addEmoji: () => false,
    haveRecording: false,
    isStickerPickerOpen: false,
    menuPosition: null,
    onRecordStartEndClick: () => {},
    setStickerPickerOpen: () => {},
    toggleButtonMenu: () => {},
};

describe("MessageComposerButtons", () => {
    it("Renders emoji and upload buttons in wide mode", () => {
        const buttons = wrapAndRender(
            <MessageComposerButtons
                isMenuOpen={false}
                showLocationButton={true}
                showPollsButton={true}
                showStickersButton={true}
                {...mockProps}
            />,
            false,
        );

        expect(buttonLabels(buttons)).toEqual([
            "Emoji",
            "Attachment",
            "More options",
        ]);
    });

    it("Renders other buttons in menu in wide mode", () => {
        const buttons = wrapAndRender(
            <MessageComposerButtons
                isMenuOpen={true}
                showLocationButton={true}
                showPollsButton={true}
                showStickersButton={true}
                {...mockProps}
            />,
            false,
        );

        expect(buttonLabels(buttons)).toEqual([
            "Emoji",
            "Attachment",
            "More options",
            [
                "Sticker",
                "Voice Message",
                "Poll",
                "Location",
            ],
        ]);
    });

    it("Renders only some buttons in narrow mode", () => {
        const buttons = wrapAndRender(
            <MessageComposerButtons
                isMenuOpen={false}
                showLocationButton={true}
                showPollsButton={true}
                showStickersButton={true}
                {...mockProps}
            />,
            true,
        );

        expect(buttonLabels(buttons)).toEqual([
            "Emoji",
            "More options",
        ]);
    });

    it("Renders other buttons in menu (except voice messages) in narrow mode", () => {
        const buttons = wrapAndRender(
            <MessageComposerButtons
                isMenuOpen={true}
                showLocationButton={true}
                showPollsButton={true}
                showStickersButton={true}
                {...mockProps}
            />,
            true,
        );

        expect(buttonLabels(buttons)).toEqual([
            "Emoji",
            "More options",
            [
                "Attachment",
                "Sticker",
                "Poll",
                "Location",
            ],
        ]);
    });

    describe('polls button', () => {
        it('should render when asked to', () => {
            const buttons = wrapAndRender(
                <MessageComposerButtons
                    isMenuOpen={true}
                    showLocationButton={true}
                    showPollsButton={true}
                    showStickersButton={true}
                    {...mockProps}
                />,
                true,
            );

            expect(buttonLabels(buttons)).toEqual([
                "Emoji",
                "More options",
                [
                    "Attachment",
                    "Sticker",
                    "Poll",
                    "Location",
                ],
            ]);
        });

        it('should not render when asked not to', () => {
            const buttons = wrapAndRender(
                <MessageComposerButtons
                    isMenuOpen={true}
                    showLocationButton={true}
                    showPollsButton={false} // !! the change from the alternate test
                    showStickersButton={true}
                    {...mockProps}
                />,
                true,
            );

            expect(buttonLabels(buttons)).toEqual([
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

function wrapAndRender(component: React.ReactElement, narrow: boolean): ReactWrapper {
    const mockClient = createTestClient();
    jest.spyOn(MatrixClientPeg, 'get').mockReturnValue(mockClient);
    const roomId = "myroomid";
    const mockRoom: any = {
        currentState: undefined,
        roomId,
        client: mockClient,
        getMember: function(userId: string): RoomMember {
            return new RoomMember(roomId, userId);
        },
    };
    const roomState = createRoomState(mockRoom, narrow);

    return mount(
        <MatrixClientContext.Provider value={mockClient}>
            <RoomContext.Provider value={roomState}>
                { component }
            </RoomContext.Provider>
        </MatrixClientContext.Provider>,
    );
}

function createRoomState(room: Room, narrow: boolean): IRoomState {
    return {
        room: room,
        roomId: room.roomId,
        roomLoading: true,
        peekLoading: false,
        shouldPeek: true,
        membersLoaded: false,
        numUnreadMessages: 0,
        canSelfRedact: false,
        canPeek: false,
        showApps: false,
        isPeeking: false,
        showRightPanel: true,
        joining: false,
        atEndOfLiveTimeline: true,
        showTopUnreadMessagesBar: false,
        statusBarVisible: false,
        canReact: false,
        canSendMessages: false,
        layout: Layout.Group,
        lowBandwidth: false,
        alwaysShowTimestamps: false,
        showTwelveHourTimestamps: false,
        readMarkerInViewThresholdMs: 3000,
        readMarkerOutOfViewThresholdMs: 30000,
        showHiddenEvents: false,
        showReadReceipts: true,
        showRedactions: true,
        showJoinLeaves: true,
        showAvatarChanges: true,
        showDisplaynameChanges: true,
        matrixClientIsReady: false,
        timelineRenderingType: TimelineRenderingType.Room,
        liveTimeline: undefined,
        resizing: false,
        narrow,
    };
}

function buttonLabels(buttons: ReactWrapper): any[] {
    // Note: Depends on the fact that the mini buttons use aria-label
    // and the labels under More options use textContent
    const mainButtons = (
        buttons
            .find('div.mx_MessageComposer_button[aria-label]')
            .map((button: ReactWrapper) => button.prop("aria-label") as string)
            .filter(x => x)
    );

    const extraButtons = (
        buttons
            .find('.mx_MessageComposer_Menu div.mx_AccessibleButton[role="menuitem"]')
            .map((button: ReactWrapper) => button.text())
            .filter(x => x)
    );

    const list: any[] = [
        ...mainButtons,
    ];

    if (extraButtons.length > 0) {
        list.push(extraButtons);
    }

    return list;
}
