/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
