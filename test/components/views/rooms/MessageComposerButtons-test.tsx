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
import { mount, ReactWrapper } from "enzyme";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import * as TestUtils from "../../../test-utils";
import sdk from "../../../skinned-sdk";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { Layout } from "../../../../src/settings/enums/Layout";
import RoomContext, { TimelineRenderingType } from "../../../../src/contexts/RoomContext";
import { createTestClient } from "../../../test-utils";
import { IRoomState } from "../../../../src/components/structures/RoomView";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";

const _MessageComposerButtons = sdk.getComponent("views.rooms.MessageComposerButtons");
const MessageComposerButtons = TestUtils.wrapInMatrixClientContext(
    _MessageComposerButtons,
);

describe("MessageComposerButtons", () => {
    it("Renders all buttons in wide mode", () => {
        const buttons = wrapAndRender(
            <MessageComposerButtons
                isMenuOpen={false}
                narrowMode={false}
                showLocationButton={true}
                showStickersButton={true}
            />,
        );

        expect(buttonLabels(buttons)).toEqual([
            "Create poll",
            "Upload file",
            "Share location",
            "Add emoji",
            "Show Stickers",
            "Send voice message",
        ]);
    });

    it("Renders only some buttons in narrow mode", () => {
        const buttons = wrapAndRender(
            <MessageComposerButtons
                isMenuOpen={false}
                narrowMode={true}
                showLocationButton={true}
                showStickersButton={true}
            />,
        );

        expect(buttonLabels(buttons)).toEqual([
            "Upload file",
            "More options",
        ]);
    });

    it("Renders other buttons in menu (except voice messages) in narrow mode", () => {
        const buttons = wrapAndRender(
            <MessageComposerButtons
                isMenuOpen={true}
                narrowMode={true}
                showLocationButton={true}
                showStickersButton={true}
            />,
        );

        expect(buttonLabels(buttons)).toEqual([
            "Upload file",
            "More options",
            [
                "Create poll",
                "Share location",
                "Add emoji",
                "Send a sticker",
            ],
        ]);
    });
});

function wrapAndRender(component: React.ReactElement): ReactWrapper {
    const mockClient = MatrixClientPeg.matrixClient = createTestClient();
    const roomId = "myroomid";
    const mockRoom: any = {
        currentState: undefined,
        roomId,
        client: mockClient,
        getMember: function(userId: string): RoomMember {
            return new RoomMember(roomId, userId);
        },
    };
    const roomState = createRoomState(mockRoom);

    return mount(
        <MatrixClientContext.Provider value={mockClient}>
            <RoomContext.Provider value={roomState}>
                { component }
            </RoomContext.Provider>
        </MatrixClientContext.Provider>,
    );
}

function createRoomState(room: Room): IRoomState {
    return {
        room: room,
        roomId: room.roomId,
        roomLoading: true,
        peekLoading: false,
        shouldPeek: true,
        membersLoaded: false,
        numUnreadMessages: 0,
        draggingFile: false,
        searching: false,
        guestsCanJoin: false,
        canPeek: false,
        showApps: false,
        isPeeking: false,
        showRightPanel: true,
        joining: false,
        atEndOfLiveTimeline: true,
        atEndOfLiveTimelineInit: false,
        showTopUnreadMessagesBar: false,
        statusBarVisible: false,
        canReact: false,
        canReply: false,
        layout: Layout.Group,
        lowBandwidth: false,
        alwaysShowTimestamps: false,
        showTwelveHourTimestamps: false,
        readMarkerInViewThresholdMs: 3000,
        readMarkerOutOfViewThresholdMs: 30000,
        showHiddenEventsInTimeline: false,
        showReadReceipts: true,
        showRedactions: true,
        showJoinLeaves: true,
        showAvatarChanges: true,
        showDisplaynameChanges: true,
        matrixClientIsReady: false,
        dragCounter: 0,
        timelineRenderingType: TimelineRenderingType.Room,
        liveTimeline: undefined,
    };
}

function buttonLabels(buttons: ReactWrapper): any[] {
    // Note: Depends on the fact that the mini buttons use aria-label
    // and the labels under More options use label
    const mainButtons = (
        buttons
            .find('div')
            .map((button: ReactWrapper) => button.prop("aria-label"))
            .filter(x => x)
    );

    let extraButtons = (
        buttons
            .find('div')
            .map((button: ReactWrapper) => button.prop("label"))
            .filter(x => x)
    );
    if (extraButtons.length === 0) {
        extraButtons = [];
    } else {
        extraButtons = [extraButtons];
    }

    return [
        ...mainButtons,
        ...extraButtons,
    ];
}
