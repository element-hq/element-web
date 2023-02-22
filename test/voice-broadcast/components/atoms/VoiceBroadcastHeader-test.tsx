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
import { MatrixClient, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { render, RenderResult } from "@testing-library/react";

import { VoiceBroadcastHeader, VoiceBroadcastLiveness } from "../../../../src/voice-broadcast";
import { mkRoom, stubClient } from "../../../test-utils";

// mock RoomAvatar, because it is doing too much fancy stuff
jest.mock("../../../../src/components/views/avatars/RoomAvatar", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(({ room }) => {
        return <div data-testid="room-avatar">room avatar: {room.name}</div>;
    }),
}));

describe("VoiceBroadcastHeader", () => {
    const userId = "@user:example.com";
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    const sender = new RoomMember(roomId, userId);
    let container: RenderResult["container"];

    const renderHeader = (live: VoiceBroadcastLiveness, showBroadcast?: boolean, buffering?: boolean): RenderResult => {
        return render(
            <VoiceBroadcastHeader
                live={live}
                microphoneLabel={sender.name}
                room={room}
                showBroadcast={showBroadcast}
                showBuffering={buffering}
            />,
        );
    };

    beforeAll(() => {
        client = stubClient();
        room = mkRoom(client, roomId);
        sender.name = "test user";
    });

    describe("when rendering a live broadcast header with broadcast info", () => {
        beforeEach(() => {
            container = renderHeader("live", true, true).container;
        });

        it("should render the header with a red live badge", () => {
            expect(container).toMatchSnapshot();
        });
    });

    describe("when rendering a buffering live broadcast header with broadcast info", () => {
        beforeEach(() => {
            container = renderHeader("live", true).container;
        });

        it("should render the header with a red live badge", () => {
            expect(container).toMatchSnapshot();
        });
    });

    describe("when rendering a live (grey) broadcast header with broadcast info", () => {
        beforeEach(() => {
            container = renderHeader("grey", true).container;
        });

        it("should render the header with a grey live badge", () => {
            expect(container).toMatchSnapshot();
        });
    });

    describe("when rendering a non-live broadcast header", () => {
        beforeEach(() => {
            container = renderHeader("not-live").container;
        });

        it("should render the header without a live badge", () => {
            expect(container).toMatchSnapshot();
        });
    });
});
