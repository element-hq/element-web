/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, RenderResult } from "@testing-library/react";
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingBody,
} from "../../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../../test-utils";

// mock RoomAvatar, because it is doing too much fancy stuff
jest.mock("../../../../src/components/views/avatars/RoomAvatar", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(({ room }) => {
        return <div data-testid="room-avatar">room avatar: {room.name}</div>;
    }),
}));

describe("VoiceBroadcastRecordingBody", () => {
    const userId = "@user:example.com";
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let infoEvent: MatrixEvent;
    let recording: VoiceBroadcastRecording;

    beforeAll(() => {
        client = stubClient();
        infoEvent = mkEvent({
            event: true,
            type: VoiceBroadcastInfoEventType,
            content: {},
            room: roomId,
            user: userId,
        });
        recording = new VoiceBroadcastRecording(infoEvent, client, VoiceBroadcastInfoState.Resumed);
    });

    describe("when rendering a live broadcast", () => {
        let renderResult: RenderResult;

        beforeEach(() => {
            renderResult = render(<VoiceBroadcastRecordingBody recording={recording} />);
        });

        it("should render with a red live badge", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });

    describe("when rendering a paused broadcast", () => {
        let renderResult: RenderResult;

        beforeEach(async () => {
            await recording.pause();
            renderResult = render(<VoiceBroadcastRecordingBody recording={recording} />);
        });

        it("should render with a grey live badge", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });

    it("when there is a broadcast without sender, it should raise an error", () => {
        infoEvent.sender = null;
        expect(() => {
            render(<VoiceBroadcastRecordingBody recording={recording} />);
        }).toThrow(`Voice Broadcast sender not found (event ${recording.infoEvent.getId()})`);
    });
});
